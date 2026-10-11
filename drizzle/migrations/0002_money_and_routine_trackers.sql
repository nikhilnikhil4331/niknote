CREATE TABLE public.money_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('income','expense')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'Other',
  note text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.money_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  target numeric(12,2) NOT NULL CHECK (target > 0),
  saved numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tracker_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  currency text NOT NULL DEFAULT 'INR',
  monthly_budget numeric(12,2) NOT NULL DEFAULT 0,
  water_goal int NOT NULL DEFAULT 8,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '✅',
  block text NOT NULL DEFAULT 'morning' CHECK (block IN ('morning','afternoon','evening','night')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.habit_checks (
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL DEFAULT current_date,
  PRIMARY KEY (habit_id, day)
);
CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  done boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.daily_wellness (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL DEFAULT current_date,
  water int NOT NULL DEFAULT 0,
  sleep_hours numeric(4,1) NOT NULL DEFAULT 0,
  exercise_minutes int NOT NULL DEFAULT 0,
  mood text NOT NULL DEFAULT '',
  pomodoros int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['money_transactions','money_goals','tracker_settings','habits','habit_checks','todos','daily_wellness'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Owner full access" ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
  END LOOP;
END $$;

CREATE INDEX ON public.money_transactions (user_id, occurred_on DESC);
CREATE INDEX ON public.habit_checks (user_id, day);