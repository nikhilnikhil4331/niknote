-- Restore the Supabase schema expected by the current NikNote app.
-- This migration is additive: it preserves the legacy notebook_pages table and its data.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Bring existing account and notebook rows up to the current app shape.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS use_case text,
  ADD COLUMN IF NOT EXISTS exam_board text;

ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS cover_color text NOT NULL DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS handwriting_model_id uuid,
  ADD COLUMN IF NOT EXISTS page_style text NOT NULL DEFAULT 'ruled',
  ADD COLUMN IF NOT EXISTS page_size text NOT NULL DEFAULT 'a4';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notebooks_handwriting_model_id_fkey'
      AND conrelid = 'public.notebooks'::regclass
  ) THEN
    ALTER TABLE public.notebooks
      ADD CONSTRAINT notebooks_handwriting_model_id_fkey
      FOREIGN KEY (handwriting_model_id)
      REFERENCES public.handwriting_models(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_notebooks_updated_at ON public.notebooks;
CREATE TRIGGER trg_notebooks_updated_at
  BEFORE UPDATE ON public.notebooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The app's block editor reads/writes pages; notebook_pages is the legacy line editor table.
-- Keep the legacy table intact so old records are not discarded.
CREATE TABLE IF NOT EXISTS public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Page',
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  page_number integer NOT NULL DEFAULT 1 CHECK (page_number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pages_notebook_page_number_key UNIQUE (notebook_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_user_notebook
  ON public.pages (user_id, notebook_id, page_number);
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;

DROP POLICY IF EXISTS pages_select_owner ON public.pages;
DROP POLICY IF EXISTS pages_insert_owner ON public.pages;
DROP POLICY IF EXISTS pages_update_owner ON public.pages;
DROP POLICY IF EXISTS pages_delete_owner ON public.pages;
CREATE POLICY pages_select_owner ON public.pages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = pages.notebook_id AND n.user_id = auth.uid())
  );
CREATE POLICY pages_insert_owner ON public.pages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = pages.notebook_id AND n.user_id = auth.uid())
  );
CREATE POLICY pages_update_owner ON public.pages
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = pages.notebook_id AND n.user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = pages.notebook_id AND n.user_id = auth.uid())
  );
