-- ============================================================================
-- NikNote × Mailflare — Full Custom Email Mailbox, Domain & Webmail Manager
-- ============================================================================
-- Adds custom domain management, custom mailboxes (with signatures, forwarding,
-- auto-replies), and full multi-folder webmail message storage (inbox, sent,
-- drafts, archive, spam, trash) inside NikNote Admin Panel.
-- Protected by service_role-only RLS; accessed exclusively via `customer-email`.

CREATE TABLE IF NOT EXISTS public.admin_email_domains (
  id text PRIMARY KEY,
  hostname text NOT NULL UNIQUE,
  mailflare_domain_id text NOT NULL DEFAULT '',
  sending_provider text NOT NULL DEFAULT 'mailflare' CHECK (sending_provider IN ('mailflare', 'resend')),
  receiving_provider text NOT NULL DEFAULT 'mailflare' CHECK (receiving_provider IN ('mailflare', 'webhook')),
  dns_status text NOT NULL DEFAULT 'pending' CHECK (dns_status IN ('pending', 'partial', 'verified')),
  mx_verified boolean NOT NULL DEFAULT false,
  spf_verified boolean NOT NULL DEFAULT false,
  dmarc_verified boolean NOT NULL DEFAULT false,
  dns_diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_mailboxes (
  id text PRIMARY KEY,
  domain_id text NOT NULL REFERENCES public.admin_email_domains(id) ON DELETE CASCADE,
  local_part text NOT NULL,
  hostname text NOT NULL,
  address text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'NikNote',
  mailbox_type text NOT NULL DEFAULT 'personal' CHECK (mailbox_type IN ('personal', 'shared')),
  color text NOT NULL DEFAULT '#7c3aed',
  signature text NOT NULL DEFAULT '',
  forward_to text NOT NULL DEFAULT '',
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  auto_reply_subject text NOT NULL DEFAULT 'We received your email — NikNote Support',
  auto_reply_body text NOT NULL DEFAULT 'Hi there,\n\nThank you for contacting NikNote. Our team has received your message and will get back to you shortly.\n\nWarm regards,\nNikNote Team',
  is_default boolean NOT NULL DEFAULT false,
  disabled boolean NOT NULL DEFAULT false,
  mailflare_mailbox_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id text REFERENCES public.admin_mailboxes(id) ON DELETE SET NULL,
  mailbox_address text NOT NULL DEFAULT 'support@niknote.online',
  folder text NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'drafts', 'archive', 'spam', 'trash')),
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound', 'draft')),
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  bcc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '(No subject)',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT true,
  is_starred boolean NOT NULL DEFAULT false,
  thread_id text NOT NULL DEFAULT '',
  in_reply_to text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT 'mailflare',
  provider_message_id text,
  delivery_status text NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('received', 'sent', 'delivered', 'draft', 'failed')),
  error_message text,
  attachments_meta jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_email_messages_folder_created
  ON public.admin_email_messages (folder, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_messages_mailbox_created
  ON public.admin_email_messages (mailbox_address, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_messages_provider_msg
  ON public.admin_email_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL AND provider_message_id <> '';

ALTER TABLE public.mailflare_config
  ADD COLUMN IF NOT EXISTS webhook_secret text NOT NULL DEFAULT '';

-- Seed primary domain `niknote.online` and default custom mailboxes
INSERT INTO public.admin_email_domains (id, hostname, sending_provider, receiving_provider, is_primary)
VALUES ('dom_niknote_online', 'niknote.online', 'mailflare', 'mailflare', true)
ON CONFLICT (hostname) DO NOTHING;

INSERT INTO public.admin_mailboxes (
  id, domain_id, local_part, hostname, address, display_name, mailbox_type, color, signature, is_default
)
VALUES
  (
    'mbx_support',
    'dom_niknote_online',
    'support',
    'niknote.online',
    'support@niknote.online',
    'NikNote Support',
    'shared',
    '#7c3aed',
    E'Warm regards,\nNikNote Support Team\nhttps://www.niknote.online',
    true
  ),
  (
    'mbx_hello',
    'dom_niknote_online',
    'hello',
    'niknote.online',
    'hello@niknote.online',
    'NikNote Team',
    'shared',
    '#2563eb',
    E'Best wishes,\nTeam NikNote\nhttps://www.niknote.online',
    false
  ),
  (
    'mbx_nikhil',
    'dom_niknote_online',
    'nikhil',
    'niknote.online',
    'nikhil@niknote.online',
    'Nikhil — NikNote',
    'personal',
    '#ea580c',
    E'Best,\nNikhil\nFounder, NikNote · https://www.niknote.online',
    false
  ),
  (
    'mbx_billing',
    'dom_niknote_online',
    'billing',
    'niknote.online',
    'billing@niknote.online',
    'NikNote Billing',
    'shared',
    '#059669',
    E'Regards,\nNikNote Billing & Accounts\nhttps://www.niknote.online',
    false
  ),
  (
    'mbx_schools',
    'dom_niknote_online',
    'schools',
    'niknote.online',
    'schools@niknote.online',
    'NikNote Institutions',
    'shared',
    '#db2777',
    E'Warm regards,\nNikNote Institutions Desk\nhttps://www.niknote.online/schools',
    false
  )
ON CONFLICT (address) DO NOTHING;

-- Enable strict RLS (service_role only)
ALTER TABLE public.admin_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_email_domains FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_mailboxes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_email_messages FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.admin_email_domains TO service_role;
GRANT ALL ON public.admin_mailboxes TO service_role;
GRANT ALL ON public.admin_email_messages TO service_role;
