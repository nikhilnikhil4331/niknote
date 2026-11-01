import { supabase } from '@/integrations/supabase/client';

export type EmailProviderType = 'mailflare' | 'resend';

export type CampaignAudience =
  | 'custom'
  | 'all_users'
  | 'premium_users'
  | 'free_users'
  | 'institution_leads';

export interface MailflareConfigView {
  provider: EmailProviderType;
  mailflareUrl: string;
  mailboxId: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  hasMailflareKey: boolean;
  maskedMailflareKey: string;
  hasMailflareAdminKey: boolean;
  maskedMailflareAdminKey: string;
  hasResendKey: boolean;
  maskedResendKey: string;
  hasWebhookSecret?: boolean;
  maskedWebhookSecret?: string;
  inboundWebhookUrl?: string;
  configured: boolean;
  source: 'database' | 'env';
}

export type WebmailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';

export interface AdminEmailDomain {
  id: string;
  hostname: string;
  mailflare_domain_id: string;
  sending_provider: 'mailflare' | 'resend';
  receiving_provider: 'mailflare' | 'webhook';
  dns_status: 'pending' | 'partial' | 'verified';
  mx_verified: boolean;
  spf_verified: boolean;
  dmarc_verified: boolean;
  dns_diagnostics?: {
    mxRecords?: string[];
    spfRecords?: string[];
    dmarcRecords?: string[];
    checkedAt?: string;
  };
  is_primary: boolean;
  last_checked_at: string | null;
  created_at: string;
}

export interface AdminCustomMailbox {
  id: string;
  domain_id: string;
  local_part: string;
  hostname: string;
  address: string;
  display_name: string;
  mailbox_type: 'personal' | 'shared';
  color: string;
  signature: string;
  forward_to: string;
  auto_reply_enabled: boolean;
  auto_reply_subject: string;
  auto_reply_body: string;
  is_default: boolean;
  disabled: boolean;
  mailflare_mailbox_id: string;
  created_at: string;
}

export interface AdminWebmailMessage {
  id: string;
  mailbox_id: string | null;
  mailbox_address: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';
  direction: 'inbound' | 'outbound' | 'draft';
  from_name: string;
  from_email: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_html: string;
  body_text: string;
  snippet: string;
  is_read: boolean;
  is_starred: boolean;
  thread_id: string;
  in_reply_to: string;
  provider: string;
  provider_message_id: string | null;
  delivery_status: 'received' | 'sent' | 'delivered' | 'draft' | 'failed';
  error_message: string | null;
  attachments_meta: Array<{ filename: string; type?: string }>;
  created_at: string;
}

export interface WebmailCounts {
  inbox: number;
  unread: number;
  starred: number;
  sent: number;
  drafts: number;
  archive: number;
  spam: number;
  trash: number;
  byMailboxUnread: Record<string, number>;
  byMailboxTotal: Record<string, number>;
}

export interface DiscoveredMailbox {
  id: string;
  address: string;
  displayName?: string;
  type?: string;
}

export interface EmailAttachmentInput {
  filename: string;
  type: string;
  contentBase64: string;
  sizeBytes?: number;
}

export interface CustomerEmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  from_address: string;
  subject: string;
  template_id: string | null;
  provider: string;
  status: 'sent' | 'failed';
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface MailflareInboxMessage {
  id: string;
  mailboxId: string;
  direction: 'inbound' | 'outbound';
  fromAddr: string;
  toAddr: string;
  subject: string;
  snippet?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
  messageIdHeader?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  isRead?: boolean;
  createdAt?: number | string;
}

export interface ComposePrefill {
  to: string;
  recipientName?: string;
  userId?: string;
  leadId?: string;
  institution?: string;
  plan?: string;
  templateId?: string;
  subject?: string;
  body?: string;
  inReplyTo?: string;
  references?: string;
}