CREATE POLICY pages_delete_owner ON public.pages
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = pages.notebook_id AND n.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_pages_updated_at ON public.pages;
CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User-owned free-form boards and private media storage.
CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled board',
  data jsonb NOT NULL DEFAULT '{"version":1,"pages":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boards_user_updated ON public.boards (user_id, updated_at DESC);
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
DROP POLICY IF EXISTS boards_select_owner ON public.boards;
DROP POLICY IF EXISTS boards_insert_owner ON public.boards;
DROP POLICY IF EXISTS boards_update_owner ON public.boards;
DROP POLICY IF EXISTS boards_delete_owner ON public.boards;
CREATE POLICY boards_select_owner ON public.boards FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY boards_insert_owner ON public.boards FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY boards_update_owner ON public.boards FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY boards_delete_owner ON public.boards FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP TRIGGER IF EXISTS trg_boards_updated_at ON public.boards;
CREATE TRIGGER trg_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('board-media', 'board-media', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS board_media_insert_owner ON storage.objects;
DROP POLICY IF EXISTS board_media_select_owner ON storage.objects;
DROP POLICY IF EXISTS board_media_update_owner ON storage.objects;
DROP POLICY IF EXISTS board_media_delete_owner ON storage.objects;
CREATE POLICY board_media_insert_owner ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY board_media_select_owner ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY board_media_update_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY board_media_delete_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO storage.buckets (id, name, public)
VALUES ('handwriting-samples', 'handwriting-samples', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS handwriting_samples_insert_owner ON storage.objects;
DROP POLICY IF EXISTS handwriting_samples_select_owner ON storage.objects;
DROP POLICY IF EXISTS handwriting_samples_update_owner ON storage.objects;
DROP POLICY IF EXISTS handwriting_samples_delete_owner ON storage.objects;
CREATE POLICY handwriting_samples_insert_owner ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'handwriting-samples' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY handwriting_samples_select_owner ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'handwriting-samples' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY handwriting_samples_update_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'handwriting-samples' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'handwriting-samples' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY handwriting_samples_delete_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'handwriting-samples' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Feedback submissions are private to the submitting account.
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
DROP POLICY IF EXISTS feedback_insert_owner ON public.feedback;
DROP POLICY IF EXISTS feedback_select_owner ON public.feedback;
CREATE POLICY feedback_insert_owner ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY feedback_select_owner ON public.feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Persist flashcard review schedules per account, while clients can keep an offline cache.
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  ease numeric NOT NULL DEFAULT 2.5 CHECK (ease >= 1.3),
  interval_days integer NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  due_at timestamptz NOT NULL DEFAULT now(),
  reps integer NOT NULL DEFAULT 0 CHECK (reps >= 0),
  last_reviewed_at timestamptz,
  PRIMARY KEY (user_id, block_id)
);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_due ON public.flashcard_reviews (user_id, due_at);
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_reviews TO authenticated;
GRANT ALL ON public.flashcard_reviews TO service_role;
DROP POLICY IF EXISTS flashcard_reviews_select_owner ON public.flashcard_reviews;
DROP POLICY IF EXISTS flashcard_reviews_insert_owner ON public.flashcard_reviews;
DROP POLICY IF EXISTS flashcard_reviews_update_owner ON public.flashcard_reviews;
DROP POLICY IF EXISTS flashcard_reviews_delete_owner ON public.flashcard_reviews;
CREATE POLICY flashcard_reviews_select_owner ON public.flashcard_reviews FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY flashcard_reviews_insert_owner ON public.flashcard_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY flashcard_reviews_update_owner ON public.flashcard_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY flashcard_reviews_delete_owner ON public.flashcard_reviews FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Real knowledge documents use a dedicated owner-scoped table, not legacy notebook_pages.
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  document_type text NOT NULL DEFAULT 'note',
  source text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embeddings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_type_check
    CHECK (document_type IN ('note', 'pdf', 'image', 'web', 'ai_generated'))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_owner_updated
  ON public.knowledge_documents (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_metadata
  ON public.knowledge_documents USING gin (metadata);
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;
DROP POLICY IF EXISTS knowledge_documents_select_owner ON public.knowledge_documents;
DROP POLICY IF EXISTS knowledge_documents_insert_owner ON public.knowledge_documents;
DROP POLICY IF EXISTS knowledge_documents_update_owner ON public.knowledge_documents;
DROP POLICY IF EXISTS knowledge_documents_delete_owner ON public.knowledge_documents;
CREATE POLICY knowledge_documents_select_owner ON public.knowledge_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY knowledge_documents_insert_owner ON public.knowledge_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY knowledge_documents_update_owner ON public.knowledge_documents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY knowledge_documents_delete_owner ON public.knowledge_documents FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP TRIGGER IF EXISTS trg_knowledge_documents_updated_at ON public.knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Block comments with strict notebook ownership checks. Enable realtime for threads.
CREATE TABLE IF NOT EXISTS public.block_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id text NOT NULL,
  notebook_id uuid REFERENCES public.notebooks(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_block_comments_block ON public.block_comments (block_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_block_comments_notebook ON public.block_comments (notebook_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_block_comments_thread ON public.block_comments (thread_id, created_at) WHERE deleted_at IS NULL;
ALTER TABLE public.block_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_comments REPLICA IDENTITY FULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_comments TO authenticated;
GRANT ALL ON public.block_comments TO service_role;
DROP POLICY IF EXISTS "Users read comments on their notebooks or their own comments" ON public.block_comments;
DROP POLICY IF EXISTS "Users insert their own comments" ON public.block_comments;
DROP POLICY IF EXISTS "Users update their own comments" ON public.block_comments;
DROP POLICY IF EXISTS "Users delete their own comments" ON public.block_comments;
CREATE POLICY "Users read comments on their notebooks or their own comments"
  ON public.block_comments FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      author_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = block_comments.notebook_id AND n.user_id = auth.uid())
    )
  );
CREATE POLICY "Users insert their own comments"
  ON public.block_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (notebook_id IS NULL OR EXISTS (
      SELECT 1 FROM public.notebooks n WHERE n.id = block_comments.notebook_id AND n.user_id = auth.uid()
    ))
  );
CREATE POLICY "Users update their own comments"
  ON public.block_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    AND (notebook_id IS NULL OR EXISTS (
      SELECT 1 FROM public.notebooks n WHERE n.id = block_comments.notebook_id AND n.user_id = auth.uid()
    ))
  );
