-- Store only server-created order references, never card/UPI details.  This
-- lets the customer recover a captured payment if their browser closes before
-- Razorpay's callback arrives.  Only Edge Functions using service_role access
-- this table; customers recover orders through an authenticated function.
CREATE TABLE IF NOT EXISTS public.checkout_orders (
  order_id text PRIMARY KEY CHECK (order_id ~ '^order_[A-Za-z0-9]+$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL CHECK (plan_code IN ('weekly', 'monthly')),
  amount_paise integer NOT NULL CHECK (
    (plan_code = 'weekly' AND amount_paise = 4900) OR
    (plan_code = 'monthly' AND amount_paise = 9900)
  ),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'verified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS checkout_orders_user_pending_idx
  ON public.checkout_orders (user_id, status, created_at DESC);

ALTER TABLE public.checkout_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.checkout_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.checkout_orders TO service_role;