export interface CustomerEmailTemplate {
  id: string;
  label: string;
  description: string;
  badge: string;
  defaultFromLocalPart: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

export const SENDER_PRESETS = [
  { label: 'Support', localPart: 'support', fromName: 'NikNote Support' },
  { label: 'Founder (Nikhil)', localPart: 'nikhil', fromName: 'Nikhil from NikNote' },
  { label: 'Hello / Team', localPart: 'hello', fromName: 'NikNote Team' },
  { label: 'Billing & Plans', localPart: 'billing', fromName: 'NikNote Billing' },
  { label: 'Institutions', localPart: 'schools', fromName: 'NikNote Institutions' },
  { label: 'No-Reply', localPart: 'noreply', fromName: 'NikNote' },
] as const;

export const CUSTOMER_EMAIL_TEMPLATES: CustomerEmailTemplate[] = [
  {
    id: 'welcome',
    label: 'Welcome to NikNote',
    description: 'Warm onboarding guide for newly registered students and note-makers.',
    badge: 'Onboarding',
    defaultFromLocalPart: 'hello',
    subject: 'Welcome to NikNote, {{name}} — your study workspace is ready',
    heading: 'Welcome aboard, {{name}}!',
    body: `Hi {{name}},

Thank you for joining NikNote. Everything is ready for your study and note-making workflow:

- Turn typed notes into clean handwritten notebook pages on ruled, graph, plain or dotted paper
- Study with NikAI for step-by-step explanations, smart notes and revision quizzes
- Edit, merge, split, compress, watermark or run OCR on PDFs right on your device in PDF Studio

Reply directly to this email anytime if you need help or want a feature added.

Happy studying,
Nikhil Jatav
Founder, NikNote`,
    ctaLabel: 'Open NikNote Workspace',
    ctaUrl: 'https://www.niknote.online',
  },
  {
    id: 'premium_activated',
    label: 'Premium Access Confirmed',
    description: 'Send confirmation after verified Razorpay capture or admin grant.',
    badge: 'Billing',
    defaultFromLocalPart: 'billing',
    subject: 'Your NikNote Premium access is active ({{plan}})',
    heading: 'NikNote Premium Activated',
    body: `Hi {{name}},

Your NikNote Premium ({{plan}}) access is active on {{email}}.

Here is what is unlocked on your account:
- AI writing assistant inside the editor
- Voice dictation for hands-free note taking
- AI handwriting style matcher (maps slant, size and spacing)
- Handwriting photo import to editable notebook blocks

Remember that NikNote passes are one-time purchases with no automatic renewal. If you ever need assistance with your account, just reply to this email.

Warm regards,
NikNote Support`,
    ctaLabel: 'Start Using Premium Tools',
    ctaUrl: 'https://www.niknote.online/?editor=1',
  },
  {
    id: 'institution_followup',
    label: 'Institution Inquiry Reply',
    description: 'Personal follow-up for schools, coaching institutes and colleges.',
    badge: 'B2B / Schools',
    defaultFromLocalPart: 'schools',
    subject: 'Re: NikNote for {{institution}}',
    heading: 'Thank you for reaching out from {{institution}}',
    body: `Hello {{name}},

Thank you for writing to us regarding {{institution}}. We received your inquiry and would love to understand your classroom, worksheet and PDF workflow needs in detail.

Could you share a convenient 15-minute slot this week, or reply with how your students and teachers plan to use NikNote?

Best regards,
Nikhil Jatav
NikNote — https://www.niknote.online/schools`,
    ctaLabel: 'View Institution Details',
    ctaUrl: 'https://www.niknote.online/schools',
  },
  {
    id: 'study_checkin',
    label: 'Student Check-in & Feedback',
    description: 'Personal founder note asking students what to improve next.',
    badge: 'Feedback',
    defaultFromLocalPart: 'nikhil',
    subject: 'Quick check-in on your NikNote experience, {{name}}',
    heading: 'How is NikNote working for your studies?',
    body: `Hey {{name}},

I am Nikhil, founder of NikNote. I wanted to personally check in and ask:

1. Which tool has been most helpful for you so far (Handwriting Notes, NikAI, PDF Studio, Flashcards or Habit Tracker)?
2. Is there anything slow, confusing, or missing that would save you time before exams?

Hit reply and tell me directly — I read every response myself.

Thank you for studying with NikNote,
Nikhil`,
    ctaLabel: 'Share Feedback on NikNote',
    ctaUrl: 'https://www.niknote.online/feedback',
  },
  {
    id: 'product_update',
    label: 'Feature Update / Announcement',
    description: 'Share newly shipped improvements with your customers.',
    badge: 'Update',
    defaultFromLocalPart: 'hello',
    subject: "What's new in NikNote for your study workflow",
    heading: 'New upgrades live on NikNote',
    body: `Hi {{name}},

We just shipped fresh improvements on NikNote to make daily studying smoother:

- PDF Studio & PDF Tools: merge, split, compress, watermark, OCR and annotate PDFs directly on your device
- Focused Habit & Pomodoro timer with offline-first tracking
- Faster handwriting notebook previews and clean exports

Try the latest version on web or Android and let us know what you think!

Best,
Team NikNote`,
    ctaLabel: 'Explore Latest Features',
    ctaUrl: 'https://www.niknote.online',
  },
  {
    id: 'custom',
    label: 'Custom Email (Blank)',
    description: 'Write a completely custom message from any @niknote.online mailbox.',
    badge: 'Custom',
    defaultFromLocalPart: 'support',
    subject: '',
    heading: '',
    body: '',
    ctaLabel: '',
    ctaUrl: '',
  },
];

const EMAIL_ADDR_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

export function extractBareEmail(input: string): string {
  const match = String(input || '').match(/<([^<>]+)>/);
  return (match ? match[1] : String(input || '')).trim().toLowerCase();
}

export function isValidEmailAddress(input: string): boolean {
  return EMAIL_ADDR_RE.test(extractBareEmail(input));
}

export function parseRecipientInput(raw: string): { valid: string[]; invalid: string[] } {
  const parts = String(raw || '')
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const bare = extractBareEmail(part);
    if (!EMAIL_ADDR_RE.test(bare)) {
      invalid.push(part);
      continue;
    }
    if (seen.has(bare)) continue;
    seen.add(bare);
    valid.push(part);
  }
  return { valid, invalid };
}

