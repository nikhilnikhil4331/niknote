CREATE TABLE public.bill_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_day int NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  last_paid_month text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_reminders TO authenticated;
GRANT ALL ON public.bill_reminders TO service_role;
ALTER TABLE public.bill_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner full access" ON public.bill_reminders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());