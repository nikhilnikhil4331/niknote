-- ============================================================
-- Server-side growth funnel + AI quota
--
-- Two things were missing on the server:
--   1. funnel events lived only in localStorage, so nothing could be
--      measured across devices;
--   2. every AI request used a public VITE_* key, so there was no way to
--      rate-limit a user.
--
-- Both tables are append-only and privacy-constrained:
--   * growth_events stores a closed set of event names and a props object
--     whose keys are re-checked here (a trigger rejects note text, titles,
--     emails, prompts, document text, tokens and similar keys);
--   * the quota half only counts requests per user per hour window (it reuses
--     the existing generic `rate_limits` table, no new usage table).
--
-- Nothing here touches notes, documents or existing tables.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Admin helper (the project has `user_roles`, but no `has_role()` in the
--    live database, so define the smallest helper the policies need).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- 1b. growth_events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.growth_events (
  -- Client-generated UUID: retries are idempotent, so a flaky phone on a
  -- train cannot double-count a signup.
  id UUID NOT NULL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Hashed/rotating device id for events fired before login.
  anonymous_id TEXT,
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT growth_events_name_closed CHECK (name IN (
    'visitor_landing',
    'signup_started',
    'signup_completed',
    'note_created',
    'first_note_created',
    'ai_used',
    'pdf_imported',
    'handwriting_used',
    'premium_viewed',
    'subscription_completed',
    'account_deleted'
  )),
  CONSTRAINT growth_events_props_small CHECK (pg_column_size(props) < 4096),
  CONSTRAINT growth_events_props_is_object CHECK (jsonb_typeof(props) = 'object'),
  CONSTRAINT growth_events_anonymous_when_no_user CHECK (
    user_id IS NOT NULL
    OR (name IN ('visitor_landing', 'signup_started') AND anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS growth_events_occurred_at_idx
  ON public.growth_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS growth_events_name_idx
  ON public.growth_events (name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS growth_events_user_idx
  ON public.growth_events (user_id, occurred_at DESC);

-- Defence in depth: even if a client bug (or a curious user with devtools)
-- tries to store free text, the row is rejected. The client already filters
-- these keys; this is the copy that cannot be bypassed.
CREATE OR REPLACE FUNCTION public.growth_events_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  bad_key TEXT;
BEGIN
  SELECT k INTO bad_key
  FROM jsonb_object_keys(NEW.props) AS k
  WHERE k ~* '(note|content|text|title|body|email|password|token|secret|key|prompt|query|document|file|url)'
  LIMIT 1;

  IF bad_key IS NOT NULL THEN
    RAISE EXCEPTION 'growth_events.props may not contain % (analytics must never store note content or identifiers)', bad_key
      USING ERRCODE = '22023';
  END IF;

  IF NEW.occurred_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'growth_events.occurred_at is in the future' USING ERRCODE = '22007';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_events_guard_trg ON public.growth_events;
CREATE TRIGGER growth_events_guard_trg
  BEFORE INSERT ON public.growth_events
  FOR EACH ROW EXECUTE FUNCTION public.growth_events_guard();

ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.growth_events TO anon, authenticated;
GRANT SELECT ON public.growth_events TO authenticated;
GRANT ALL ON public.growth_events TO service_role;

-- A signed-in user may only write rows attributed to themselves.
CREATE POLICY "Users insert their own growth events"
ON public.growth_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Pre-login events: anonymous only, and only the two events that can happen
-- before an account exists.
CREATE POLICY "Anonymous landing events"
ON public.growth_events FOR INSERT TO anon
WITH CHECK (
  user_id IS NULL
  AND anonymous_id IS NOT NULL
  AND name IN ('visitor_landing', 'signup_started')
);

-- Reads are admin-only (aggregated view is the normal path).
CREATE POLICY "Admins read growth events"
ON public.growth_events FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- Aggregated funnel for the admin dashboard. Returns counts only — never a
-- user id, never props.
CREATE OR REPLACE FUNCTION public.growth_event_summary(p_days INT DEFAULT 30)
RETURNS TABLE (
  day DATE,
  name TEXT,
  events BIGINT,
  unique_actors BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (e.occurred_at AT TIME ZONE 'UTC')::date AS day,
    e.name,
    count(*)::BIGINT AS events,
    count(DISTINCT coalesce(e.user_id::text, e.anonymous_id))::BIGINT AS unique_actors
  FROM public.growth_events e
  WHERE e.occurred_at >= now() - make_interval(days => greatest(1, least(180, p_days)))
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.growth_event_summary(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.growth_event_summary(INT) TO authenticated;

-- ------------------------------------------------------------
-- 2. AI quota (used by the ai-proxy edge function)
--
-- The project already had a generic `rate_limits` table, so the quota reuses
-- it instead of adding a second, near-identical one. The unique index makes
-- the increment atomic under concurrency.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_user_endpoint_window_key
  ON public.rate_limits (user_id, endpoint, window_start);

CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_limit INT DEFAULT 30,
  p_window_seconds INT DEFAULT 3600
)
RETURNS TABLE (
  allowed BOOLEAN,
  used INT,
  remaining INT,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_window TIMESTAMPTZ;
  v_used INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid quota limit' USING ERRCODE = '22023';
  END IF;
  IF p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid quota window' USING ERRCODE = '22023';
  END IF;

  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.rate_limits (user_id, endpoint, window_start, request_count)
  VALUES (v_user, 'ai-proxy', v_window, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  WHERE public.rate_limits.request_count < p_limit
  RETURNING public.rate_limits.request_count INTO v_used;

  IF v_used IS NULL THEN
    SELECT r.request_count INTO v_used
    FROM public.rate_limits r
    WHERE r.user_id = v_user AND r.endpoint = 'ai-proxy' AND r.window_start = v_window;

    RETURN QUERY SELECT false, coalesce(v_used, p_limit), 0, v_window + make_interval(secs => p_window_seconds);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_used, greatest(0, p_limit - v_used), v_window + make_interval(secs => p_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INT, INT) TO authenticated;