CREATE POLICY "Users delete their own comments"
  ON public.block_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());
DROP TRIGGER IF EXISTS trg_block_comments_updated_at ON public.block_comments;
CREATE TRIGGER trg_block_comments_updated_at
  BEFORE UPDATE ON public.block_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'block_comments'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.block_comments;
  END IF;
END;
$$;

-- Existing app code uses monthly counters; preserve old event-shaped columns for compatibility.
ALTER TABLE public.feature_usage
  ADD COLUMN IF NOT EXISTS feature_name text,
  ADD COLUMN IF NOT EXISTS usage_count integer,
  ADD COLUMN IF NOT EXISTS usage_month text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.feature_usage
SET feature_name = COALESCE(feature_name, feature),
    usage_count = COALESCE(NULLIF(usage_count, 0), 1),
    usage_month = COALESCE(usage_month, to_char(used_at AT TIME ZONE 'UTC', 'YYYY-MM')),
    updated_at = COALESCE(updated_at, now());
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, feature_name, usage_month ORDER BY used_at, id) AS rn,
         sum(usage_count) OVER (PARTITION BY user_id, feature_name, usage_month) AS total
  FROM public.feature_usage
)
UPDATE public.feature_usage AS usage
SET usage_count = ranked.total,
    updated_at = now()
FROM ranked
WHERE usage.id = ranked.id AND ranked.rn = 1;
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, feature_name, usage_month ORDER BY used_at, id) AS rn
  FROM public.feature_usage
)
DELETE FROM public.feature_usage AS usage
USING ranked
WHERE usage.id = ranked.id AND ranked.rn > 1;
ALTER TABLE public.feature_usage
  ALTER COLUMN feature_name SET NOT NULL,
  ALTER COLUMN usage_count SET NOT NULL,
  ALTER COLUMN usage_count SET DEFAULT 1,
  ALTER COLUMN usage_month SET NOT NULL,
  ALTER COLUMN usage_month SET DEFAULT to_char(now(), 'YYYY-MM'),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_usage_user_feature_month
  ON public.feature_usage (user_id, feature_name, usage_month);
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.feature_usage TO authenticated;
GRANT ALL ON public.feature_usage TO service_role;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.feature_usage;
CREATE POLICY "Users can update their own usage"
  ON public.feature_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.sync_feature_usage_compat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.feature_name IS NULL OR btrim(NEW.feature_name) = '' THEN
    NEW.feature_name := NEW.feature;
  END IF;
  IF NEW.feature IS NULL OR btrim(NEW.feature) = '' THEN
    NEW.feature := NEW.feature_name;
  END IF;
  IF NEW.usage_month IS NULL OR btrim(NEW.usage_month) = '' THEN
    NEW.usage_month := to_char(COALESCE(NEW.used_at, now()) AT TIME ZONE 'UTC', 'YYYY-MM');
  END IF;
  IF NEW.used_at IS NULL THEN
    NEW.used_at := now();
  END IF;
  IF NEW.usage_count IS NULL THEN
    NEW.usage_count := 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_feature_usage_compat ON public.feature_usage;
CREATE TRIGGER trg_feature_usage_compat
  BEFORE INSERT OR UPDATE ON public.feature_usage
  FOR EACH ROW EXECUTE FUNCTION public.sync_feature_usage_compat();

-- Match the current subscription queries and enforce one current subscription per user.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS plan_code text;
UPDATE public.user_subscriptions AS subscription
SET plan_code = plans.code
FROM public.billing_plans AS plans
WHERE subscription.plan_code IS NULL AND subscription.plan_id = plans.id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_one_per_user
  ON public.user_subscriptions (user_id);

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER trg_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS user_agent text;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_handwriting_models_updated_at ON public.handwriting_models;
CREATE TRIGGER trg_handwriting_models_updated_at
  BEFORE UPDATE ON public.handwriting_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-only admin sessions. The existing admin-auth edge function uses the service role.
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions (expires_at);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
DROP POLICY IF EXISTS "Block all access to admin sessions" ON public.admin_sessions;
CREATE POLICY "Block all access to admin sessions"
  ON public.admin_sessions FOR ALL TO public USING (false) WITH CHECK (false);

