// NikNote × Mailflare — Full Custom Email Mailbox, Domain & Webmail Manager Gateway
// Authenticates admin callers via either:
//   (a) x-admin-token SHA-256 session hash in public.admin_sessions, OR
//   (b) Supabase JWT belonging to a user with role = 'admin' in public.user_roles.
// Inbound webhook (`action = 'inbound_webhook'` or `?webhook=1`) authenticates via
// constant-time comparison against `mailflare_config.webhook_secret`.
// Secrets never leave the server.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-admin-token, x-webhook-secret, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const HOSTNAME_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const LOCAL_PART_RE = /^[a-z0-9][a-z0-9._+-]{0,62}$/i;
const VALID_FOLDERS = new Set(['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash']);

interface EffectiveConfig {
  provider: 'mailflare' | 'resend';
  mailflareUrl: string;
  mailflareApiKey: string;
  mailflareAdminKey: string;
  mailboxId: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  resendApiKey: string;
  webhookSecret: string;
  source: 'database' | 'env';
}

interface AttachmentPayload {
  filename: string;
  type?: string;
  contentBase64: string;
}

function cleanStr(val: unknown, max = 500): string {
  return typeof val === 'string' ? val.trim().slice(0, max) : '';
}

function cleanSecret(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim()
    .slice(0, 500);
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 6) return '••••••';
  return `••••••${secret.slice(-4)}`;
}

function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => n.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractEmail(entry: string): string {
  const match = entry.match(/<([^<>]+)>/);
  return (match ? match[1] : entry).trim().toLowerCase();
}

function extractDisplayName(entry: string): string {
  const match = entry.match(/^"?([^"<>]+?)"?\s*<[^<>]+>$/);
  return match ? match[1].trim() : '';
}

function sanitizeBrandSenderName(rawName: string): string {
  const cleaned = rawName.replace(/["\r\n<>]/g, '').trim();
  if (!cleaned) return 'Team of NikNote';
  if (/nikhil|founder/i.test(cleaned)) return 'Team of NikNote';
  return cleaned;
}

function formatFromHeader(fromEmail: string, fromName: string): string {
  const addr = extractEmail(fromEmail);
  const safeName = sanitizeBrandSenderName(fromName);
  return safeName ? `"${safeName}" <${addr}>` : addr;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function makeSnippet(text?: string, html?: string): string {
  const plain = (text?.trim() || (html ? htmlToText(html) : '')).replace(/\s+/g, ' ').trim();
  return plain.slice(0, 180);
}

function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
  escapeValues: boolean,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const raw = vars[key] ?? '';
    return escapeValues ? escapeHtml(raw) : raw;
  });
}

function validateMailflareOrigin(rawUrl: string, allowLocal: boolean): { ok: true; origin: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return { ok: false, error: 'Mailflare URL is required' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a valid Mailflare URL (for example https://mail.niknote.online)' };
  }
  const host = parsed.hostname.toLowerCase();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (isLocalHost) {
    if (!allowLocal) {
      return { ok: false, error: 'Mailflare URL must be a public HTTPS address so Supabase Edge Functions can reach it' };
    }
    return { ok: true, origin: `${parsed.protocol}//${parsed.host}` };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Mailflare URL must use HTTPS (for example https://mail.niknote.online)' };
  }
  if (
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^169\.254\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(host)
  ) {
    return { ok: false, error: 'Mailflare URL cannot target a private or internal network address' };
  }
  return { ok: true, origin: `${parsed.protocol}//${parsed.host}` };
}

async function authorizeAdmin(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  adminHeaders: Record<string, string>,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = req.headers.get('x-admin-token') || '';
  if (token && token.length <= 256) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hex = Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('');
    const sessionRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_sessions?select=id&token_hash=eq.${hex}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
      { headers: adminHeaders },
    );
    if (!sessionRes.ok) return { ok: false, status: 503, error: 'Could not validate admin access' };
    const rows = await sessionRes.json();
    if (Array.isArray(rows) && rows.length === 1) return { ok: true };
  }

  const authorization = req.headers.get('Authorization') || '';
  if (/^Bearer\s+\S+$/i.test(authorization)) {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      if (typeof user?.id === 'string' && /^[a-f0-9-]{36}$/i.test(user.id)) {
        const roleRes = await fetch(
          `${supabaseUrl}/rest/v1/user_roles?select=id&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`,
          { headers: adminHeaders },
        );
        if (!roleRes.ok) return { ok: false, status: 503, error: 'Could not validate admin access' };
        const roles = await roleRes.json();
        if (Array.isArray(roles) && roles.length === 1) return { ok: true };
      }
    }
  }

  return { ok: false, status: 403, error: 'Admin access required' };
}

async function loadEffectiveConfig(
  supabaseUrl: string,
  adminHeaders: Record<string, string>,
): Promise<EffectiveConfig> {
  const envProvider = Deno.env.get('MAILFLARE_PROVIDER') === 'resend' ? 'resend' : 'mailflare';
  const envUrl = cleanStr(Deno.env.get('MAILFLARE_URL'), 300).replace(/\/+$/, '');
  const envKey = cleanSecret(Deno.env.get('MAILFLARE_API_KEY'));
  const envAdminKey = cleanSecret(Deno.env.get('MAILFLARE_ADMIN_KEY'));
  const envMailboxId = cleanStr(Deno.env.get('MAILFLARE_MAILBOX_ID'), 200);
  const envFromName = cleanStr(Deno.env.get('MAILFLARE_FROM_NAME'), 120) || 'NikNote';
  const envFromEmail = cleanStr(Deno.env.get('MAILFLARE_FROM_EMAIL'), 200) || 'support@niknote.online';
  const envReplyTo = cleanStr(Deno.env.get('MAILFLARE_REPLY_TO'), 200);
  const envResendKey = cleanSecret(Deno.env.get('RESEND_API_KEY'));
  const envWebhookSecret = cleanSecret(Deno.env.get('MAILFLARE_WEBHOOK_SECRET'));

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/mailflare_config?id=eq.1&limit=1`, {
      headers: adminHeaders,
    });
    if (res.ok) {
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        const hasDbValues = Boolean(
          row.mailflare_url || row.mailflare_api_key || row.resend_api_key || row.mailbox_id,
        );
        return {
          provider: row.provider === 'resend' ? 'resend' : hasDbValues ? 'mailflare' : envProvider,
          mailflareUrl: cleanStr(row.mailflare_url, 300).replace(/\/+$/, '') || envUrl,
          mailflareApiKey: cleanSecret(row.mailflare_api_key) || envKey,
          mailflareAdminKey: cleanSecret(row.mailflare_admin_key) || envAdminKey,
          mailboxId: cleanStr(row.mailbox_id, 200) || envMailboxId,
          fromName: cleanStr(row.from_name, 120) || envFromName,
          fromEmail: cleanStr(row.from_email, 200) || envFromEmail,
          replyTo: cleanStr(row.reply_to, 200) || envReplyTo,
          resendApiKey: cleanSecret(row.resend_api_key) || envResendKey,
          webhookSecret: cleanSecret(row.webhook_secret) || envWebhookSecret,
          source: hasDbValues ? 'database' : 'env',
        };
      }
    }
  } catch {
    // Fall back to environment variables
  }

  return {
    provider: envProvider,
    mailflareUrl: envUrl,
    mailflareApiKey: envKey,
    mailflareAdminKey: envAdminKey,
    mailboxId: envMailboxId,
    fromName: envFromName,
    fromEmail: envFromEmail,
    replyTo: envReplyTo,
    resendApiKey: envResendKey,
    webhookSecret: envWebhookSecret,
    source: 'env',
  };
}

function isConfigReady(cfg: EffectiveConfig): boolean {
  if (!EMAIL_RE.test(extractEmail(cfg.fromEmail))) return false;
  if (cfg.provider === 'resend') {
    return Boolean(cfg.resendApiKey);
  }
  return Boolean(cfg.mailflareUrl && cfg.mailflareApiKey && cfg.mailboxId);
}

function serializePublicConfig(cfg: EffectiveConfig, supabaseUrl: string) {
  const webhookBase = `${supabaseUrl}/functions/v1/customer-email?webhook=1`;
  return {
    provider: cfg.provider,
    mailflareUrl: cfg.mailflareUrl,
    mailboxId: cfg.mailboxId,
    fromName: cfg.fromName,
    fromEmail: cfg.fromEmail,
    replyTo: cfg.replyTo,
    hasMailflareKey: Boolean(cfg.mailflareApiKey),
    maskedMailflareKey: maskSecret(cfg.mailflareApiKey),
    hasMailflareAdminKey: Boolean(cfg.mailflareAdminKey),
    maskedMailflareAdminKey: maskSecret(cfg.mailflareAdminKey),
    hasResendKey: Boolean(cfg.resendApiKey),
    maskedResendKey: maskSecret(cfg.resendApiKey),
    hasWebhookSecret: Boolean(cfg.webhookSecret),
    maskedWebhookSecret: maskSecret(cfg.webhookSecret),
    inboundWebhookUrl: webhookBase,
    configured: isConfigReady(cfg),
    source: cfg.source,
  };
}

async function recordEmailLog(
  supabaseUrl: string,
  adminHeaders: Record<string, string>,
  entry: {
    recipient_email: string;
    recipient_name?: string | null;
    user_id?: string | null;
    lead_id?: string | null;
    from_address: string;
    subject: string;
    template_id?: string | null;
    provider: string;
    status: 'sent' | 'failed';
    provider_message_id?: string | null;
    error_message?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/customer_email_logs`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(entry),
    });
  } catch {
    // Non-fatal
  }
}

