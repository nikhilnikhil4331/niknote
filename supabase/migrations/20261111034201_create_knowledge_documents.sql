CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT 'note',
  source TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embeddings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_type_check
    CHECK (document_type IN ('note', 'pdf', 'image', 'web', 'ai_generated'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_owner_updated
  ON public.knowledge_documents (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_metadata
  ON public.knowledge_documents USING GIN (metadata);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_documents_select_owner ON public.knowledge_documents;
CREATE POLICY knowledge_documents_select_owner
  ON public.knowledge_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS knowledge_documents_insert_owner ON public.knowledge_documents;
CREATE POLICY knowledge_documents_insert_owner
  ON public.knowledge_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS knowledge_documents_update_owner ON public.knowledge_documents;
CREATE POLICY knowledge_documents_update_owner
  ON public.knowledge_documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS knowledge_documents_delete_owner ON public.knowledge_documents;
CREATE POLICY knowledge_documents_delete_owner
  ON public.knowledge_documents FOR DELETE TO authenticated
  USING (user_id = auth.uid());
