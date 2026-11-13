-- Keep the editor's favorite flag in the canonical notebook schema.
-- The active Supabase project already has this column; IF NOT EXISTS makes
-- this migration safe to apply there while keeping new installs consistent.
ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
