-- ============================================================
-- Server-side AI quota for signed-out visitors
--
-- `consume_ai_quota()` is bound to auth.uid(), so it cannot meter anyone who
-- has not signed in — yet anonymous traffic is exactly what an unmetered AI key
-- gets abused for. The existing `rate_limits` table cannot hold that traffic
-- (its user_id is NOT NULL), so this adds one small additive table.
--
-- Privacy: the bucket key is a salted SHA-256 of IP + user-agent computed inside
-- the edge function. No IP address, user agent or user identifier is stored —
-- only a 32-char digest that cannot be reversed back to a person.
--
-- Additive only: no existing table, column or policy is touched.
-- Rollback: drop table public.anon_ai_limits; drop function public.consume_anon_quota(text,int,int);
-- ============================================================

CREATE TABLE IF NOT EXISTS public.anon_ai_limits (
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  CONSTRAINT anon_ai_limits_bucket_shape CHECK (bucket ~ '^[a-f0-9]{16,64}$'),
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX IF NOT EXISTS anon_ai_limits_window_start_idx
  ON public.anon_ai_limits (window_start);

-- Owner/service-role only: RLS on with no policy means anon and authenticated
-- clients cannot read or write this table directly, while the SECURITY DEFINER
-- function below still works.
ALTER TABLE public.anon_ai_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anon_ai_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_anon_quota(
  p_bucket TEXT,
  p_limit INT DEFAULT 15,
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
  v_window TIMESTAMPTZ;
  v_used INT;
BEGIN
  IF p_bucket IS NULL OR p_bucket !~ '^[a-f0-9]{16,64}$' THEN
    RAISE EXCEPTION 'invalid quota bucket' USING ERRCODE = '22023';
  END IF;
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid quota limit' USING ERRCODE = '22023';
  END IF;
  IF p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid quota window' USING ERRCODE = '22023';
  END IF;

  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.anon_ai_limits (bucket, window_start, request_count)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET request_count = public.anon_ai_limits.request_count + 1
  WHERE public.anon_ai_limits.request_count < p_limit
  RETURNING public.anon_ai_limits.request_count INTO v_used;

  -- Keep the table tiny: drop windows older than two days on the way through.
  DELETE FROM public.anon_ai_limits WHERE window_start < now() - interval '2 days';

  IF v_used IS NULL THEN
    SELECT r.request_count INTO v_used
    FROM public.anon_ai_limits r
    WHERE r.bucket = p_bucket AND r.window_start = v_window;

    RETURN QUERY SELECT false, coalesce(v_used, p_limit), 0, v_window + make_interval(secs => p_window_seconds);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_used, greatest(0, p_limit - v_used), v_window + make_interval(secs => p_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_anon_quota(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_anon_quota(TEXT, INT, INT) TO anon, authenticated;
