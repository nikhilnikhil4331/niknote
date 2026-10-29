// Read-only owner dashboard: validate an admin session or a user with the
// admin role before using service-role access to the verified ledger and leads.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !anon || !service) return reply({ error: 'Sales dashboard unavailable' }, 503);
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };

  try {
    let authorized = false;
    const token = req.headers.get('x-admin-token') || '';
    if (token && token.length <= 256) {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const hex = Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('');
      const response = await fetch(`${url}/rest/v1/admin_sessions?select=id&token_hash=eq.${hex}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`, { headers: adminHeaders });
      if (!response.ok) return reply({ error: 'Could not validate admin access' }, 503);
      const rows = await response.json();
      authorized = Array.isArray(rows) && rows.length === 1;
    }
    if (!authorized) {
      const authorization = req.headers.get('Authorization') || '';
      if (/^Bearer\s+\S+$/i.test(authorization)) {
        const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization } });
        if (userRes.ok) {
          const user = await userRes.json();
          if (typeof user?.id === 'string' && /^[a-f0-9-]{36}$/i.test(user.id)) {
            const roleRes = await fetch(`${url}/rest/v1/user_roles?select=id&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`, { headers: adminHeaders });
            if (!roleRes.ok) return reply({ error: 'Could not validate admin access' }, 503);
            const roles = await roleRes.json();
            authorized = Array.isArray(roles) && roles.length === 1;
          }
        }
      }
    }
    if (!authorized) return reply({ error: 'Admin access required' }, 403);
    const dataRes = await fetch(`${url}/rest/v1/rpc/sales_overview`, {
      method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!dataRes.ok) return reply({ error: 'Sales dashboard unavailable' }, 503);
    const data = await dataRes.json();
    if (!data || typeof data !== 'object' || !Array.isArray(data.recentLeads)) return reply({ error: 'Sales dashboard unavailable' }, 503);
    return reply(data);
  } catch {
    return reply({ error: 'Sales dashboard unavailable' }, 503);
  }
});
