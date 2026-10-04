CREATE OR REPLACE FUNCTION public.enforce_feedback_submission_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sign in to submit feedback' USING ERRCODE = '42501';
  END IF;
  IF length(trim(NEW.message)) < 10 OR length(NEW.message) > 2500 THEN
    RAISE EXCEPTION 'Feedback must be between 10 and 2500 characters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.feedback WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute') THEN
    RAISE EXCEPTION 'Please wait a minute before sending another message' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.feedback WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Daily feedback limit reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_feedback_submission_limit
BEFORE INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.enforce_feedback_submission_limit();

CREATE TABLE public.verified_payments (
  payment_id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan_code text NOT NULL CHECK (plan_code IN ('weekly', 'monthly')),
  amount_paise integer NOT NULL CHECK (amount_paise IN (4900, 9900)),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.verified_payments TO service_role;
ALTER TABLE public.verified_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX verified_payments_user_id_idx ON public.verified_payments (user_id);