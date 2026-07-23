
CREATE TABLE public.block_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id TEXT NOT NULL,
  notebook_id UUID NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_comments TO authenticated;
GRANT ALL ON public.block_comments TO service_role;

ALTER TABLE public.block_comments ENABLE ROW LEVEL SECURITY;

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
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users update their own comments"
ON public.block_comments FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users delete their own comments"
ON public.block_comments FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE INDEX idx_block_comments_block ON public.block_comments(block_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_block_comments_notebook ON public.block_comments(notebook_id) WHERE deleted_at IS NULL;

CREATE TRIGGER update_block_comments_updated_at
BEFORE UPDATE ON public.block_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
