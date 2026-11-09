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

export type EmailVisualStyle = 'handwritten' | 'clean';

export const NIKNOTE_EMAIL_LOGO_URL = 'https://www.niknote.online/niknote-email-logo.png';

export const HANDWRITING_HEADING_FONT =
  "'Caveat', 'Kalam', 'Segoe Print', 'Bradley Hand', 'Noteworthy', 'Chalkboard SE', 'Snell Roundhand', cursive, Georgia, serif";

export const HANDWRITING_BODY_FONT =
  "'Kalam', 'Caveat', 'Segoe Print', 'Noteworthy', 'Bradley Hand', 'Chalkboard SE', 'Segoe Script', cursive, Georgia, serif";

export interface CustomerEmailTemplate {
  id: string;
  label: string;
  description: string;
  badge: string;
  defaultFromLocalPart: string;
  defaultStyle?: EmailVisualStyle;
  noteTag?: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

export function sanitizeBrandSenderName(rawName?: string): string {
  const cleaned = String(rawName ?? '')
    .replace(/["\r\n<>]/g, '')
    .trim();
  if (!cleaned) return 'Team of NikNote';
  if (/nikhil|founder/i.test(cleaned)) return 'Team of NikNote';
  return cleaned;
}

export const SENDER_PRESETS = [
  { label: 'Invites (Team of NikNote)', localPart: 'invite', fromName: 'Team of NikNote' },
  { label: 'Team of NikNote', localPart: 'team', fromName: 'Team of NikNote' },
  { label: 'Hello / Welcome', localPart: 'hello', fromName: 'Team of NikNote' },
  { label: 'NikNote Support', localPart: 'support', fromName: 'NikNote' },
  { label: 'Billing & Plans', localPart: 'billing', fromName: 'NikNote' },
  { label: 'Institutions', localPart: 'schools', fromName: 'Team of NikNote' },
  { label: 'No-Reply', localPart: 'noreply', fromName: 'NikNote' },
] as const;

export const CUSTOMER_EMAIL_TEMPLATES: CustomerEmailTemplate[] = [
  {
    id: 'invite',
    label: 'Invite to NikNote (Handwritten Note)',
    description: 'Aesthetic handwritten notebook invitation with the NikNote logo — signed by Team of NikNote.',
    badge: 'Invite ✨',
    defaultFromLocalPart: 'invite',
    defaultStyle: 'handwritten',
    noteTag: '✨ Personal Invite from Team of NikNote',
    subject: "You're invited to NikNote ✨ — an aesthetic home for your notes & studies",
    heading: 'A little handwritten invite for {{name}} ✨',
    body: `Hey {{name}},

We saved a cozy spot for you on NikNote — a calm, aesthetic study and note-making space crafted for students, creators, and thinkers.

- Turn typed text into realistic handwritten notebook pages on ruled, dotted, graph, or vintage paper
- Study in Hindi & English with NikAI for instant explanations, smart summaries, and flashcards
- Edit, merge, scan, and export crisp 300 DPI PDFs directly in your browser

Tap below to open your workspace and write your very first page — it takes just a few seconds!

With warmth,
Team of NikNote`,
    ctaLabel: 'Accept Invite & Open NikNote ✨',
    ctaUrl: 'https://www.niknote.online/signup',
  },
  {
    id: 'welcome',
    label: 'Welcome to NikNote',
    description: 'Warm handwritten onboarding note for newly joined students and note-makers.',
    badge: 'Onboarding',
    defaultFromLocalPart: 'hello',
    defaultStyle: 'handwritten',
    noteTag: '✨ Welcome Note · Team of NikNote',
    subject: 'Welcome to NikNote, {{name}} ✨ — your study workspace is ready',
    heading: 'Welcome aboard, {{name}}!',
    body: `Hi {{name}},

Thank you for joining NikNote! Everything is ready for your daily study and note-making flow:

- Turn typed notes into clean handwritten notebook pages on ruled, graph, plain, or dotted paper
- Study with NikAI for step-by-step explanations, smart notes, and revision quizzes
- Edit, merge, split, compress, watermark, or run OCR on PDFs right on your device in PDF Studio

Reply directly to this email anytime if you need help or want a feature added.

Happy studying,
Team of NikNote`,
    ctaLabel: 'Open NikNote Workspace ✨',
    ctaUrl: 'https://www.niknote.online',
  },
  {
    id: 'premium_activated',
    label: 'Premium Access Confirmed',
    description: 'Send confirmation after verified Razorpay capture or admin grant.',
    badge: 'Billing',
    defaultFromLocalPart: 'billing',
    defaultStyle: 'handwritten',
    noteTag: '✨ Premium Pass Unlocked · NikNote',
    subject: 'Your NikNote Premium access is active ({{plan}}) ✨',
    heading: 'NikNote Premium Activated!',
    body: `Hi {{name}},

Your NikNote Premium ({{plan}}) access is now active on {{email}}.

Here is what is unlocked on your workspace:
- AI writing assistant right inside your notebook editor
- Voice dictation for effortless hands-free note taking
- AI handwriting style matcher that maps your natural slant, size, and spacing
- Handwriting photo import into clean editable notebook pages

NikNote passes are one-time purchases with zero automatic renewal. Reply anytime if you ever need help with your account!

Warmly,
Team of NikNote`,
    ctaLabel: 'Start Using Premium Tools ✨',
    ctaUrl: 'https://www.niknote.online/?editor=1',
  },
  {
    id: 'institution_followup',
    label: 'Institution & Classroom Invite',
    description: 'Warm follow-up & pilot invite for schools, coaching institutes, and colleges.',
    badge: 'Schools',
    defaultFromLocalPart: 'schools',
    defaultStyle: 'handwritten',
    noteTag: '✨ NikNote for Classrooms & Institutions',
    subject: 'NikNote for {{institution}} — handwritten worksheets & study workspace',
    heading: 'Warm greetings to {{institution}}',
    body: `Hello {{name}},

Thank you for connecting with us regarding {{institution}}. We would love to support your teachers and students with handwritten worksheets, AI study guides, and private browser-based PDF tools.

Reply to this note with a convenient 15-minute slot this week, or share how your classrooms plan to use NikNote so we can set up your pilot right away.

Warm regards,
Team of NikNote`,
    ctaLabel: 'Explore NikNote for Schools',
    ctaUrl: 'https://www.niknote.online/schools',
  },
  {
    id: 'study_checkin',
    label: 'Student Check-in & Feedback',
    description: 'Handwritten note from Team of NikNote asking students what to improve next.',
    badge: 'Check-in',
    defaultFromLocalPart: 'team',
    defaultStyle: 'handwritten',
    noteTag: '✨ A Quick Note from Team of NikNote',
    subject: 'How is your study flow going on NikNote, {{name}}?',
    heading: 'Checking in on your notes, {{name}} ✨',
    body: `Hey {{name}},

We wanted to send a quick note and ask how NikNote is working for your studies:

- Which tool has been most helpful so far — Handwriting Notes, NikAI, PDF Studio, Flashcards, or Habit Tracker?
- Is there anything we can make faster, simpler, or better before your upcoming exams?

Just hit reply and share your thoughts — every single reply goes straight to our team.

Happy studying,
Team of NikNote`,
    ctaLabel: 'Share Feedback with NikNote',
    ctaUrl: 'https://www.niknote.online/feedback',
  },
  {
    id: 'product_update',
    label: 'Feature Update / What’s New',
    description: 'Share newly shipped improvements with your community.',
    badge: 'Update',
    defaultFromLocalPart: 'hello',
    defaultStyle: 'handwritten',
    noteTag: '✨ Freshly Shipped by NikNote',
    subject: "What's new on NikNote for your study workflow ✨",
    heading: 'Fresh upgrades live on NikNote!',
    body: `Hi {{name}},

We just shipped new upgrades on NikNote to make daily note-making and revision even smoother:

- PDF Studio & PDF Tools: merge, split, compress, watermark, OCR, and annotate PDFs right on your device
- Focused Habit & Pomodoro study timer with streak tracking
- Smoother handwritten notebook previews and crisp 300 DPI exports

Give the latest workspace a spin and tell us what you think!

With excitement,
Team of NikNote`,
    ctaLabel: 'Explore Latest Features ✨',
    ctaUrl: 'https://www.niknote.online',
  },
  {
    id: 'custom',
    label: 'Custom Handwritten Note (Blank)',
    description: 'Write a completely custom note from any @niknote.online mailbox.',
    badge: 'Custom',
    defaultFromLocalPart: 'support',
    defaultStyle: 'handwritten',
    noteTag: '✨ A Note from NikNote',
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
  const cleanName = sanitizeBrandSenderName(fromName);
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

export function bodyTextToHtmlBlocks(
  bodyText: string,
  style: EmailVisualStyle = 'handwritten',
): string {
  const normalized = String(bodyText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const isHandwritten = style === 'handwritten';
  const lines = normalized.split('\n');
  const htmlParts: string[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      if (isHandwritten) {
        htmlParts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;">${listItems.join('')}</table>`,
        );
      } else {
        htmlParts.push(
          `<ul style="margin:0 0 16px;padding-left:20px;color:#334155;font-size:15px;line-height:1.65;">${listItems.join('')}</ul>`,
        );
      }
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      if (isHandwritten) {
        htmlParts.push(
          `<p style="margin:0 0 16px;color:#1e293b;font-family:${HANDWRITING_BODY_FONT};font-size:17.5px;line-height:32px;letter-spacing:0.01em;">${paragraphLines.join('<br />')}</p>`,
        );
      } else {
        htmlParts.push(
          `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">${paragraphLines.join('<br />')}</p>`,
        );
      }
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
      if (isHandwritten) {
        listItems.push(
          `<tr><td valign="top" width="22" style="padding:0 6px 0 0;color:#db2777;font-size:15px;line-height:32px;">&#10022;</td><td valign="top" style="padding:0;color:#1e293b;font-family:${HANDWRITING_BODY_FONT};font-size:17px;line-height:32px;">${escaped}</td></tr>`,
        );
      } else {
        listItems.push(`<li style="margin:0 0 6px;">${escaped}</li>`);
      }
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
  style?: EmailVisualStyle;
  noteTag?: string;
  logoUrl?: string;
}): string {
  const style: EmailVisualStyle = options.style || 'handwritten';
  const safeLogoUrl = escapeEmailHtml(options.logoUrl || NIKNOTE_EMAIL_LOGO_URL);
  const safeBrandFromName = sanitizeBrandSenderName(options.fromName);

  const safeCtaUrl =
    options.ctaUrl?.trim() && /^https?:\/\//i.test(options.ctaUrl.trim())
      ? escapeEmailHtml(options.ctaUrl.trim())
      : '';
  const safeCtaLabel = options.ctaLabel?.trim() ? escapeEmailHtml(options.ctaLabel.trim()) : '';

  const senderBadge = options.fromEmail
    ? `${escapeEmailHtml(safeBrandFromName)} · ${escapeEmailHtml(extractBareEmail(options.fromEmail))}`
    : escapeEmailHtml(safeBrandFromName);

  const footerNote = escapeEmailHtml(
    options.footerNote || 'Sent with love by Team of NikNote · https://www.niknote.online',
  );

  if (style === 'handwritten') {
    const noteTag = escapeEmailHtml(
      options.noteTag?.trim() || `✨ Handwritten Note · ${safeBrandFromName}`,
    );

    const headingHtml = options.heading?.trim()
      ? `<h1 style="margin:0 0 18px;font-family:${HANDWRITING_HEADING_FONT};font-size:29px;line-height:36px;font-weight:700;color:#4c1d95;letter-spacing:0.01em;">${escapeEmailHtml(options.heading.trim())}</h1>`
      : '';

    const contentHtml = bodyTextToHtmlBlocks(options.bodyText, 'handwritten');

    const ctaHtml =
      safeCtaUrl && safeCtaLabel
        ? `<div style="margin:26px 0 10px;">
            <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 28px;background-color:#7c3aed;background-image:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);color:#ffffff !important;text-decoration:none;border-radius:999px;font-family:${HANDWRITING_BODY_FONT};font-weight:700;font-size:17px;line-height:22px;box-shadow:0 8px 20px rgba(124,58,237,0.22);">${safeCtaLabel}</a>
          </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Kalam:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Kalam:wght@400;700&display=swap');
  </style>
</head>
<body style="margin:0;padding:28px 12px;background-color:#f6f0e4;font-family:${HANDWRITING_BODY_FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background-color:#fffdf7;border:1px solid #e7dcc8;border-radius:22px;overflow:hidden;box-shadow:0 12px 34px rgba(105,82,53,0.09);">
    <!-- Top Spiral Notebook Punch-Holes Strip -->
    <tr>
      <td style="padding:10px 24px 6px;background-color:#fbf6ea;border-bottom:1px dashed #e6dac3;text-align:center;color:#d6c7ad;font-size:13px;letter-spacing:14px;">
        &#9679; &#9679; &#9679; &#9679; &#9679; &#9679; &#9679;
      </td>
    </tr>
    <!-- NikNote Logo & Aesthetic Stationery Header -->
    <tr>
      <td style="padding:20px 28px 18px;background-color:#fffdf7;border-bottom:2px solid #f5d0dc;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td valign="middle" align="left">
              <a href="https://www.niknote.online" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
                <img src="${safeLogoUrl}" alt="NikNote" width="164" height="40" style="display:block;width:164px;max-width:172px;height:auto;border:0;outline:none;text-decoration:none;" />
              </a>
            </td>
            <td valign="middle" align="right" style="padding-left:10px;">
              <span style="display:inline-block;padding:5px 12px;background-color:#fdf2f8;border:1px solid #fbcfe8;border-radius:999px;color:#9d174d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.01em;">
                ${noteTag}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Authentic Ruled Notebook Sheet with Pink Left Margin Line -->
    <tr>
      <td style="padding:0;background-color:#fffdf7;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="32" style="width:32px;background-color:#fffdf7;border-right:2px solid #f4afc0;font-size:1px;line-height:1px;">&nbsp;</td>
            <td style="padding:26px 28px 30px 24px;background-color:#fffdf7;background-image:linear-gradient(to bottom,transparent 31px,#efe6d5 32px);background-size:100% 32px;">
              ${headingHtml}
              ${contentHtml}
              ${ctaHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Brand Footer (Strictly NikNote / Team of NikNote) -->
    <tr>
      <td style="padding:16px 28px;background-color:#fbf6ea;border-top:1px solid #e7dcc8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#64748b;font-size:12px;line-height:1.55;">
        <div style="font-weight:600;color:#475569;">${senderBadge}</div>
        <div style="margin-top:3px;">${footerNote}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // Clean Modern Branded Card (also featuring the official NikNote Logo)
  const headingHtml = options.heading?.trim()
    ? `<h1 style="margin:0 0 16px;font-size:21px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeEmailHtml(options.heading.trim())}</h1>`
    : '';

  const contentHtml = bodyTextToHtmlBlocks(options.bodyText, 'clean');

  const ctaHtml =
    safeCtaUrl && safeCtaLabel
      ? `<div style="margin:24px 0 8px;">
          <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background-color:#7c3aed;background-image:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);color:#ffffff !important;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${safeCtaLabel}</a>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px 12px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
    <tr>
      <td style="padding:20px 28px;background:#fffdf9;border-bottom:1px solid #f1e8f7;">
        <a href="https://www.niknote.online" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
          <img src="${safeLogoUrl}" alt="NikNote" width="156" height="38" style="display:block;width:156px;height:auto;border:0;" />
        </a>
        <div style="font-size:12px;color:#64748b;margin-top:6px;">${senderBadge}</div>
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
  parts.push('— Team of NikNote (https://www.niknote.online)');
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
