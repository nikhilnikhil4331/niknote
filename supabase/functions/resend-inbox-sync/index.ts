// Admin-only manual import of recent Resend inbound emails. No public webhook or secrets in the browser.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
const str = (v: unknown, n = 500) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const address = (v: unknown) => { const s = str(v, 300); return (s.match(/<([^<>]+)>/)?.[1] || s).trim().toLowerCase(); };
const list = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map(address).filter(Boolean);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!url || !serviceKey || !anonKey) return reply({ error: 'Inbox service unavailable' }, 503);
  const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    let allowed = false;
    const token = req.headers.get('x-admin-token') || '';
    if (token && token.length <= 256) {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const hex = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
      const sessions = await fetch(`${url}/rest/v1/admin_sessions?select=id&token_hash=eq.${hex}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`, { headers: adminHeaders });
      if (!sessions.ok) return reply({ error: 'Could not validate admin access' }, 503);
      allowed = (await sessions.json()).length === 1;
    }
    if (!allowed) {
      const auth = req.headers.get('authorization') || '';
      if (/^Bearer\s+\S+$/i.test(auth)) {
        const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } });
        if (userRes.ok) {
          const user = await userRes.json();
          if (typeof user?.id === 'string' && /^[a-f0-9-]{36}$/i.test(user.id)) {
            const roles = await fetch(`${url}/rest/v1/user_roles?select=id&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`, { headers: adminHeaders });
            if (!roles.ok) return reply({ error: 'Could not validate admin access' }, 503);
            allowed = (await roles.json()).length === 1;
          }
        }
      }
    }
    if (!allowed) return reply({ error: 'Admin access required' }, 403);

    const [configRes, mailboxRes] = await Promise.all([
      fetch(`${url}/rest/v1/mailflare_config?select=resend_api_key&id=eq.1&limit=1`, { headers: adminHeaders }),
      fetch(`${url}/rest/v1/admin_mailboxes?select=id,address,disabled&disabled=eq.false&limit=200`, { headers: adminHeaders }),
    ]);
    if (!configRes.ok || !mailboxRes.ok) return reply({ error: 'Could not load inbox configuration' }, 503);
    const config = await configRes.json();
    const boxes = await mailboxRes.json();
    const key = str(config?.[0]?.resend_api_key, 500) || str(Deno.env.get('RESEND_API_KEY'), 500);
    if (!key) return reply({ error: 'Configure a Resend API key in Email Manager first' }, 400);
    const mailboxes = new Map<string, string>(boxes.map((b: any) => [address(b.address), b.id]));
    const resendHeaders = { Authorization: `Bearer ${key}` };
    const indexRes = await fetch('https://api.resend.com/emails/receiving?limit=30', { headers: resendHeaders });
    if (!indexRes.ok) return reply({ error: indexRes.status === 401 || indexRes.status === 403 ? 'Resend API key cannot read received emails. Use a key with receiving read access.' : `Resend inbox unavailable (HTTP ${indexRes.status})` }, 502);
    const index = await indexRes.json();
    if (!Array.isArray(index?.data)) return reply({ error: 'Unexpected response from Resend inbox' }, 502);
    let saved = 0;
    let matched = 0;
    for (const item of index.data) {
      const id = str(item?.id, 100);
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) continue;
      // Fetch content only for messages addressed to a configured mailbox.
      const targets = [...new Set([...list(item.received_for), ...list(item.to), ...list(item.cc), ...list(item.bcc)])].filter(a => mailboxes.has(a));
      if (!targets.length) continue;
      const fullRes = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, { headers: resendHeaders });
      if (!fullRes.ok) return reply({ error: `Could not retrieve a received email (HTTP ${fullRes.status})` }, 502);
      const email = await fullRes.json();
      const from = address(email?.from);
      if (!from) continue;
      const text = typeof email.text === 'string' ? email.text.slice(0, 1500000) : '';
      const html = typeof email.html === 'string' ? email.html.slice(0, 1500000) : '';
      for (const target of targets) {
        matched += 1;
        const record = {
          mailbox_id: mailboxes.get(target), mailbox_address: target, folder: 'inbox', direction: 'inbound',
          from_email: from, from_name: str(email.from, 300).match(/^\s*"?([^"<>]+?)"?\s*</)?.[1]?.trim() || from,
          to_emails: list(email.to), cc_emails: list(email.cc), bcc_emails: [],
          subject: str(email.subject, 500) || '(No subject)', body_text: text, body_html: html,
          snippet: text.replace(/\s+/g, ' ').slice(0, 180), is_read: false, is_starred: false,
          provider: 'resend-inbound', provider_message_id: `${id}:${target}`,
          in_reply_to: str(email.message_id, 500), delivery_status: 'received',
          attachments_meta: Array.isArray(email.attachments) ? email.attachments.map((a: any) => ({ filename: str(a.filename, 200), type: str(a.content_type, 100) })) : [],
          created_at: !Number.isNaN(Date.parse(email.created_at)) ? new Date(email.created_at).toISOString() : new Date().toISOString(),
        };
        const inserted = await fetch(`${url}/rest/v1/admin_email_messages`, { method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(record) });
        if (inserted.status === 409) {
          const error = await inserted.json().catch(() => ({}));
          if (error?.code !== '23505') return reply({ error: 'Could not save received email' }, 503);
        } else if (!inserted.ok) return reply({ error: 'Could not save received email' }, 503);
        else saved += 1;
      }
    }
    return reply({ success: true, checked: index.data.length, matched, saved, limit: 30, hasMore: Boolean(index.has_more) });
  } catch {
    return reply({ error: 'Could not sync Resend inbox; please try again' }, 503);
  }
});
