-- Infinite Playground documents. JSON contains objects, positions, dimensions,
-- rotation, connections, viewport and canvas preferences; auth.uid() owns every row.
CREATE TABLE IF NOT EXISTS public.playgrounds (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled playground',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playgrounds_user_updated_idx
  ON public.playgrounds (user_id, updated_at DESC);

ALTER TABLE public.playgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own playgrounds"
  ON public.playgrounds FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own playgrounds"
  ON public.playgrounds FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own playgrounds"
  ON public.playgrounds FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own playgrounds"
  ON public.playgrounds FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playgrounds TO authenticated;
GRANT ALL ON public.playgrounds TO service_role;

DROP TRIGGER IF EXISTS trg_playgrounds_updated_at ON public.playgrounds;
CREATE TRIGGER trg_playgrounds_updated_at
  BEFORE UPDATE ON public.playgrounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
