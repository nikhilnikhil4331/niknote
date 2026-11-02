-- ============================================================================
-- NikNote Brand-Only Mailboxes & Invite Identity Cleanup
-- ============================================================================
-- Ensures all custom mailboxes, display names, signatures, and auto-replies use
-- strictly "NikNote" or "Team of NikNote" (no personal or founder names), and
-- seeds dedicated `invite@niknote.online` and `team@niknote.online` mailboxes.

DELETE FROM public.admin_mailboxes
WHERE id = 'mbx_nikhil' OR local_part = 'nikhil';

UPDATE public.admin_mailboxes
SET
  display_name = 'NikNote',
  signature = E'Warmly,\nTeam of NikNote\nhttps://www.niknote.online',
  auto_reply_subject = 'We received your message — NikNote',
  auto_reply_body = E'Hi there,\n\nThank you for reaching out to NikNote. Team of NikNote has received your message and will get back to you shortly.\n\nWarmly,\nTeam of NikNote',
  updated_at = now()
WHERE id = 'mbx_support';

UPDATE public.admin_mailboxes
SET
  display_name = 'Team of NikNote',
  signature = E'With warmth,\nTeam of NikNote\nhttps://www.niknote.online',
  auto_reply_subject = 'Thanks for writing to Team of NikNote',
  auto_reply_body = E'Hi there,\n\nThank you for writing to us! Team of NikNote will reply to your note shortly.\n\nWith warmth,\nTeam of NikNote',
  updated_at = now()
WHERE id = 'mbx_hello';

UPDATE public.admin_mailboxes
SET
  display_name = 'NikNote',
  signature = E'Warm regards,\nTeam of NikNote\nhttps://www.niknote.online',
  auto_reply_subject = 'Billing Inquiry Received — NikNote',
  auto_reply_body = E'Hi there,\n\nTeam of NikNote has received your billing query and will assist you shortly.\n\nWarm regards,\nTeam of NikNote',
  updated_at = now()
WHERE id = 'mbx_billing';

UPDATE public.admin_mailboxes
SET
  display_name = 'Team of NikNote',
  signature = E'Warm regards,\nTeam of NikNote\nhttps://www.niknote.online/schools',
  auto_reply_subject = 'Institution Inquiry Received — NikNote',
  auto_reply_body = E'Hi there,\n\nThank you for contacting NikNote regarding your institution. Team of NikNote will respond shortly.\n\nWarm regards,\nTeam of NikNote',
  updated_at = now()
WHERE id = 'mbx_schools';

INSERT INTO public.admin_mailboxes (
  id,
  domain_id,
  local_part,
  hostname,
  address,
  display_name,
  mailbox_type,
  color,
  signature,
  auto_reply_subject,
  auto_reply_body,
  is_default
)
VALUES
  (
    'mbx_invite',
    'dom_niknote_online',
    'invite',
    'niknote.online',
    'invite@niknote.online',
    'Team of NikNote',
    'shared',
    '#db2777',
    E'With warmth,\nTeam of NikNote\nhttps://www.niknote.online',
    'Thank you for replying to your NikNote invite',
    E'Hi there,\n\nThank you for writing back! Team of NikNote is excited to have you onboard.\n\nWith warmth,\nTeam of NikNote',
    false
  ),
  (
    'mbx_team',
    'dom_niknote_online',
    'team',
    'niknote.online',
    'team@niknote.online',
    'Team of NikNote',
    'shared',
    '#6366f1',
    E'Warmly,\nTeam of NikNote\nhttps://www.niknote.online',
    'Message received — Team of NikNote',
    E'Hi there,\n\nTeam of NikNote has received your email and will get back to you soon.\n\nWarmly,\nTeam of NikNote',
    false
  )
ON CONFLICT (address) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  signature = EXCLUDED.signature,
  auto_reply_subject = EXCLUDED.auto_reply_subject,
  auto_reply_body = EXCLUDED.auto_reply_body,
  updated_at = now();

UPDATE public.mailflare_config
SET
  from_name = CASE
    WHEN from_name ILIKE '%nikhil%' OR from_name ILIKE '%founder%' OR btrim(from_name) = '' THEN 'Team of NikNote'
    ELSE from_name
  END,
  updated_at = now()
WHERE id = 1;

UPDATE public.admin_email_domains
SET
  sending_provider = 'resend',
  receiving_provider = 'webhook',
  updated_at = now()
WHERE id = 'dom_niknote_online'
  AND EXISTS (
    SELECT 1 FROM public.mailflare_config WHERE id = 1 AND provider = 'resend'
  );
