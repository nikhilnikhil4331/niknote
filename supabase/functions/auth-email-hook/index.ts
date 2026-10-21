// Supabase "Send Email" auth hook — renders NikNote's own templates and hands
// them to a transactional email provider we control.
//
// Wiring (Supabase dashboard → Authentication → Hooks → Send Email):
//   1. Set the hook URL to this function.
//   2. Generate a webhook secret, put it here as AUTH_EMAIL_HOOK_SECRET (whsec_…).
//   3. Add RESEND_API_KEY (or EMAIL_API_KEY) for the provider, plus a verified
//      sender domain that matches AUTH_EMAIL_FROM.
//
// Requests are verified with the Standard Webhooks scheme (HMAC-SHA256 over
// `id.timestamp.payload`), so a forged POST cannot make us mail anyone.

import * as React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { SignupEmail } from '../_shared/email-templates/signup.tsx';
import { InviteEmail } from '../_shared/email-templates/invite.tsx';
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx';
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx';
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx';
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx';

const SITE_NAME = 'NikNote';
const ROOT_DOMAIN = 'niknote.online';
const SITE_URL = `https://${ROOT_DOMAIN}`;
const FROM_ADDRESS = Deno.env.get('AUTH_EMAIL_FROM') || `${SITE_NAME} <noreply@${ROOT_DOMAIN}>`;
const EMAIL_API_URL = Deno.env.get('EMAIL_API_URL') || 'https://api.resend.com/emails';
const EMAIL_API_KEY = Deno.env.get('RESEND_API_KEY') || Deno.env.get('EMAIL_API_KEY') || '';
const HOOK_SECRET = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
};

type EmailType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'reauthentication';

const SUBJECTS: Record<EmailType, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited to NikNote",
  magiclink: 'Your NikNote login link',
  recovery: 'Reset your NikNote password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Supabase's own verify endpoint accepts the token hash directly, so we do not
 *  need a custom /auth/confirm page in the SPA. */
function buildConfirmationUrl(emailData: Record<string, unknown>): string {
  const tokenHash = String(emailData.token_hash || '');
  const type = String(emailData.email_action_type || 'signup');
  const redirectTo = String(emailData.redirect_to || emailData.site_url || SITE_URL);
  if (!SUPABASE_URL || !tokenHash) return SITE_URL;
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo });
  return `${SUPABASE_URL}/auth/v1/verify?${params.toString()}`;
}

function buildEmail(type: EmailType, emailData: Record<string, unknown>, user: Record<string, unknown>) {
  const confirmationUrl = buildConfirmationUrl(emailData);
  const email = String(user.email || '');
  switch (type) {
    case 'signup':
      return React.createElement(SignupEmail, { siteName: SITE_NAME, siteUrl: SITE_URL, recipient: email, confirmationUrl });
    case 'invite':
      return React.createElement(InviteEmail, { siteName: SITE_NAME, siteUrl: SITE_URL, confirmationUrl });
    case 'magiclink':
      return React.createElement(MagicLinkEmail, { siteName: SITE_NAME, confirmationUrl });
    case 'recovery':
      return React.createElement(RecoveryEmail, { siteName: SITE_NAME, confirmationUrl });
    case 'email_change':
      return React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: email,
        email,
        newEmail: String(emailData.new_email || ''),
        confirmationUrl,
      });
    case 'reauthentication':
      return React.createElement(ReauthenticationEmail, { token: String(emailData.token || '') });
    default:
      return null;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Standard Webhooks verification (what Supabase signs auth hooks with). */
async function verifySignature(rawBody: string, headers: Headers): Promise<boolean> {
  if (!HOOK_SECRET) return false;
  const id = headers.get('webhook-id') || '';
  const timestamp = headers.get('webhook-timestamp') || '';
  const signatureHeader = headers.get('webhook-signature') || '';
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject replays older than five minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const secretBytes = base64ToBytes(HOOK_SECRET.replace(/^whsec_/, ''));
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed)));

  return signatureHeader
    .split(' ')
    .filter((part) => part.startsWith('v1,'))
    .some((part) => constantTimeEqual(base64ToBytes(part.slice(3)), expected));
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(EMAIL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EMAIL_API_KEY}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  const detail = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 300);
  return { ok: res.ok, status: res.status, detail };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(req.url);
  const rawBody = await req.text();

  if (!EMAIL_API_KEY) {
    console.error('auth-email-hook: no RESEND_API_KEY / EMAIL_API_KEY configured');
    return json({ error: 'email_provider_not_configured' }, 503);
  }

  // Template preview (dev convenience) — same secret as the hook, bearer form.
  if (url.pathname.endsWith('/preview')) {
    if (!HOOK_SECRET || req.headers.get('Authorization') !== `Bearer ${HOOK_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    let previewType = 'signup';
    try {
      previewType = String((JSON.parse(rawBody) as { type?: string }).type || 'signup');
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const template = buildEmail(previewType as EmailType, { token: '123456', token_hash: 'sample' }, { email: 'user@example.test' });
    if (!template) return json({ error: `Unknown email type: ${previewType}` }, 400);
    const html = await renderAsync(template);
    return new Response(html, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (!(await verifySignature(rawBody, req.headers))) {
    console.error('auth-email-hook: signature verification failed');
    return json({ error: 'invalid_signature' }, 401);
  }

  let payload: { user?: Record<string, unknown>; email_data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const user = payload.user || {};
  const emailData = payload.email_data || {};
  const email = String(user.email || emailData.email || '');
  const type = String(emailData.email_action_type || '') as EmailType;

  if (!email || !SUBJECTS[type]) {
    return json({ error: 'Unsupported email payload' }, 400);
  }

  const template = buildEmail(type, emailData, user);
  const html = await renderAsync(template);

  const result = await sendEmail(email, SUBJECTS[type], html);
  if (!result.ok) {
    console.error('auth-email-hook: provider rejected the message', result.status, result.detail);
    return json({ error: 'email_send_failed', status: result.status }, 502);
  }

  console.log(`auth-email-hook: sent ${type} to ${escapeHtml(email)}`);
  return json({ ok: true });
});
