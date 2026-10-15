ALTER TABLE public.money_transactions ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'Cash';
ALTER TABLE public.money_transactions ADD COLUMN IF NOT EXISTS to_account text;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS days smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;