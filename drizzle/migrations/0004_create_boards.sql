CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled board',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own boards" ON public.boards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Own board media read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own board media write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own board media delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = auth.uid()::text);