async function storeWebmailMessage(
  supabaseUrl: string,
  adminHeaders: Record<string, string>,
  msg: Record<string, unknown>,
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/admin_email_messages`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(msg),
    });
  } catch {
    // Non-fatal if table not mocked in unit test
  }
}

async function computeWebmailCounts(
  supabaseUrl: string,
  adminHeaders: Record<string, string>,
) {
  const counts = {
    inbox: 0,
    unread: 0,
    starred: 0,
    sent: 0,
    drafts: 0,
    archive: 0,
    spam: 0,
    trash: 0,
    byMailboxUnread: {} as Record<string, number>,
    byMailboxTotal: {} as Record<string, number>,
  };
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/admin_email_messages?select=folder,is_read,is_starred,mailbox_address&limit=1000`,
      { headers: adminHeaders },
    );
    if (!res.ok) return counts;
    const rows = await res.json();
    for (const r of Array.isArray(rows) ? rows : []) {
      const f = String(r.folder || 'inbox');
      const mbx = String(r.mailbox_address || '').toLowerCase();
      if (f === 'inbox') counts.inbox += 1;
      else if (f === 'sent') counts.sent += 1;
      else if (f === 'drafts') counts.drafts += 1;
      else if (f === 'archive') counts.archive += 1;
      else if (f === 'spam') counts.spam += 1;
      else if (f === 'trash') counts.trash += 1;

      if (r.is_starred && f !== 'trash') counts.starred += 1;
      if (!r.is_read && f === 'inbox') {
        counts.unread += 1;
        if (mbx) counts.byMailboxUnread[mbx] = (counts.byMailboxUnread[mbx] || 0) + 1;
      }
      if (mbx && f !== 'trash') {
        counts.byMailboxTotal[mbx] = (counts.byMailboxTotal[mbx] || 0) + 1;
      }
    }
  } catch {
    // Return zeroed counts
  }
  return counts;
}

