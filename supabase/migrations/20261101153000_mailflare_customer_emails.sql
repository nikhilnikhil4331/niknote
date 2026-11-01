-- Mailflare custom customer email configuration & audit ledger.
-- Protected by Row Level Security with NO anon/authenticated policies:
-- only service_role (the admin-verified customer-email Edge Function) can
-- read or write configuration secrets or customer delivery logs.

CREATE TABLE IF NOT EXISTS public.mailflare_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider text NOT NULL DEFAULT 'mailflare' CHECK (provider IN ('mailflare', 'resend')),
  mailflare_url text NOT NULL DEFAULT '',
  mailflare_api_key text NOT NULL DEFAULT '',
  mailflare_admin_key text NOT NULL DEFAULT '',
  mailbox_id text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'NikNote',
  from_email text NOT NULL DEFAULT 'support@niknote.online',
  reply_to text NOT NULL DEFAULT '',
  resend_api_key text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mailflare_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mailflare_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mailflare_config TO service_role;

INSERT INTO public.mailflare_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  recipient_name text,
  user_id uuid,
  lead_id uuid,
  from_address text NOT NULL,
  subject text NOT NULL,
  template_id text,
  provider text NOT NULL DEFAULT 'mailflare',
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_email_logs_created_at
  ON public.customer_email_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_email_logs_recipient
  ON public.customer_email_logs (recipient_email);

ALTER TABLE public.customer_email_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_email_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.customer_email_logs TO service_role;