-- Service-only rate-limit ledger used by AI edge functions.
ALTER TABLE public.rate_limits
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;
DROP POLICY IF EXISTS "Block all access to rate limits" ON public.rate_limits;
CREATE POLICY "Block all access to rate limits"
  ON public.rate_limits FOR ALL TO public USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint_user_window
  ON public.rate_limits (endpoint, user_id, window_start DESC);

-- Progress tables used by the streaks and badge screens.
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS requirement_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS requirement_value integer NOT NULL DEFAULT 1;
UPDATE public.badges
SET requirement_type = COALESCE(NULLIF(requirement_type, ''), requirement->>'type', 'manual'),
    requirement_value = CASE
      WHEN requirement ? 'value' AND (requirement->>'value') ~ '^[0-9]+$'
        THEN (requirement->>'value')::integer
      ELSE requirement_value
    END;

CREATE TABLE IF NOT EXISTS public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_streaks TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_streaks FROM anon, authenticated;
GRANT ALL ON public.user_streaks TO service_role;
DROP POLICY IF EXISTS "Users can view their own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can insert their own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update their own streak" ON public.user_streaks;
CREATE POLICY "Users can view their own streak" ON public.user_streaks FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP TRIGGER IF EXISTS trg_user_streaks_updated_at ON public.user_streaks;
CREATE TRIGGER trg_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_streak public.user_streaks%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to update this streak' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_streaks (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak FROM public.user_streaks WHERE user_id = p_user_id;
  IF v_streak.last_active_date = v_today THEN
    RETURN json_build_object(
      'current_streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'streak_updated', false
    );
  END IF;

  IF v_streak.last_active_date = v_today - 1 THEN
    UPDATE public.user_streaks
    SET current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_active_date = v_today
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.user_streaks
    SET current_streak = 1,
        longest_streak = GREATEST(longest_streak, 1),
        last_active_date = v_today
    WHERE user_id = p_user_id;
  END IF;

  SELECT * INTO v_streak FROM public.user_streaks WHERE user_id = p_user_id;
  RETURN json_build_object(
    'current_streak', v_streak.current_streak,
    'longest_streak', v_streak.longest_streak,
    'streak_updated', true
  );