export function formatSenderPreview(fromName: string, fromEmail: string): string {
  const cleanEmail = extractBareEmail(fromEmail);
  const cleanName = String(fromName || '').replace(/["\r\n<>]/g, '').trim();
  if (!cleanName) return cleanEmail;
  return `"${cleanName}" <${cleanEmail}>`;
}

export function extractDomainFromEmail(email: string, fallback = 'niknote.online'): string {
  const bare = extractBareEmail(email);
  const atIndex = bare.indexOf('@');
  if (atIndex === -1 || atIndex === bare.length - 1) return fallback;
  return bare.slice(atIndex + 1);
}

export function escapeEmailHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function interpolateEmailTemplate(
  template: string,
  variables: Record<string, string>,
  escapeHtmlValues = false,
): string {
  return String(template ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, key: string) => {
    if (!(key in variables)) return token;
    const val = variables[key] ?? '';
    return escapeHtmlValues ? escapeEmailHtml(val) : val;
  });
}

function formatInlineEmailText(escapedLine: string): string {
  // Preserve {{variable}} placeholders untouched while allowing **bold**
  return escapedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export function bodyTextToHtmlBlocks(bodyText: string): string {
  const normalized = String(bodyText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const lines = normalized.split('\n');
  const htmlParts: string[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      htmlParts.push(
        `<ul style="margin:0 0 16px;padding-left:20px;color:#334155;font-size:15px;line-height:1.65;">${listItems.join('')}</ul>`,
      );
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      htmlParts.push(
        `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">${paragraphLines.join('<br />')}</p>`,
      );
      paragraphLines = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }
    const bulletMatch = trimmed.match(/^[-•*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      const escaped = formatInlineEmailText(escapeEmailHtml(bulletMatch[1]));
      listItems.push(`<li style="margin:0 0 6px;">${escaped}</li>`);
      continue;
    }
    flushList();
    paragraphLines.push(formatInlineEmailText(escapeEmailHtml(trimmed)));
  }

  flushList();
  flushParagraph();
  return htmlParts.join('\n');
}

export function buildNikNoteEmailHtml(options: {
  heading?: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  fromName?: string;
  fromEmail?: string;
  footerNote?: string;
}): string {
  const headingHtml = options.heading?.trim()
    ? `<h1 style="margin:0 0 16px;font-size:21px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeEmailHtml(options.heading.trim())}</h1>`
    : '';

  const contentHtml = bodyTextToHtmlBlocks(options.bodyText);

  const safeCtaUrl = options.ctaUrl?.trim() && /^https?:\/\//i.test(options.ctaUrl.trim())
    ? escapeEmailHtml(options.ctaUrl.trim())
    : '';
  const safeCtaLabel = options.ctaLabel?.trim() ? escapeEmailHtml(options.ctaLabel.trim()) : '';

  const ctaHtml = safeCtaUrl && safeCtaLabel
    ? `<div style="margin:24px 0 8px;">
        <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${safeCtaLabel}</a>
      </div>`
    : '';

  const senderBadge = options.fromEmail
    ? `${escapeEmailHtml(options.fromName || 'NikNote')} · ${escapeEmailHtml(extractBareEmail(options.fromEmail))}`
    : escapeEmailHtml(options.fromName || 'NikNote');

  const footerNote = escapeEmailHtml(
    options.footerNote || 'Sent via NikNote Mailflare custom domain delivery · https://www.niknote.online',
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px 12px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:20px 28px;background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);color:#ffffff;">
        <div style="font-size:17px;font-weight:700;letter-spacing:-0.01em;">NikNote</div>
        <div style="font-size:12px;opacity:0.88;margin-top:2px;">${senderBadge}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        ${headingHtml}
        ${contentHtml}
        ${ctaHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
        ${footerNote}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildNikNotePlainText(options: {
  heading?: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const parts: string[] = [];
  if (options.heading?.trim()) {
    parts.push(options.heading.trim());
    parts.push('');
  }
  if (options.bodyText?.trim()) {
    parts.push(options.bodyText.trim());
  }
  if (options.ctaLabel?.trim() && options.ctaUrl?.trim() && /^https?:\/\//i.test(options.ctaUrl.trim())) {
    parts.push('');
    parts.push(`${options.ctaLabel.trim()}: ${options.ctaUrl.trim()}`);
  }
  parts.push('');
  parts.push('— NikNote (https://www.niknote.online)');
  return parts.join('\n');
}

export async function fileToAttachmentBase64(file: File): Promise<EmailAttachmentInput> {
  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" exceeds the 8 MB per-attachment limit.`);
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return {
    filename: file.name,
    type: file.type || 'application/octet-stream',
    contentBase64: btoa(binary),
    sizeBytes: file.size,
  };
}

export async function invokeCustomerEmail<T = any>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const adminToken = sessionStorage.getItem('admin_token');
    if (adminToken) headers['x-admin-token'] = adminToken;
  }
  const { data, error } = await supabase.functions.invoke('customer-email', {
    body: { action, payload },
    headers,
  });
  if (error) {
    throw new Error(data?.error || error.message || 'Customer email request failed');
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export async function getMailflareConfig(): Promise<MailflareConfigView> {
  const res = await invokeCustomerEmail<{ config: MailflareConfigView }>('get_config');
  return res.config;
}

export async function saveMailflareConfig(input: {
  provider: EmailProviderType;
  mailflareUrl: string;
  mailflareApiKey?: string;
  mailflareAdminKey?: string;
  mailboxId: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  resendApiKey?: string;
  clearMailflareKey?: boolean;
  clearMailflareAdminKey?: boolean;
  clearResendKey?: boolean;
  rotateWebhookSecret?: boolean;
}): Promise<MailflareConfigView> {
  const res = await invokeCustomerEmail<{ config: MailflareConfigView }>('save_config', input);
  return res.config;
}

export async function getEmailWorkspace(): Promise<{
  config: MailflareConfigView;
  webhookSecretPreview: string;
  domains: AdminEmailDomain[];
  mailboxes: AdminCustomMailbox[];
  counts: WebmailCounts;
}> {
  return invokeCustomerEmail('get_workspace');
}

export async function addEmailDomain(input: {
  hostname: string;
  sendingProvider?: 'mailflare' | 'resend';
  receivingProvider?: 'mailflare' | 'webhook';
}): Promise<{ success: boolean; domain: AdminEmailDomain }> {
  return invokeCustomerEmail('add_domain', input);
}

export async function verifyEmailDomainDns(input: {
  domainId?: string;
  hostname?: string;
}): Promise<{
  ok: boolean;
  hostname: string;
  dnsStatus: 'pending' | 'partial' | 'verified';
  mxVerified: boolean;
  spfVerified: boolean;
  dmarcVerified: boolean;
  diagnostics: {
    mxRecords: string[];
    spfRecords: string[];
    dmarcRecords: string[];
    checkedAt: string;
  };
}> {
  return invokeCustomerEmail('verify_domain_dns', input);
}

export async function deleteEmailDomain(domainId: string): Promise<{ success: boolean }> {
  return invokeCustomerEmail('delete_domain', { domainId });
}

export async function createCustomMailbox(input: {
  localPart: string;
  domainId?: string;
  displayName: string;
  mailboxType?: 'personal' | 'shared';
  color?: string;
  signature?: string;
  forwardTo?: string;
  autoReplyEnabled?: boolean;
  autoReplySubject?: string;
  autoReplyBody?: string;
  mailflareMailboxId?: string;
}): Promise<{ success: boolean; mailbox: AdminCustomMailbox }> {
  return invokeCustomerEmail('create_mailbox', input);
}

export async function updateCustomMailbox(input: {
  id: string;
  displayName?: string;
  mailboxType?: 'personal' | 'shared';
  color?: string;
  signature?: string;
  forwardTo?: string;
  autoReplyEnabled?: boolean;
  autoReplySubject?: string;
  autoReplyBody?: string;
  isDefault?: boolean;
  disabled?: boolean;
  mailflareMailboxId?: string;
}): Promise<{ success: boolean; mailbox: AdminCustomMailbox }> {
  return invokeCustomerEmail('update_mailbox', input);
}

export async function deleteCustomMailbox(id: string): Promise<{ success: boolean }> {
  return invokeCustomerEmail('delete_mailbox', { id });
}

export async function listWebmailMessages(input: {
  folder?: WebmailFolder;
  mailboxAddress?: string;
  q?: string;
  limit?: number;
}): Promise<{ messages: AdminWebmailMessage[]; counts: WebmailCounts }> {
  return invokeCustomerEmail('list_messages', input);
}

export async function saveEmailDraft(input: {
  draftId?: string;
  fromEmail: string;
  fromName: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ success: boolean; draft: AdminWebmailMessage }> {
  return invokeCustomerEmail('save_draft', input);
}

export async function updateWebmailMessage(input: {
  id: string;
  isRead?: boolean;
  isStarred?: boolean;
  folder?: 'inbox' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';
  permanentDelete?: boolean;
}): Promise<{ success: boolean; message: AdminWebmailMessage | null }> {
  return invokeCustomerEmail('update_message', input);
}

export async function bulkWebmailMessages(input: {
  operation:
    | 'mark_read'
    | 'mark_unread'
    | 'star'
    | 'unstar'
    | 'move_inbox'
    | 'move_archive'
    | 'move_spam'
    | 'move_trash'
    | 'delete_forever'
    | 'empty_trash';
  ids?: string[];
}): Promise<{ success: boolean; count?: number }> {
  return invokeCustomerEmail('bulk_messages', input);
}

export async function syncMailflareToWebmail(): Promise<{
  success: boolean;
  fetched: number;
  synced: number;
}> {
  return invokeCustomerEmail('sync_mailflare_inbox');
}

export async function discoverMailflareMailboxes(input?: {
  mailflareUrl?: string;
  mailflareApiKey?: string;
  mailflareAdminKey?: string;
}): Promise<{ mailboxes: DiscoveredMailbox[]; message: string }> {
  return invokeCustomerEmail('discover_mailboxes', input || {});
}

export async function testMailflareConnection(testRecipient?: string): Promise<{
  ok: boolean;
  latencyMs?: number;
  messageId?: string;
  detail?: string;
}> {
  return invokeCustomerEmail('test_connection', testRecipient ? { testRecipient } : {});
}

export async function sendCustomerEmail(input: {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  mailflareMailboxId?: string;
  replyTo?: string;
  templateId?: string;
  recipientName?: string;
  userId?: string;
  leadId?: string;
  draftId?: string;
  inReplyTo?: string;
  references?: string | string[];
  attachments?: EmailAttachmentInput[];
}): Promise<{ success: boolean; messageId: string; provider: string; from: string }> {
  return invokeCustomerEmail('send_email', input);
}

export async function sendCustomerCampaign(input: {
  audience: CampaignAudience;
  recipients?: Array<{
    email: string;
    name?: string;
    plan?: string;
    institution?: string;
    userId?: string;
    leadId?: string;
  }>;
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  mailflareMailboxId?: string;
  replyTo?: string;
  templateId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
  results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }>;
}> {
  return invokeCustomerEmail('send_campaign', input);
}

export async function listMailflareInbox(input?: {
  direction?: 'inbound' | 'outbound';
  q?: string;
  limit?: number;
}): Promise<{ messages: MailflareInboxMessage[] }> {
  return invokeCustomerEmail('list_inbox', input || {});
}

export async function listCustomerEmailLogs(): Promise<{
  logs: CustomerEmailLog[];
  summary: { totalSent: number; totalFailed: number; last24hSent: number };
}> {
  return invokeCustomerEmail('list_logs');
}
