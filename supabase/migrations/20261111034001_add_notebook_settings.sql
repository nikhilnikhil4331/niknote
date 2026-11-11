-- Keep page-layout preferences with the notebook. The column already exists
-- in the active project; IF NOT EXISTS safely reconciles schema drift.
ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