END;
$$;
REVOKE ALL ON FUNCTION public.update_user_streak(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_badges_user_badge_key UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_badges TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_badges FROM anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
DROP POLICY IF EXISTS "Users can view their own earned badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can insert their own earned badges" ON public.user_badges;
CREATE POLICY "Users can view their own earned badges" ON public.user_badges FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Referral balances are read-only for clients and written via service-side admin/payment flows.
CREATE TABLE IF NOT EXISTS public.user_rewards (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  total_earned integer NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  referral_code text NOT NULL UNIQUE,
  referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_spin_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_rewards TO authenticated;
GRANT ALL ON public.user_rewards TO service_role;
DROP POLICY IF EXISTS user_rewards_select_owner ON public.user_rewards;
CREATE POLICY user_rewards_select_owner ON public.user_rewards
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP TRIGGER IF EXISTS trg_user_rewards_updated_at ON public.user_rewards;
CREATE TRIGGER trg_user_rewards_updated_at
  BEFORE UPDATE ON public.user_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Local-first habit tracker cloud sync tables.
CREATE TABLE IF NOT EXISTS public.habits (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  emoji text NOT NULL DEFAULT '✅',
  block text NOT NULL DEFAULT 'morning' CHECK (block IN ('morning', 'afternoon', 'evening', 'night')),
  days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habits_id_user_key UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_habits_user_created ON public.habits (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.habit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habit_checks_habit_day_key UNIQUE (habit_id, day),
  CONSTRAINT habit_checks_habit_owner_fkey FOREIGN KEY (habit_id, user_id)
    REFERENCES public.habits(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_habit_checks_user_day ON public.habit_checks (user_id, day DESC);

CREATE TABLE IF NOT EXISTS public.todos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  done boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_todos_user_position ON public.todos (user_id, position, created_at);

CREATE TABLE IF NOT EXISTS public.daily_wellness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  water numeric(6,1) NOT NULL DEFAULT 0 CHECK (water >= 0),
  sleep_hours numeric(4,1) NOT NULL DEFAULT 0 CHECK (sleep_hours BETWEEN 0 AND 24),
  exercise_minutes integer NOT NULL DEFAULT 0 CHECK (exercise_minutes >= 0),
  mood text NOT NULL DEFAULT '',
  pomodoros integer NOT NULL DEFAULT 0 CHECK (pomodoros >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_wellness_user_day_key UNIQUE (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_daily_wellness_user_day ON public.daily_wellness (user_id, day DESC);

CREATE TABLE IF NOT EXISTS public.tracker_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR',
  monthly_budget numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0),
  water_goal integer NOT NULL DEFAULT 8 CHECK (water_goal > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Money tracker stores bookkeeping entries only; it never accesses bank accounts.
CREATE TABLE IF NOT EXISTS public.money_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('expense', 'income', 'transfer')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'Other',
  note text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  account text NOT NULL DEFAULT 'Cash',
  to_account text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_money_transactions_user_date ON public.money_transactions (user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_money_transactions_user_kind_date ON public.money_transactions (user_id, kind, occurred_on DESC);

CREATE TABLE IF NOT EXISTS public.money_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  target numeric(14,2) NOT NULL CHECK (target > 0),
  saved numeric(14,2) NOT NULL DEFAULT 0 CHECK (saved >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_money_goals_user_created ON public.money_goals (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.bill_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  last_paid_month text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bill_reminders_user_due ON public.bill_reminders (user_id, due_day);

-- Apply the signed-in account as owner for app inserts that intentionally omit user_id.
CREATE OR REPLACE FUNCTION public.stamp_tracker_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.user_id IS NOT NULL AND NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Cannot write tracker data for another user' USING ERRCODE = '42501';
    END IF;
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'habits', 'habit_checks', 'todos', 'daily_wellness', 'tracker_settings',
    'money_transactions', 'money_goals', 'bill_reminders'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_stamp_owner ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_stamp_owner BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_tracker_owner()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'habits', 'todos', 'daily_wellness', 'tracker_settings',
    'money_transactions', 'money_goals', 'bill_reminders'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'habits', 'habit_checks', 'todos', 'daily_wellness', 'tracker_settings',
    'money_transactions', 'money_goals', 'bill_reminders'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_owner_all', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      table_name || '_owner_all', table_name
    );
  END LOOP;
END;
$$;

-- Starter achievement catalogue for the achievement screen; idempotent by badge name.
INSERT INTO public.badges (name, description, icon, category, requirement, requirement_type, requirement_value)
SELECT seed.name, seed.description, seed.icon, seed.category, seed.requirement::jsonb, seed.requirement_type, seed.requirement_value
FROM (VALUES
  ('first_note', 'Create your first note.', '📝', 'notes', '{"type":"pages","value":1}', 'pages', 1),
  ('organized', 'Create five notebooks.', '📚', 'notes', '{"type":"notebooks","value":5}', 'notebooks', 5),
  ('week_streak', 'Keep a seven-day learning streak.', '🔥', 'streaks', '{"type":"streak","value":7}', 'streak', 7),
  ('month_streak', 'Keep a thirty-day learning streak.', '🏆', 'streaks', '{"type":"streak","value":30}', 'streak', 30),
  ('flashcard_starter', 'Review your first flashcard.', '🧠', 'study', '{"type":"flashcards","value":1}', 'flashcards', 1),
  ('knowledge_builder', 'Save ten knowledge documents.', '✨', 'study', '{"type":"knowledge_documents","value":10}', 'knowledge_documents', 10)
) AS seed(name, description, icon, category, requirement, requirement_type, requirement_value)
WHERE NOT EXISTS (SELECT 1 FROM public.badges existing WHERE existing.name = seed.name);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
DROP POLICY IF EXISTS badges_read_all ON public.badges;
CREATE POLICY badges_read_all ON public.badges FOR SELECT TO anon, authenticated USING (true);

-- Stable, account-owned referral codes. Codes are private to the owner except when a referral is submitted.
CREATE OR REPLACE FUNCTION public.stamp_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR btrim(NEW.referral_code) = '' THEN
    NEW.referral_code := 'NIK' || upper(substr(replace(NEW.user_id::text, '-', ''), 1, 12));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_rewards_referral_code ON public.user_rewards;
CREATE TRIGGER trg_user_rewards_referral_code
  BEFORE INSERT OR UPDATE OF user_id, referral_code ON public.user_rewards
  FOR EACH ROW EXECUTE FUNCTION public.stamp_referral_code();

CREATE OR REPLACE FUNCTION public.create_user_rewards_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_rewards (user_id, coins, total_earned)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_user_rewards_for_auth_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_rewards ON auth.users;
CREATE TRIGGER on_auth_user_created_rewards
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_rewards_for_auth_user();

INSERT INTO public.user_rewards (user_id, coins, total_earned)
SELECT id, 0, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_rewards (user_id, coins, total_earned)
  VALUES (v_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT referral_code INTO v_code FROM public.user_rewards WHERE user_id = v_user_id;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_one_per_referred_user
  ON public.referrals (referred_id);
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS premium_days_awarded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_awarded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_granted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status ON public.referrals (referrer_id, status, created_at DESC);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE OR REPLACE FUNCTION public.track_referral(p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_id uuid := auth.uid();
  v_referrer_id uuid;
  v_rows integer;
BEGIN
  IF v_referred_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_referral_code IS NULL OR length(btrim(p_referral_code)) > 40 THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_referrer_id
  FROM public.user_rewards
  WHERE upper(referral_code) = upper(btrim(p_referral_code));
  IF v_referrer_id IS NULL OR v_referrer_id = v_referred_id THEN
    RETURN false;
  END IF;

  INSERT INTO public.referrals (referrer_id, referral_code, referred_id, status)
  VALUES (v_referrer_id, upper(btrim(p_referral_code)), v_referred_id, 'pending')
  ON CONFLICT (referred_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.track_referral(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_referral(text) TO authenticated;

-- Verified Razorpay receipts are server-only and make subscription activation idempotent.
CREATE TABLE IF NOT EXISTS public.verified_payments (
  payment_id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL CHECK (plan_code IN ('weekly', 'monthly')),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verified_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_payments FROM anon, authenticated;
GRANT ALL ON public.verified_payments TO service_role;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS plan_code text;
UPDATE public.user_subscriptions AS subscription
SET plan_code = COALESCE(subscription.plan_code, plans.code, 'premium')
FROM public.billing_plans AS plans
WHERE subscription.plan_id = plans.id;
UPDATE public.user_subscriptions SET plan_code = 'premium' WHERE plan_code IS NULL;
ALTER TABLE public.user_subscriptions
  ALTER COLUMN plan_code SET DEFAULT 'premium',
  ALTER COLUMN plan_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_one_per_user
  ON public.user_subscriptions (user_id);
DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.activate_verified_purchase(
  _user_id uuid,
  _payment_id text,
  _order_id text,
  _plan_code text,
  _amount_paise integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_inserted integer;
  v_existing public.verified_payments%ROWTYPE;
  v_now timestamptz := now();
  v_referral record;
  v_month_rewarded integer;
  v_reward_days integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _payment_id IS NULL OR _order_id IS NULL THEN
    RAISE EXCEPTION 'Payment details are incomplete' USING ERRCODE = '22023';
  END IF;
  IF _plan_code = 'weekly' AND _amount_paise = 4900 THEN
    v_days := 7;
  ELSIF _plan_code = 'monthly' AND _amount_paise = 9900 THEN
    v_days := 30;
  ELSE
    RAISE EXCEPTION 'Plan or verified amount is invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.verified_payments (payment_id, order_id, user_id, plan_code, amount_paise)
  VALUES (_payment_id, _order_id, _user_id, _plan_code, _amount_paise)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_existing
    FROM public.verified_payments
    WHERE payment_id = _payment_id OR order_id = _order_id
    LIMIT 1;
    IF v_existing.payment_id = _payment_id
       AND v_existing.order_id = _order_id
       AND v_existing.user_id = _user_id
       AND v_existing.plan_code = _plan_code
       AND v_existing.amount_paise = _amount_paise THEN
      RETURN true;
    END IF;
    RAISE EXCEPTION 'Payment or order was already used' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id, plan_code, plan_id, status, current_period_start, current_period_end,
    razorpay_payment_id, updated_at
  ) VALUES (
    _user_id, _plan_code, NULL, 'active', v_now, v_now + make_interval(days => v_days),
    _payment_id, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    status = 'active',
    current_period_start = v_now,
    current_period_end = GREATEST(COALESCE(user_subscriptions.current_period_end, v_now), v_now)
      + make_interval(days => v_days),
    razorpay_payment_id = EXCLUDED.razorpay_payment_id,
    updated_at = v_now;

  -- Pay referral premium only once, after the referred user has a verified purchase.
  SELECT id, referrer_id INTO v_referral
  FROM public.referrals
  WHERE referred_id = _user_id
    AND status = 'pending'
    AND COALESCE(reward_claimed, false) = false
  FOR UPDATE;
  IF FOUND THEN
    SELECT COALESCE(sum(premium_days_awarded), 0)::integer INTO v_month_rewarded
    FROM public.referrals
    WHERE referrer_id = v_referral.referrer_id
      AND status = 'completed'
      AND created_at >= date_trunc('month', v_now);
    v_reward_days := LEAST(7, GREATEST(0, 30 - COALESCE(v_month_rewarded, 0)));

    UPDATE public.referrals
    SET status = 'completed',
        reward_claimed = v_reward_days > 0,
        reward_granted = v_reward_days > 0,
        premium_days_awarded = v_reward_days,
        coins_awarded = 0
    WHERE id = v_referral.id;

    IF v_reward_days > 0 THEN
      INSERT INTO public.user_subscriptions (
        user_id, plan_code, plan_id, status, current_period_start, current_period_end, updated_at
      ) VALUES (
        v_referral.referrer_id, 'referral_reward', NULL, 'active', v_now,
        v_now + make_interval(days => v_reward_days), v_now
      )
      ON CONFLICT (user_id) DO UPDATE SET
        status = 'active',
        current_period_start = COALESCE(user_subscriptions.current_period_start, v_now),
        current_period_end = GREATEST(COALESCE(user_subscriptions.current_period_end, v_now), v_now)
          + make_interval(days => v_reward_days),
        updated_at = v_now;
    END IF;
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_verified_purchase(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_verified_purchase(uuid, text, text, text, integer) TO service_role;

-- Badge awards are checked on the server so clients cannot self-award arbitrary achievements.
CREATE OR REPLACE FUNCTION public.award_badge(p_badge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_type text;
  v_required integer;
  v_progress integer := 0;
  v_rows integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT requirement_type, requirement_value
  INTO v_type, v_required
  FROM public.badges
  WHERE id = p_badge_id;
  IF NOT FOUND THEN RETURN false; END IF;

  CASE v_type
    WHEN 'pages' THEN
      SELECT count(*)::integer INTO v_progress FROM public.pages WHERE user_id = v_user_id;
    WHEN 'notebooks' THEN
      SELECT count(*)::integer INTO v_progress FROM public.notebooks WHERE user_id = v_user_id;
    WHEN 'streak' THEN
      SELECT COALESCE(current_streak, 0) INTO v_progress FROM public.user_streaks WHERE user_id = v_user_id;
    WHEN 'flashcards' THEN
      SELECT count(*)::integer INTO v_progress FROM public.flashcard_reviews
      WHERE user_id = v_user_id AND last_reviewed_at IS NOT NULL;
    WHEN 'knowledge_documents' THEN
      SELECT count(*)::integer INTO v_progress FROM public.knowledge_documents WHERE user_id = v_user_id;
    ELSE
      RETURN false;
  END CASE;

  IF v_progress < GREATEST(v_required, 1) THEN RETURN false; END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (v_user_id, p_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.award_badge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_badge(uuid) TO authenticated;