async function dispatchSingleEmail(
  cfg: EffectiveConfig,
  allowLocal: boolean,
  params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
    text?: string;
    fromName?: string;
    fromEmail?: string;
    mailboxIdOverride?: string;
    replyTo?: string;
    inReplyTo?: string;
    references?: string | string[];
    attachments?: AttachmentPayload[];
  },
): Promise<{ ok: true; messageId: string; provider: 'mailflare' | 'resend'; fromHeader: string } | { ok: false; error: string; provider: 'mailflare' | 'resend'; fromHeader: string }> {
  const fromEmail = cleanStr(params.fromEmail, 200) || cfg.fromEmail;
  const fromName = cleanStr(params.fromName, 120) || cfg.fromName;
  const replyTo = cleanStr(params.replyTo, 200) || cfg.replyTo;
  const fromHeader = formatFromHeader(fromEmail, fromName);

  if (!EMAIL_RE.test(extractEmail(fromEmail))) {
    return { ok: false, error: 'Configure a valid custom sender email address (e.g. support@niknote.online)', provider: cfg.provider, fromHeader };
  }

  const html = params.html?.trim() || undefined;
  const text = params.text?.trim() || (html ? htmlToText(html) : undefined);
  if (!html && !text) {
    return { ok: false, error: 'Email message body cannot be empty', provider: cfg.provider, fromHeader };
  }

  if (cfg.provider === 'resend') {
    if (!cfg.resendApiKey) {
      return { ok: false, error: 'Resend API key is not configured yet. Open Settings to add your Resend API key or connect Mailflare.', provider: 'resend', fromHeader };
    }
    try {
      const resendBody: Record<string, unknown> = {
        from: fromHeader,
        to: params.to,
        subject: params.subject,
      };
      if (params.cc?.length) resendBody.cc = params.cc;
      if (params.bcc?.length) resendBody.bcc = params.bcc;
      if (replyTo && EMAIL_RE.test(extractEmail(replyTo))) resendBody.reply_to = extractEmail(replyTo);
      if (html) resendBody.html = html;
      if (text) resendBody.text = text;
      const customHeaders: Record<string, string> = {};
      if (params.inReplyTo) customHeaders['In-Reply-To'] = params.inReplyTo;
      if (params.references) {
        customHeaders['References'] = Array.isArray(params.references)
          ? params.references.join(' ')
          : params.references;
      }
      if (Object.keys(customHeaders).length > 0) resendBody.headers = customHeaders;
      if (params.attachments?.length) {
        resendBody.attachments = params.attachments.map((att) => ({
          filename: att.filename,
          content: att.contentBase64,
          content_type: att.type || 'application/octet-stream',
        }));
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.message === 'string'
          ? data.message
          : typeof data?.error === 'string'
            ? data.error
            : `Resend rejected request (${res.status})`;
        return { ok: false, error: msg, provider: 'resend', fromHeader };
      }
      return { ok: true, messageId: String(data?.id || 'resend_sent'), provider: 'resend', fromHeader };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not reach Resend API',
        provider: 'resend',
        fromHeader,
      };
    }
  }

  // Provider: Mailflare self-hosted / Cloudflare Worker API (POST /api/v1/send)
  const validOrigin = validateMailflareOrigin(cfg.mailflareUrl, allowLocal);
  if (!validOrigin.ok) {
    return { ok: false, error: validOrigin.error, provider: 'mailflare', fromHeader };
  }
  if (!cfg.mailflareApiKey) {
    return { ok: false, error: 'Mailflare API key is not configured yet. Open Domains & Settings to connect Mailflare or Resend.', provider: 'mailflare', fromHeader };
  }
  const effectiveMailboxId = cleanStr(params.mailboxIdOverride, 200) || cfg.mailboxId;
  if (!effectiveMailboxId) {
    return { ok: false, error: 'Mailflare Mailbox ID (mbx_...) is required by Mailflare POST /api/v1/send. Click Auto-Detect Mailboxes or enter your Mailbox ID in Settings.', provider: 'mailflare', fromHeader };
  }

  try {
    const mailflareBody: Record<string, unknown> = {
      mailboxId: effectiveMailboxId,
      from: fromHeader,
      to: params.to,
      subject: params.subject,
    };
    if (params.cc?.length) mailflareBody.cc = params.cc;
    if (params.bcc?.length) mailflareBody.bcc = params.bcc;
    if (html) mailflareBody.html = html;
    if (text) mailflareBody.text = text;
    if (params.inReplyTo) mailflareBody.inReplyTo = params.inReplyTo;
    if (params.references) mailflareBody.references = params.references;
    if (params.attachments?.length) {
      mailflareBody.attachments = params.attachments.map((att) => ({
        filename: att.filename,
        type: att.type || 'application/octet-stream',
        contentBase64: att.contentBase64,
      }));
    }

    const res = await fetch(`${validOrigin.origin}/api/v1/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.mailflareApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailflareBody),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = `Mailflare error (${res.status})`;
      if (typeof data?.error === 'string') {
        msg = data.error;
      } else if (data?.error?.fieldErrors) {
        const fields = Object.entries(data.error.fieldErrors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join('; ');
        if (fields) msg = fields;
      }
      return { ok: false, error: msg, provider: 'mailflare', fromHeader };
    }
    return {
      ok: true,
      messageId: String(data?.messageId || 'mailflare_sent'),
      provider: 'mailflare',
      fromHeader,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not reach Mailflare server',
      provider: 'mailflare',
      fromHeader,
    };
  }
}

function parseRecipientEntries(raw: unknown): string[] {
  const items = Array.isArray(raw)
    ? raw.map((v) => String(v || ''))
    : typeof raw === 'string'
      ? raw.split(/[,\n;]+/)
      : [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const addr = extractEmail(trimmed);
    if (!EMAIL_RE.test(addr) || seen.has(addr)) continue;
    seen.add(addr);
    valid.push(trimmed);
  }
  return valid;
}

async function lookupDohRecords(name: string, type: 'MX' | 'TXT'): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { Accept: 'application/dns-json' } },
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    return answers.map((a: any) => String(a?.data || '').replace(/^"+|"+$/g, '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const allowLocal = Deno.env.get('ALLOW_LOCAL_MAILFLARE') === '1';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return reply({ error: 'Customer email service unavailable' }, 503);
  }

  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  let body: Record<string, any> = {};
  try {
    const raw = await req.text();
    if (raw.length > 16 * 1024 * 1024) return reply({ error: 'Payload too large (max 16 MB)' }, 413);
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return reply({ error: 'Invalid JSON request body' }, 400);
  }

  const reqUrl = new URL(req.url);
  const isWebhookRequest = reqUrl.searchParams.get('webhook') === '1' || body.action === 'inbound_webhook';

  // PUBLIC INBOUND EMAIL WEBHOOK (verified via webhook_secret)
  if (isWebhookRequest) {
    const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
    const providedSecret =
      cleanSecret(req.headers.get('x-webhook-secret')) ||
      cleanSecret(reqUrl.searchParams.get('secret')) ||
      cleanSecret(body.secret);

    if (!cfg.webhookSecret || !timingSafeEqualStr(providedSecret, cfg.webhookSecret)) {
      return reply({ error: 'Invalid or missing webhook secret' }, 401);
    }

    const dataObj = body.data && typeof body.data === 'object' ? body.data : body;
    const rawFrom = cleanStr(dataObj.from || dataObj.fromAddr || dataObj.sender, 300);
    const fromEmail = extractEmail(rawFrom);
    if (!EMAIL_RE.test(fromEmail)) {
      return reply({ error: 'Invalid sender address in inbound payload' }, 400);
    }
    const fromName = cleanStr(dataObj.fromName, 120) || extractDisplayName(rawFrom) || fromEmail.split('@')[0];
    const toList = parseRecipientEntries(dataObj.to || dataObj.toAddr || dataObj.recipient || cfg.fromEmail).map(extractEmail);
    const targetAddr = toList[0] || extractEmail(cfg.fromEmail) || 'support@niknote.online';
    const subject = cleanStr(dataObj.subject, 500) || '(No subject)';
    const bodyHtml = typeof dataObj.html === 'string' ? dataObj.html.slice(0, 1_500_000) : '';
    const bodyText = typeof dataObj.text === 'string' ? dataObj.text.slice(0, 1_500_000) : bodyHtml ? htmlToText(bodyHtml) : '';

    // Match mailbox if present
    let matchedMailbox: any = null;
    try {
      const mbxRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_mailboxes?address=eq.${encodeURIComponent(targetAddr)}&limit=1`,
        { headers: adminHeaders },
      );
      if (mbxRes.ok) {
        const rows = await mbxRes.json();
        matchedMailbox = Array.isArray(rows) ? rows[0] : null;
      }
    } catch {
      // Proceed with targetAddr
    }

    await storeWebmailMessage(supabaseUrl, adminHeaders, {
      mailbox_id: matchedMailbox?.id || null,
      mailbox_address: matchedMailbox?.address || targetAddr,
      folder: 'inbox',
      direction: 'inbound',
      from_name: fromName,
      from_email: fromEmail,
      to_emails: toList.length ? toList : [targetAddr],
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      snippet: makeSnippet(bodyText, bodyHtml),
      is_read: false,
      is_starred: false,
      provider: 'webhook',
      provider_message_id: cleanStr(dataObj.messageId || dataObj.id, 200) || `wh_${randomHex(8)}`,
      delivery_status: 'received',
    });

    // Optional auto-responder & forwarding if outbound provider is configured
    if (matchedMailbox && !matchedMailbox.disabled && isConfigReady(cfg)) {
      if (matchedMailbox.auto_reply_enabled && matchedMailbox.auto_reply_body) {
        await dispatchSingleEmail(cfg, allowLocal, {
          to: [fromEmail],
          subject: cleanStr(matchedMailbox.auto_reply_subject, 250) || `Re: ${subject}`,
          text: String(matchedMailbox.auto_reply_body),
          fromEmail: matchedMailbox.address,
          fromName: matchedMailbox.display_name,
          mailboxIdOverride: matchedMailbox.mailflare_mailbox_id || undefined,
        });
      }
      if (matchedMailbox.forward_to && EMAIL_RE.test(extractEmail(matchedMailbox.forward_to))) {
        await dispatchSingleEmail(cfg, allowLocal, {
          to: [extractEmail(matchedMailbox.forward_to)],
          subject: `[Fwd: ${matchedMailbox.address}] ${subject}`,
          text: `Forwarded message from ${fromName} <${fromEmail}> to ${matchedMailbox.address}:\n\n${bodyText}`,
          html: bodyHtml || undefined,
          fromEmail: matchedMailbox.address,
          fromName: matchedMailbox.display_name,
          replyTo: fromEmail,
          mailboxIdOverride: matchedMailbox.mailflare_mailbox_id || undefined,
        });
      }
    }

    return reply({ ok: true, mailbox: matchedMailbox?.address || targetAddr });
  }

  // ADMIN AUTHENTICATION REQUIRED FOR ALL STUDIO / MANAGER ACTIONS
  const authCheck = await authorizeAdmin(req, supabaseUrl, anonKey, adminHeaders);
  if (!authCheck.ok) {
    return reply({ error: authCheck.error }, authCheck.status);
  }

  const action = cleanStr(body.action, 60);
  const payload = (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<string, any>;

  try {
    // 0. WORKSPACE SNAPSHOT (config + domains + mailboxes + folder counts)
    if (action === 'get_workspace') {
      let cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      // Auto-provision webhook secret if missing so inbound webhook works out of the box
      if (!cfg.webhookSecret) {
        const generated = `whsec_${randomHex(18)}`;
        try {
          await fetch(`${supabaseUrl}/rest/v1/mailflare_config?on_conflict=id`, {
            method: 'POST',
            headers: {
              ...adminHeaders,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({ id: 1, webhook_secret: generated, updated_at: new Date().toISOString() }),
          });
          cfg = { ...cfg, webhookSecret: generated };
        } catch {
          // Non-fatal
        }
      }

      const [domainsRes, mailboxesRes, counts] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/admin_email_domains?select=*&order=is_primary.desc,created_at.asc`, {
          headers: adminHeaders,
        }),
        fetch(`${supabaseUrl}/rest/v1/admin_mailboxes?select=*&order=is_default.desc,created_at.asc`, {
          headers: adminHeaders,
        }),
        computeWebmailCounts(supabaseUrl, adminHeaders),
      ]);

      const domains = domainsRes.ok ? await domainsRes.json() : [];
      const mailboxes = mailboxesRes.ok ? await mailboxesRes.json() : [];

      return reply({
        config: serializePublicConfig(cfg, supabaseUrl),
        webhookSecretPreview: cfg.webhookSecret
          ? `${supabaseUrl}/functions/v1/customer-email?webhook=1&secret=${cfg.webhookSecret}`
          : '',
        domains: Array.isArray(domains) ? domains : [],
        mailboxes: Array.isArray(mailboxes) ? mailboxes : [],
        counts,
      });
    }

    // 1. GET CONFIG (secrets masked)
    if (action === 'get_config') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      return reply({ config: serializePublicConfig(cfg, supabaseUrl) });
    }

    // 2. SAVE CONFIG
    if (action === 'save_config') {
      const current = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const provider: 'mailflare' | 'resend' = payload.provider === 'resend' ? 'resend' : 'mailflare';
      const mailflareUrl = cleanStr(payload.mailflareUrl, 300).replace(/\/+$/, '');
      if (provider === 'mailflare' && mailflareUrl) {
        const originCheck = validateMailflareOrigin(mailflareUrl, allowLocal);
        if (!originCheck.ok) return reply({ error: originCheck.error }, 400);
      }

      const fromEmail = cleanStr(payload.fromEmail, 200) || 'support@niknote.online';
      if (!EMAIL_RE.test(extractEmail(fromEmail))) {
        return reply({ error: 'Enter a valid custom sender email address (for example support@niknote.online)' }, 400);
      }

      const replyTo = cleanStr(payload.replyTo, 200);
      if (replyTo && !EMAIL_RE.test(extractEmail(replyTo))) {
        return reply({ error: 'Reply-To must be a valid email address or left blank' }, 400);
      }

      const nextMailflareKey = payload.clearMailflareKey
        ? ''
        : cleanSecret(payload.mailflareApiKey) || current.mailflareApiKey;
      const nextAdminKey = payload.clearMailflareAdminKey
        ? ''
        : cleanSecret(payload.mailflareAdminKey) || current.mailflareAdminKey;
      const nextResendKey = payload.clearResendKey
        ? ''
        : cleanSecret(payload.resendApiKey) || current.resendApiKey;
      const nextWebhookSecret = payload.rotateWebhookSecret
        ? `whsec_${randomHex(18)}`
        : current.webhookSecret || `whsec_${randomHex(18)}`;

      const row: Record<string, unknown> = {
        id: 1,
        provider,
        mailflare_url: mailflareUrl,
        mailflare_api_key: nextMailflareKey,
        mailflare_admin_key: nextAdminKey,
        mailbox_id: cleanStr(payload.mailboxId, 200),
        from_name: cleanStr(payload.fromName, 120) || 'NikNote',
        from_email: extractEmail(fromEmail),
        reply_to: replyTo ? extractEmail(replyTo) : '',
        resend_api_key: nextResendKey,
        updated_at: new Date().toISOString(),
      };
      if (current.webhookSecret || payload.rotateWebhookSecret) {
        row.webhook_secret = nextWebhookSecret;
      }

      const saveRes = await fetch(`${supabaseUrl}/rest/v1/mailflare_config?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...adminHeaders,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(row),
      });
      if (!saveRes.ok) {
        return reply({ error: 'Could not save Mailflare configuration' }, 503);
      }

      const updated = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      return reply({
        success: true,
        config: serializePublicConfig(updated, supabaseUrl),
        webhookSecretPreview: updated.webhookSecret
          ? `${supabaseUrl}/functions/v1/customer-email?webhook=1&secret=${updated.webhookSecret}`
          : '',
      });
    }

    // 2B. CUSTOM DOMAIN MANAGEMENT (list / add / verify DNS / delete)
    if (action === 'list_domains') {
      const res = await fetch(`${supabaseUrl}/rest/v1/admin_email_domains?select=*&order=is_primary.desc,created_at.asc`, {
        headers: adminHeaders,
      });
      if (!res.ok) return reply({ error: 'Could not load custom domains' }, 503);
      return reply({ domains: await res.json() });
    }

    if (action === 'add_domain') {
      const hostname = cleanStr(payload.hostname, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!HOSTNAME_RE.test(hostname)) {
        return reply({ error: 'Enter a valid domain hostname (for example niknote.online or mail.niknote.online)' }, 400);
      }
      const sendingProvider = payload.sendingProvider === 'resend' ? 'resend' : 'mailflare';
      const receivingProvider = payload.receivingProvider === 'webhook' ? 'webhook' : 'mailflare';
      const id = `dom_${hostname.replace(/[^a-z0-9]/g, '_').slice(0, 40)}_${randomHex(3)}`;

      let mailflareDomainId = '';
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      if (cfg.mailflareUrl && cfg.mailflareAdminKey) {
        const validOrigin = validateMailflareOrigin(cfg.mailflareUrl, allowLocal);
        if (validOrigin.ok) {
          try {
            const mfRes = await fetch(`${validOrigin.origin}/api/v1/domains`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${cfg.mailflareAdminKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                hostname,
                enableRouting: true,
                enableSending: true,
                sendingProvider: sendingProvider === 'resend' ? 'resend' : 'cloudflare',
              }),
            });
            if (mfRes.ok) {
              const mfData = await mfRes.json().catch(() => ({}));
              mailflareDomainId = cleanStr(mfData?.domain?.id || mfData?.id, 120);
            }
          } catch {
            // Local domain entry still saved
          }
        }
      }

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/admin_email_domains`, {
        method: 'POST',
        headers: {
          ...adminHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id,
          hostname,
          mailflare_domain_id: mailflareDomainId,
          sending_provider: sendingProvider,
          receiving_provider: receivingProvider,
          is_primary: false,
        }),
      });
      if (!insertRes.ok) {
        const errTxt = await insertRes.text();
        if (/duplicate|unique/i.test(errTxt)) {
          return reply({ error: `Domain ${hostname} is already added` }, 409);
        }
        return reply({ error: 'Could not save custom domain' }, 503);
      }
      const created = await insertRes.json();
      return reply({ success: true, domain: Array.isArray(created) ? created[0] : created });
    }

    if (action === 'verify_domain_dns') {
      const domainId = cleanStr(payload.domainId, 120);
      const hostnameInput = cleanStr(payload.hostname, 253).toLowerCase();
      if (!domainId && !hostnameInput) return reply({ error: 'domainId or hostname is required' }, 400);

      const queryFilter = domainId
        ? `id=eq.${encodeURIComponent(domainId)}`
        : `hostname=eq.${encodeURIComponent(hostnameInput)}`;
      const domRes = await fetch(`${supabaseUrl}/rest/v1/admin_email_domains?${queryFilter}&limit=1`, {
        headers: adminHeaders,
      });
      const domRows = domRes.ok ? await domRes.json() : [];
      const dom = Array.isArray(domRows) ? domRows[0] : null;
      const hostname = dom?.hostname || hostnameInput;
      if (!HOSTNAME_RE.test(hostname)) return reply({ error: 'Invalid domain hostname' }, 400);

      const [mxRecords, txtRecords, dmarcRecords] = await Promise.all([
        lookupDohRecords(hostname, 'MX'),
        lookupDohRecords(hostname, 'TXT'),
        lookupDohRecords(`_dmarc.${hostname}`, 'TXT'),
      ]);

      const mxVerified = mxRecords.length > 0;
      const spfVerified = txtRecords.some((r) => /v=spf1\b/i.test(r));
      const dmarcVerified = dmarcRecords.some((r) => /v=dmarc1\b/i.test(r));
      const dnsStatus = mxVerified && spfVerified
        ? 'verified'
        : mxVerified || spfVerified || dmarcVerified
          ? 'partial'
          : 'pending';

      const diagnostics = {
        mxRecords,
        spfRecords: txtRecords.filter((r) => /v=spf1\b/i.test(r)),
        dmarcRecords: dmarcRecords.filter((r) => /v=dmarc1\b/i.test(r)),
        checkedAt: new Date().toISOString(),
      };

      if (dom?.id) {
        await fetch(`${supabaseUrl}/rest/v1/admin_email_domains?id=eq.${encodeURIComponent(dom.id)}`, {
          method: 'PATCH',
          headers: {
            ...adminHeaders,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            dns_status: dnsStatus,
            mx_verified: mxVerified,
            spf_verified: spfVerified,
            dmarc_verified: dmarcVerified,
            dns_diagnostics: diagnostics,
            last_checked_at: diagnostics.checkedAt,
            updated_at: diagnostics.checkedAt,
          }),
        });
      }

      return reply({
        ok: true,
        hostname,
        dnsStatus,
        mxVerified,
        spfVerified,
        dmarcVerified,
        diagnostics,
      });
    }

    if (action === 'delete_domain') {
      const domainId = cleanStr(payload.domainId, 120);
      if (!domainId) return reply({ error: 'domainId is required' }, 400);
      if (domainId === 'dom_niknote_online') {
        return reply({ error: 'Primary domain niknote.online cannot be removed' }, 400);
      }
      await fetch(`${supabaseUrl}/rest/v1/admin_email_domains?id=eq.${encodeURIComponent(domainId)}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      return reply({ success: true });
    }

    // 2C. CUSTOM MAILBOX MANAGEMENT (list / create / update / delete)
    if (action === 'list_mailboxes') {
      const res = await fetch(`${supabaseUrl}/rest/v1/admin_mailboxes?select=*&order=is_default.desc,created_at.asc`, {
        headers: adminHeaders,
      });
      if (!res.ok) return reply({ error: 'Could not load custom mailboxes' }, 503);
      return reply({ mailboxes: await res.json() });
    }

    if (action === 'create_mailbox') {
      const localPart = cleanStr(payload.localPart, 64).toLowerCase().replace(/@.*$/, '');
      if (!LOCAL_PART_RE.test(localPart)) {
        return reply({ error: 'Mailbox username must start with a letter/number and contain only letters, numbers, dots, hyphens, or underscores' }, 400);
      }
      const domainId = cleanStr(payload.domainId, 120) || 'dom_niknote_online';
      const domRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_email_domains?id=eq.${encodeURIComponent(domainId)}&limit=1`,
        { headers: adminHeaders },
      );
      const domRows = domRes.ok ? await domRes.json() : [];
      const dom = Array.isArray(domRows) ? domRows[0] : null;
      if (!dom) return reply({ error: 'Selected custom domain was not found' }, 404);

      const hostname = String(dom.hostname).toLowerCase();
      const address = `${localPart}@${hostname}`;
      const displayName = cleanStr(payload.displayName, 120) || `NikNote (${localPart})`;
      const mailboxType = payload.mailboxType === 'shared' ? 'shared' : 'personal';
      const color = /^#[0-9a-f]{6}$/i.test(cleanStr(payload.color, 10)) ? cleanStr(payload.color, 10) : '#7c3aed';
      const signature = cleanStr(payload.signature, 2000);
      const forwardTo = cleanStr(payload.forwardTo, 200);
      if (forwardTo && !EMAIL_RE.test(extractEmail(forwardTo))) {
        return reply({ error: 'Forwarding address must be a valid email or left blank' }, 400);
      }

      // Optionally provision mailbox on connected Mailflare server too
      let mailflareMailboxId = cleanStr(payload.mailflareMailboxId, 120);
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      if (!mailflareMailboxId && cfg.mailflareUrl && cfg.mailflareAdminKey && dom.mailflare_domain_id) {
        const validOrigin = validateMailflareOrigin(cfg.mailflareUrl, allowLocal);
        if (validOrigin.ok) {
          try {
            const mfRes = await fetch(`${validOrigin.origin}/api/v1/mailboxes`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${cfg.mailflareAdminKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                domainId: dom.mailflare_domain_id,
                localPart,
                displayName,
                type: mailboxType === 'shared' ? 'personal' : mailboxType,
              }),
            });
            if (mfRes.ok) {
              const mfData = await mfRes.json().catch(() => ({}));
              mailflareMailboxId = cleanStr(mfData?.id, 120);
            }
          } catch {
            // Continue creating in NikNote DB
          }
        }
      }

      const id = `mbx_${localPart.replace(/[^a-z0-9]/g, '')}_${randomHex(3)}`;
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/admin_mailboxes`, {
        method: 'POST',
        headers: {
          ...adminHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id,
          domain_id: dom.id,
          local_part: localPart,
          hostname,
          address,
          display_name: displayName,
          mailbox_type: mailboxType,
          color,
          signature,
          forward_to: forwardTo ? extractEmail(forwardTo) : '',
          auto_reply_enabled: Boolean(payload.autoReplyEnabled),
          auto_reply_subject: cleanStr(payload.autoReplySubject, 250) || 'We received your email — NikNote Support',
          auto_reply_body: cleanStr(payload.autoReplyBody, 4000) || 'Thank you for reaching out to NikNote. Our team will reply shortly.',
          is_default: false,
          disabled: false,
          mailflare_mailbox_id: mailflareMailboxId,
        }),
      });
      if (!insertRes.ok) {
        const errTxt = await insertRes.text();
        if (/duplicate|unique/i.test(errTxt)) {
          return reply({ error: `Mailbox ${address} already exists` }, 409);
        }
        return reply({ error: 'Could not create mailbox' }, 503);
      }
      const created = await insertRes.json();
      return reply({ success: true, mailbox: Array.isArray(created) ? created[0] : created });
    }

    if (action === 'update_mailbox') {
      const mailboxId = cleanStr(payload.id || payload.mailboxId, 120);
      if (!mailboxId) return reply({ error: 'Mailbox ID is required' }, 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof payload.displayName === 'string') patch.display_name = cleanStr(payload.displayName, 120) || 'NikNote';
      if (typeof payload.mailboxType === 'string') patch.mailbox_type = payload.mailboxType === 'shared' ? 'shared' : 'personal';
      if (typeof payload.color === 'string' && /^#[0-9a-f]{6}$/i.test(payload.color)) patch.color = payload.color;
      if (typeof payload.signature === 'string') patch.signature = cleanStr(payload.signature, 2000);
      if (typeof payload.forwardTo === 'string') {
        const fwd = cleanStr(payload.forwardTo, 200);
        if (fwd && !EMAIL_RE.test(extractEmail(fwd))) {
          return reply({ error: 'Forwarding address must be a valid email or left blank' }, 400);
        }
        patch.forward_to = fwd ? extractEmail(fwd) : '';
      }
      if (typeof payload.autoReplyEnabled === 'boolean') patch.auto_reply_enabled = payload.autoReplyEnabled;
      if (typeof payload.autoReplySubject === 'string') patch.auto_reply_subject = cleanStr(payload.autoReplySubject, 250);
      if (typeof payload.autoReplyBody === 'string') patch.auto_reply_body = cleanStr(payload.autoReplyBody, 4000);
      if (typeof payload.disabled === 'boolean') patch.disabled = payload.disabled;
      if (typeof payload.mailflareMailboxId === 'string') patch.mailflare_mailbox_id = cleanStr(payload.mailflareMailboxId, 120);

      if (payload.isDefault === true) {
        await fetch(`${supabaseUrl}/rest/v1/admin_mailboxes?is_default=eq.true`, {
          method: 'PATCH',
          headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ is_default: false }),
        });
        patch.is_default = true;
      }

      const updRes = await fetch(`${supabaseUrl}/rest/v1/admin_mailboxes?id=eq.${encodeURIComponent(mailboxId)}`, {
        method: 'PATCH',
        headers: {
          ...adminHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      });
      if (!updRes.ok) return reply({ error: 'Could not update mailbox settings' }, 503);
      const updatedRows = await updRes.json();
      const updatedMbx = Array.isArray(updatedRows) ? updatedRows[0] : null;

      // Sync default sender into mailflare_config when promoted to default
      if (payload.isDefault === true && updatedMbx) {
        await fetch(`${supabaseUrl}/rest/v1/mailflare_config?on_conflict=id`, {
          method: 'POST',
          headers: {
            ...adminHeaders,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            id: 1,
            from_email: updatedMbx.address,
            from_name: updatedMbx.display_name,
            ...(updatedMbx.mailflare_mailbox_id ? { mailbox_id: updatedMbx.mailflare_mailbox_id } : {}),
            updated_at: new Date().toISOString(),
          }),
        });
      }

      return reply({ success: true, mailbox: updatedMbx });
    }

    if (action === 'delete_mailbox') {
      const mailboxId = cleanStr(payload.id || payload.mailboxId, 120);
      if (!mailboxId) return reply({ error: 'Mailbox ID is required' }, 400);

      const allRes = await fetch(`${supabaseUrl}/rest/v1/admin_mailboxes?select=id,is_default`, {
        headers: adminHeaders,
      });
      const allRows = allRes.ok ? await allRes.json() : [];
      if (Array.isArray(allRows) && allRows.length <= 1) {
        return reply({ error: 'Cannot delete the last remaining mailbox' }, 400);
      }

      await fetch(`${supabaseUrl}/rest/v1/admin_mailboxes?id=eq.${encodeURIComponent(mailboxId)}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      return reply({ success: true });
    }

    // 2D. WEBMAIL MESSAGE MANAGER (list / save_draft / update / bulk / sync_mailflare_inbox / simulate_inbound)
    if (action === 'list_messages') {
      const folder = cleanStr(payload.folder, 20).toLowerCase() || 'inbox';
      const mailboxAddress = cleanStr(payload.mailboxAddress, 200).toLowerCase();
      const searchQuery = cleanStr(payload.q, 200).toLowerCase();
      const limit = Math.min(Math.max(Number(payload.limit) || 60, 1), 150);

      const filters: string[] = [];
      if (folder === 'starred') {
        filters.push('is_starred=eq.true', 'folder=neq.trash');
      } else if (VALID_FOLDERS.has(folder)) {
        filters.push(`folder=eq.${encodeURIComponent(folder)}`);
      }
      if (mailboxAddress && mailboxAddress !== 'all') {
        filters.push(`mailbox_address=eq.${encodeURIComponent(mailboxAddress)}`);
      }

      const url = `${supabaseUrl}/rest/v1/admin_email_messages?select=*&${filters.join('&')}${filters.length ? '&' : ''}order=created_at.desc&limit=${limit}`;
      const [msgRes, counts] = await Promise.all([
        fetch(url, { headers: adminHeaders }),
        computeWebmailCounts(supabaseUrl, adminHeaders),
      ]);
      if (!msgRes.ok) return reply({ error: 'Could not load webmail messages' }, 503);
      let messages = await msgRes.json();
      messages = Array.isArray(messages) ? messages : [];

      if (searchQuery) {
        messages = messages.filter((m: any) => {
          const hay = `${m.subject || ''} ${m.from_email || ''} ${m.from_name || ''} ${(m.to_emails || []).join(' ')} ${m.snippet || ''}`.toLowerCase();
          return hay.includes(searchQuery);
        });
      }

      return reply({ messages, counts });
    }

    if (action === 'save_draft') {
      const draftId = cleanStr(payload.draftId, 60);
      const fromEmail = extractEmail(cleanStr(payload.fromEmail, 200) || 'support@niknote.online');
      const fromName = cleanStr(payload.fromName, 120) || 'NikNote Support';
      const toEmails = parseRecipientEntries(payload.to).map(extractEmail);
      const ccEmails = parseRecipientEntries(payload.cc).map(extractEmail);
      const bccEmails = parseRecipientEntries(payload.bcc).map(extractEmail);
      const subject = cleanStr(payload.subject, 500) || '(Draft — No subject)';
      const bodyHtml = typeof payload.html === 'string' ? payload.html.slice(0, 1_000_000) : '';
      const bodyText = typeof payload.text === 'string' ? payload.text.slice(0, 1_000_000) : '';

      const record = {
        mailbox_address: fromEmail,
        folder: 'drafts',
        direction: 'draft',
        from_name: fromName,
        from_email: fromEmail,
        to_emails: toEmails,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        snippet: makeSnippet(bodyText, bodyHtml),
        is_read: true,
        delivery_status: 'draft',
        updated_at: new Date().toISOString(),
      };

      if (draftId && /^[a-f0-9-]{36}$/i.test(draftId)) {
        const res = await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?id=eq.${draftId}`, {
          method: 'PATCH',
          headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(record),
        });
        if (!res.ok) return reply({ error: 'Could not update draft' }, 503);
        const rows = await res.json();
        return reply({ success: true, draft: Array.isArray(rows) ? rows[0] : rows });
      }

      const res = await fetch(`${supabaseUrl}/rest/v1/admin_email_messages`, {
        method: 'POST',
        headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(record),
      });
      if (!res.ok) return reply({ error: 'Could not save draft' }, 503);
      const rows = await res.json();
      return reply({ success: true, draft: Array.isArray(rows) ? rows[0] : rows });
    }

    if (action === 'update_message') {
      const id = cleanStr(payload.id, 60);
      if (!/^[a-f0-9-]{36}$/i.test(id)) return reply({ error: 'Valid message id is required' }, 400);

      if (payload.permanentDelete === true) {
        await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?id=eq.${id}`, {
          method: 'DELETE',
          headers: adminHeaders,
        });
        return reply({ success: true });
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof payload.isRead === 'boolean') patch.is_read = payload.isRead;
      if (typeof payload.isStarred === 'boolean') patch.is_starred = payload.isStarred;
      if (typeof payload.folder === 'string' && VALID_FOLDERS.has(payload.folder)) {
        patch.folder = payload.folder;
      }

      const res = await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return reply({ error: 'Could not update message' }, 503);
      const rows = await res.json();
      return reply({ success: true, message: Array.isArray(rows) ? rows[0] : null });
    }

    if (action === 'bulk_messages') {
      const op = cleanStr(payload.operation, 40);
      if (op === 'empty_trash') {
        await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?folder=eq.trash`, {
          method: 'DELETE',
          headers: adminHeaders,
        });
        return reply({ success: true });
      }

      const ids = (Array.isArray(payload.ids) ? payload.ids : [])
        .map((v: unknown) => cleanStr(v, 60))
        .filter((v: string) => /^[a-f0-9-]{36}$/i.test(v));
      if (ids.length === 0) return reply({ error: 'Select at least one message' }, 400);

      const idFilter = `id=in.(${ids.join(',')})`;
      if (op === 'delete_forever') {
        await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?${idFilter}`, {
          method: 'DELETE',
          headers: adminHeaders,
        });
        return reply({ success: true, count: ids.length });
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (op === 'mark_read') patch.is_read = true;
      else if (op === 'mark_unread') patch.is_read = false;
      else if (op === 'star') patch.is_starred = true;
      else if (op === 'unstar') patch.is_starred = false;
      else if (op.startsWith('move_') && VALID_FOLDERS.has(op.slice(5))) patch.folder = op.slice(5);
      else return reply({ error: `Unsupported bulk operation: ${op}` }, 400);

      await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?${idFilter}`, {
        method: 'PATCH',
        headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      return reply({ success: true, count: ids.length });
    }

    if (action === 'sync_mailflare_inbox') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const validOrigin = validateMailflareOrigin(cfg.mailflareUrl, allowLocal);
      if (!validOrigin.ok) return reply({ error: validOrigin.error }, 400);
      if (!cfg.mailflareApiKey) return reply({ error: 'Configure your Mailflare API key in Domains & Settings first' }, 400);

      const params = new URLSearchParams({ limit: '50' });
      if (cfg.mailboxId) params.set('mailboxId', cfg.mailboxId);
      const inboxRes = await fetch(`${validOrigin.origin}/api/v1/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${cfg.mailflareApiKey}` },
      });
      if (!inboxRes.ok) {
        return reply({ error: `Mailflare returned HTTP ${inboxRes.status}` }, 502);
      }
      const data = await inboxRes.json().catch(() => ({ messages: [] }));
      const remoteRows = Array.isArray(data?.messages) ? data.messages : [];
      let synced = 0;

      for (const m of remoteRows) {
        const providerMsgId = cleanStr(m?.id || m?.messageId, 200);
        if (!providerMsgId) continue;
        const inbound = m?.direction !== 'outbound';
        const fromAddr = extractEmail(String(m?.fromAddr || cfg.fromEmail));
        const toAddr = extractEmail(String(m?.toAddr || cfg.fromEmail));
        const res = await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?on_conflict=provider,provider_message_id`, {
          method: 'POST',
          headers: {
            ...adminHeaders,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=minimal',
          },
          body: JSON.stringify({
            mailbox_address: inbound ? toAddr : fromAddr,
            folder: inbound ? 'inbox' : 'sent',
            direction: inbound ? 'inbound' : 'outbound',
            from_name: extractDisplayName(String(m?.fromAddr || '')) || fromAddr.split('@')[0],
            from_email: fromAddr,
            to_emails: [toAddr],
            subject: cleanStr(m?.subject, 500) || '(No subject)',
            body_html: typeof m?.htmlBody === 'string' ? m.htmlBody : '',
            body_text: typeof m?.textBody === 'string' ? m.textBody : cleanStr(m?.snippet, 500),
            snippet: cleanStr(m?.snippet, 200) || makeSnippet(m?.textBody, m?.htmlBody),
            is_read: Boolean(m?.isRead ?? !inbound),
            is_starred: Boolean(m?.isStarred),
            provider: 'mailflare',
            provider_message_id: providerMsgId,
            delivery_status: inbound ? 'received' : 'sent',
            created_at: m?.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
          }),
        });
        if (res.ok) synced += 1;
      }

      return reply({ success: true, fetched: remoteRows.length, synced });
    }

    // 3. DISCOVER MAILBOXES FROM MAILFLARE
    if (action === 'discover_mailboxes') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const targetUrl = cleanStr(payload.mailflareUrl, 300) || cfg.mailflareUrl;
      const validOrigin = validateMailflareOrigin(targetUrl, allowLocal);
      if (!validOrigin.ok) return reply({ error: validOrigin.error }, 400);

      const adminKey = cleanSecret(payload.mailflareAdminKey) || cfg.mailflareAdminKey;
      const mailKey = cleanSecret(payload.mailflareApiKey) || cfg.mailflareApiKey;
      const discovered: Array<{ id: string; address: string; displayName?: string; type?: string }> = [];
      const seen = new Set<string>();

      const keysToTryForAdmin = [adminKey, mailKey].filter(Boolean);
      for (const key of keysToTryForAdmin) {
        try {
          const mbxRes = await fetch(`${validOrigin.origin}/api/v1/mailboxes`, {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (mbxRes.ok) {
            const mbxData = await mbxRes.json().catch(() => ({}));
            const rows = Array.isArray(mbxData?.mailboxes) ? mbxData.mailboxes : [];
            for (const m of rows) {
              if (m?.id && !seen.has(m.id)) {
                seen.add(m.id);
                discovered.push({
                  id: String(m.id),
                  address: m.localPart && m.hostname ? `${m.localPart}@${m.hostname}` : String(m.address || m.id),
                  displayName: m.displayName || undefined,
                  type: m.type || 'personal',
                });
              }
            }
            if (discovered.length > 0) break;
          }
        } catch {
          // Continue
        }
      }

      if (discovered.length === 0 && mailKey) {
        try {
          const msgRes = await fetch(`${validOrigin.origin}/api/v1/messages?limit=25`, {
            headers: { Authorization: `Bearer ${mailKey}` },
          });
          if (msgRes.ok) {
            const msgData = await msgRes.json().catch(() => ({}));
            const rows = Array.isArray(msgData?.messages) ? msgData.messages : [];
            for (const row of rows) {
              const id = typeof row?.mailboxId === 'string' ? row.mailboxId : '';
              if (id && !seen.has(id)) {
                seen.add(id);
                const candidateAddr = row.direction === 'outbound'
                  ? extractEmail(String(row.fromAddr || ''))
                  : extractEmail(String(row.toAddr || ''));
                discovered.push({
                  id,
                  address: EMAIL_RE.test(candidateAddr) ? candidateAddr : id,
                  type: 'personal',
                });
              }
            }
          }
        } catch {
          // Handled below
        }
      }

      return reply({
        mailboxes: discovered,
        message: discovered.length > 0
          ? `Found ${discovered.length} mailbox${discovered.length === 1 ? '' : 'es'} on Mailflare.`
          : 'Connected to server, but no mailboxes were auto-listed. Add an Admin API key with "mailboxes" scope or paste your Mailbox ID (mbx_...) directly.',
      });
    }

    // 4. TEST CONNECTION (and optional test email)
    if (action === 'test_connection') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const testRecipient = cleanStr(payload.testRecipient, 200);
      const started = Date.now();

      if (testRecipient) {
        if (!EMAIL_RE.test(extractEmail(testRecipient))) {
          return reply({ error: 'Enter a valid test recipient email address' }, 400);
        }
        const subject = `NikNote ✨ Handwritten Email Ready (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`;
        const html = `
          <div style="margin:0;padding:24px 12px;background:#f6f0e4;font-family:'Kalam','Caveat','Segoe Print','Bradley Hand',cursive,Georgia,serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;background:#fffdf7;border:1px solid #e7dcc8;border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px;border-bottom:2px solid #f5d0dc;background:#fffdf7;">
                  <img src="https://www.niknote.online/niknote-email-logo.png" alt="NikNote" width="160" height="39" style="display:block;width:160px;height:auto;border:0;" />
                </td>
              </tr>
              <tr>
                <td style="padding:24px 26px;background:#fffdf7;border-left:3px solid #f4afc0;">
                  <h2 style="margin:0 0 12px;color:#4c1d95;font-size:25px;">NikNote Custom Email Connected ✨</h2>
                  <p style="color:#1e293b;font-size:17px;line-height:1.8;margin:0 0 14px;">Your <strong>${escapeHtml(cfg.provider === 'mailflare' ? 'Mailflare' : 'Resend')}</strong> outbound pipeline is active and delivering aesthetic handwritten emails from <code>${escapeHtml(cfg.fromEmail)}</code>.</p>
                  <p style="color:#1e293b;font-size:17px;line-height:1.8;margin:0;">With warmth,<br /><strong>Team of NikNote</strong></p>
                </td>
              </tr>
            </table>
          </div>
        `.trim();

        const sendRes = await dispatchSingleEmail(cfg, allowLocal, {
          to: [extractEmail(testRecipient)],
          subject,
          html,
        });
        const latencyMs = Date.now() - started;

        await recordEmailLog(supabaseUrl, adminHeaders, {
          recipient_email: extractEmail(testRecipient),
          from_address: sendRes.fromHeader,
          subject,
          template_id: 'connection_test',
          provider: sendRes.provider,
          status: sendRes.ok ? 'sent' : 'failed',
          provider_message_id: sendRes.ok ? sendRes.messageId : null,
          error_message: sendRes.ok ? null : sendRes.error,
          metadata: { test: true, latencyMs },
        });

        if (!sendRes.ok) {
          return reply({ ok: false, latencyMs, error: sendRes.error }, 502);
        }
        return reply({
          ok: true,
          latencyMs,
          messageId: sendRes.messageId,
          detail: `Test email delivered to ${extractEmail(testRecipient)} (${latencyMs}ms)`,
        });
      }

      if (cfg.provider === 'resend') {
        if (!cfg.resendApiKey) {
          return reply({ ok: false, error: 'Resend API key is missing' }, 400);
        }
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${cfg.resendApiKey}` },
        });
        const latencyMs = Date.now() - started;
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = String(errData?.message || '');
          if (/restricted|only.*send/i.test(errMsg)) {
            return reply({
              ok: true,
              latencyMs,
              detail: `Resend sending-only API key verified (${latencyMs}ms). Enter a test recipient to verify live delivery.`,
            });
          }
          return reply({ ok: false, latencyMs, error: errMsg || 'Invalid Resend API key' }, 502);
        }
        return reply({
          ok: res.ok,
          latencyMs,
          detail: res.ok ? `Resend API reachable (${latencyMs}ms)` : `Resend status ${res.status}`,
        });
      }

      const validOrigin = validateMailflareOrigin(cfg.mailflareUrl, allowLocal);
      if (!validOrigin.ok) return reply({ ok: false, error: validOrigin.error }, 400);
      if (!cfg.mailflareApiKey) return reply({ ok: false, error: 'Mailflare API key is missing' }, 400);

      const probeRes = await fetch(`${validOrigin.origin}/api/v1/messages?limit=1`, {
        headers: { Authorization: `Bearer ${cfg.mailflareApiKey}` },
      });
      const latencyMs = Date.now() - started;
      if (probeRes.ok) {
        return reply({
          ok: true,
          latencyMs,
          detail: `Mailflare API connected (${latencyMs}ms)${cfg.mailboxId ? ` · Mailbox ${cfg.mailboxId}` : ' · Add Mailbox ID to enable sending'}`,
        });
      }
      if (probeRes.status === 401) {
        return reply({
          ok: false,
          latencyMs,
          error: 'Mailflare returned 401 Unauthorized. Ensure your Mailflare API key is valid.',
        }, 502);
      }
      return reply({
        ok: false,
        latencyMs,
        error: `Mailflare responded with HTTP ${probeRes.status}`,
      }, 502);
    }

    // 5. SEND SINGLE / MULTI-RECIPIENT CUSTOM EMAIL
    if (action === 'send_email') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const to = parseRecipientEntries(payload.to);
      const cc = parseRecipientEntries(payload.cc);
      const bcc = parseRecipientEntries(payload.bcc);
      const subject = cleanStr(payload.subject, 500);
      const html = typeof payload.html === 'string' ? payload.html.slice(0, 1_500_000) : undefined;
      const text = typeof payload.text === 'string' ? payload.text.slice(0, 1_500_000) : undefined;
      const templateId = cleanStr(payload.templateId, 80) || 'custom';
      const recipientName = cleanStr(payload.recipientName, 160) || null;
      const userId = /^[a-f0-9-]{36}$/i.test(cleanStr(payload.userId, 40)) ? cleanStr(payload.userId, 40) : null;
      const leadId = /^[a-f0-9-]{36}$/i.test(cleanStr(payload.leadId, 40)) ? cleanStr(payload.leadId, 40) : null;
      const draftId = /^[a-f0-9-]{36}$/i.test(cleanStr(payload.draftId, 40)) ? cleanStr(payload.draftId, 40) : null;

      if (to.length === 0) return reply({ error: 'At least one valid recipient email is required' }, 400);
      if (to.length + cc.length + bcc.length > 50) {
        return reply({ error: 'A single email can have at most 50 recipients' }, 400);
      }
      if (!subject) return reply({ error: 'Email subject is required' }, 400);

      const attachments: AttachmentPayload[] = Array.isArray(payload.attachments)
        ? payload.attachments
            .slice(0, 5)
            .filter((a: any) => a && typeof a.filename === 'string' && typeof a.contentBase64 === 'string')
            .map((a: any) => ({
              filename: cleanStr(a.filename, 200) || 'attachment',
              type: cleanStr(a.type, 120) || 'application/octet-stream',
              contentBase64: a.contentBase64,
            }))
        : [];

      const senderAddr = extractEmail(cleanStr(payload.fromEmail, 200) || cfg.fromEmail);
      const senderName = cleanStr(payload.fromName, 120) || cfg.fromName;

      const result = await dispatchSingleEmail(cfg, allowLocal, {
        to,
        cc,
        bcc,
        subject,
        html,
        text,
        fromName: payload.fromName,
        fromEmail: payload.fromEmail,
        mailboxIdOverride: cleanStr(payload.mailflareMailboxId, 120) || undefined,
        replyTo: payload.replyTo,
        inReplyTo: cleanStr(payload.inReplyTo, 998) || undefined,
        references: payload.references,
        attachments,
      });

      await recordEmailLog(supabaseUrl, adminHeaders, {
        recipient_email: to.map(extractEmail).join(', '),
        recipient_name: recipientName,
        user_id: userId,
        lead_id: leadId,
        from_address: result.fromHeader,
        subject,
        template_id: templateId,
        provider: result.provider,
        status: result.ok ? 'sent' : 'failed',
        provider_message_id: result.ok ? result.messageId : null,
        error_message: result.ok ? null : result.error,
        metadata: {
          ccCount: cc.length,
          bccCount: bcc.length,
          attachmentsCount: attachments.length,
        },
      });

      // Record in Sent folder inside Webmail Manager
      if (result.ok) {
        await storeWebmailMessage(supabaseUrl, adminHeaders, {
          mailbox_address: senderAddr,
          folder: 'sent',
          direction: 'outbound',
          from_name: senderName,
          from_email: senderAddr,
          to_emails: to.map(extractEmail),
          cc_emails: cc.map(extractEmail),
          bcc_emails: bcc.map(extractEmail),
          subject,
          body_html: html || '',
          body_text: text || (html ? htmlToText(html) : ''),
          snippet: makeSnippet(text, html),
          is_read: true,
          in_reply_to: cleanStr(payload.inReplyTo, 250),
          provider: result.provider,
          provider_message_id: result.messageId,
          delivery_status: 'sent',
          attachments_meta: attachments.map((a) => ({ filename: a.filename, type: a.type })),
        });
        if (draftId) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/admin_email_messages?id=eq.${draftId}`, {
              method: 'DELETE',
              headers: adminHeaders,
            });
          } catch {
            // Non-fatal
          }
        }
      }

      if (!result.ok) {
        return reply({ error: result.error }, 502);
      }
      return reply({
        success: true,
        messageId: result.messageId,
        provider: result.provider,
        from: result.fromHeader,
      });
    }

    // 6. SEND PERSONALIZED CAMPAIGN TO CUSTOMER SEGMENT (individual dispatch, max 50/batch)
    if (action === 'send_campaign') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const audience = cleanStr(payload.audience, 40) || 'custom';
      const subjectTemplate = cleanStr(payload.subject, 500);
      const htmlTemplate = typeof payload.html === 'string' ? payload.html.slice(0, 1_000_000) : '';
      const textTemplate = typeof payload.text === 'string' ? payload.text.slice(0, 1_000_000) : '';
      const templateId = cleanStr(payload.templateId, 80) || 'campaign';
      const maxRecipients = Math.min(Math.max(Number(payload.limit) || 50, 1), 50);

      if (!subjectTemplate) return reply({ error: 'Campaign subject is required' }, 400);
      if (!htmlTemplate && !textTemplate) return reply({ error: 'Campaign message body is required' }, 400);
      if (!isConfigReady(cfg)) {
        return reply({ error: 'Outbound email provider is not configured yet. Open Domains & Settings first.' }, 400);
      }

      type TargetCustomer = {
        email: string;
        name: string;
        plan: string;
        institution: string;
        userId: string | null;
        leadId: string | null;
      };

      const targets: TargetCustomer[] = [];
      const seenEmails = new Set<string>();

      if (audience === 'custom') {
        const list = Array.isArray(payload.recipients) ? payload.recipients : [];
        for (const item of list) {
          const email = extractEmail(String(item?.email || ''));
          if (!EMAIL_RE.test(email) || seenEmails.has(email)) continue;
          seenEmails.add(email);
          targets.push({
            email,
            name: cleanStr(item?.name, 120) || email.split('@')[0],
            plan: cleanStr(item?.plan, 40) || 'free',
            institution: cleanStr(item?.institution, 160),
            userId: /^[a-f0-9-]{36}$/i.test(cleanStr(item?.userId, 40)) ? cleanStr(item.userId, 40) : null,
            leadId: /^[a-f0-9-]{36}$/i.test(cleanStr(item?.leadId, 40)) ? cleanStr(item.leadId, 40) : null,
          });
          if (targets.length >= maxRecipients) break;
        }
      } else if (audience === 'institution_leads') {
        const leadsRes = await fetch(
          `${supabaseUrl}/rest/v1/sales_leads?select=id,name,email,institution&order=created_at.desc&limit=${maxRecipients}`,
          { headers: adminHeaders },
        );
        if (!leadsRes.ok) return reply({ error: 'Could not load institution leads' }, 503);
        const leads = await leadsRes.json();
        for (const lead of Array.isArray(leads) ? leads : []) {
          const email = extractEmail(String(lead?.email || ''));
          if (!EMAIL_RE.test(email) || seenEmails.has(email)) continue;
          seenEmails.add(email);
          targets.push({
            email,
            name: cleanStr(lead?.name, 120) || 'Educator',
            plan: 'institution_inquiry',
            institution: cleanStr(lead?.institution, 160),
            userId: null,
            leadId: typeof lead?.id === 'string' ? lead.id : null,
          });
        }
      } else if (audience === 'all_users' || audience === 'premium_users' || audience === 'free_users') {
        const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
          headers: adminHeaders,
        });
        if (!usersRes.ok) return reply({ error: 'Could not load customer accounts' }, 503);
        const usersPayload = await usersRes.json();
        const authUsers = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
        const [profilesRes, subsRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/profiles?select=user_id,display_name`, { headers: adminHeaders }),
          fetch(`${supabaseUrl}/rest/v1/user_subscriptions?select=user_id,plan_code,status,current_period_end`, { headers: adminHeaders }),
        ]);
        const profiles = profilesRes.ok ? await profilesRes.json() : [];
        const subs = subsRes.ok ? await subsRes.json() : [];
        const profileMap = new Map<string, string>(
          (Array.isArray(profiles) ? profiles : []).map((p: any) => [String(p.user_id), cleanStr(p.display_name, 120)]),
        );
        const now = Date.now();
        const subMap = new Map<string, string>();
        for (const s of Array.isArray(subs) ? subs : []) {
          const active = s?.status === 'active' || s?.status === 'trialing';
          const notExpired = !s?.current_period_end || new Date(s.current_period_end).getTime() > now;
          if (active && notExpired) {
            subMap.set(String(s.user_id), cleanStr(s.plan_code, 40) || 'premium');
          }
        }

        for (const u of authUsers) {
          if (u?.is_anonymous) continue;
          const email = extractEmail(String(u?.email || ''));
          if (!EMAIL_RE.test(email) || seenEmails.has(email)) continue;
          const uid = String(u.id);
          const plan = subMap.get(uid) || 'free';
          if (audience === 'premium_users' && plan === 'free') continue;
          if (audience === 'free_users' && plan !== 'free') continue;
          seenEmails.add(email);
          const name =
            profileMap.get(uid) ||
            cleanStr(u?.user_metadata?.full_name || u?.user_metadata?.name, 120) ||
            email.split('@')[0];
          targets.push({
            email,
            name,
            plan,
            institution: '',
            userId: uid,
            leadId: null,
          });
          if (targets.length >= maxRecipients) break;
        }
      } else {
        return reply({ error: `Unsupported audience: ${audience}` }, 400);
      }

      if (targets.length === 0) {
        return reply({ error: 'No matching customer email addresses found for the selected audience' }, 400);
      }

      let sentCount = 0;
      let failedCount = 0;
      const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = [];
      const senderAddr = extractEmail(cleanStr(payload.fromEmail, 200) || cfg.fromEmail);
      const senderName = cleanStr(payload.fromName, 120) || cfg.fromName;

      for (const customer of targets) {
        const vars = {
          name: customer.name,
          email: customer.email,
          plan: customer.plan,
          institution: customer.institution || 'your institution',
        };
        const personalizedSubject = interpolateTemplate(subjectTemplate, vars, false);
        const personalizedHtml = htmlTemplate ? interpolateTemplate(htmlTemplate, vars, true) : undefined;
        const personalizedText = textTemplate ? interpolateTemplate(textTemplate, vars, false) : undefined;

        const res = await dispatchSingleEmail(cfg, allowLocal, {
          to: [customer.email],
          subject: personalizedSubject,
          html: personalizedHtml,
          text: personalizedText,
          fromName: payload.fromName,
          fromEmail: payload.fromEmail,
          mailboxIdOverride: cleanStr(payload.mailflareMailboxId, 120) || undefined,
          replyTo: payload.replyTo,
        });

        await recordEmailLog(supabaseUrl, adminHeaders, {
          recipient_email: customer.email,
          recipient_name: customer.name,
          user_id: customer.userId,
          lead_id: customer.leadId,
          from_address: res.fromHeader,
          subject: personalizedSubject,
          template_id: templateId,
          provider: res.provider,
          status: res.ok ? 'sent' : 'failed',
          provider_message_id: res.ok ? res.messageId : null,
          error_message: res.ok ? null : res.error,
          metadata: { audience },
        });

        if (res.ok) {
          sentCount += 1;
          results.push({ email: customer.email, status: 'sent' });
          await storeWebmailMessage(supabaseUrl, adminHeaders, {
            mailbox_address: senderAddr,
            folder: 'sent',
            direction: 'outbound',
            from_name: senderName,
            from_email: senderAddr,
            to_emails: [customer.email],
            subject: personalizedSubject,
            body_html: personalizedHtml || '',
            body_text: personalizedText || (personalizedHtml ? htmlToText(personalizedHtml) : ''),
            snippet: makeSnippet(personalizedText, personalizedHtml),
            is_read: true,
            provider: res.provider,
            provider_message_id: res.messageId,
            delivery_status: 'sent',
          });
        } else {
          failedCount += 1;
          results.push({ email: customer.email, status: 'failed', error: res.error });
        }
      }

      return reply({
        success: sentCount > 0,
        sentCount,
        failedCount,
        totalRecipients: targets.length,
        results,
      });
    }

    // 7. LIST MAILFLARE INBOX / OUTBOUND MESSAGES (GET /api/v1/messages)
    if (action === 'list_inbox') {
      const cfg = await loadEffectiveConfig(supabaseUrl, adminHeaders);
      const validOrigin = validateMailflareOrigin(cfg.mailflareUrl, allowLocal);
      if (!validOrigin.ok) return reply({ error: validOrigin.error }, 400);
      if (!cfg.mailflareApiKey) return reply({ error: 'Configure your Mailflare API key first' }, 400);

      const params = new URLSearchParams();
      params.set('limit', String(Math.min(Math.max(Number(payload.limit) || 25, 1), 50)));
      if (payload.direction === 'inbound' || payload.direction === 'outbound') {
        params.set('direction', payload.direction);
      }
      if (cfg.mailboxId) {
        params.set('mailboxId', cfg.mailboxId);
      }
      const q = cleanStr(payload.q, 200);
      if (q) params.set('q', q);

      const inboxRes = await fetch(`${validOrigin.origin}/api/v1/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${cfg.mailflareApiKey}` },
      });
      if (!inboxRes.ok) {
        const errData = await inboxRes.json().catch(() => ({}));
        const msg = typeof errData?.error === 'string'
          ? errData.error
          : inboxRes.status === 401
            ? 'Mailflare API key needs the "read" scope to view inbox messages.'
            : `Mailflare returned HTTP ${inboxRes.status}`;
        return reply({ error: msg }, 502);
      }
      const data = await inboxRes.json().catch(() => ({ messages: [] }));
      return reply({ messages: Array.isArray(data?.messages) ? data.messages : [] });
    }

    // 8. LIST AUDIT LOGS
    if (action === 'list_logs') {
      const logsRes = await fetch(
        `${supabaseUrl}/rest/v1/customer_email_logs?select=id,recipient_email,recipient_name,from_address,subject,template_id,provider,status,provider_message_id,error_message,created_at&order=created_at.desc&limit=100`,
        { headers: adminHeaders },
      );
      if (!logsRes.ok) {
        return reply({ error: 'Could not load customer email delivery logs' }, 503);
      }
      const logs = await logsRes.json();
      const list = Array.isArray(logs) ? logs : [];
      const dayAgo = Date.now() - 86_400_000;
      return reply({
        logs: list,
        summary: {
          totalSent: list.filter((l: any) => l.status === 'sent').length,
          totalFailed: list.filter((l: any) => l.status === 'failed').length,
          last24hSent: list.filter(
            (l: any) => l.status === 'sent' && new Date(l.created_at).getTime() >= dayAgo,
          ).length,
        },
      });
    }

    return reply({ error: `Unknown action: ${action || '(empty)'}` }, 400);
  } catch (err) {
    return reply(
      { error: err instanceof Error ? err.message : 'Customer email request failed' },
      500,
    );
  }
});
