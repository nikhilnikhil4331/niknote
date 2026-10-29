// The browser cannot choose the price or the owner of an order. Orders are
// persisted before Checkout opens so a captured payment can be recovered even
// when the browser never receives Razorpay's callback.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const prices: Record<string, number> = { weekly: 4900, monthly: 9900 };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
  const mode = keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'unconfigured';

  // This reveals no credential or account data; it describes configuration,
  // not provider validation or bank settlement.
  if (req.method === 'GET') {
    return reply({ mode, configured: Boolean(supabaseUrl && anonKey && serviceKey && keySecret && mode === 'live') });
  }
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (!supabaseUrl || !anonKey || !serviceKey || !keySecret || mode !== 'live') {
    return reply({ error: 'Live payments are not configured. No payment was attempted.' }, 503);
  }

  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ error: 'Unauthorized' }, 401);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    if (!userRes.ok) return reply({ error: 'Unauthorized' }, 401);
    const user = await userRes.json();
    if (typeof user?.id !== 'string' || !user.id) return reply({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const planCode = typeof body?.planCode === 'string' ? body.planCode : '';
    const amount = prices[planCode];
    if (!Object.hasOwn(prices, planCode) || !amount) return reply({ error: 'Invalid plan code' }, 400);

    const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const since = new Date(Date.now() - 60_000).toISOString();
    const existingUrl = `${supabaseUrl}/rest/v1/checkout_orders?select=order_id&user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(since)}&limit=5`;
    const existing = await fetch(existingUrl, { headers: adminHeaders });
    if (!existing.ok) return reply({ error: 'Checkout is temporarily unavailable. No payment was attempted.' }, 503);
    const recentOrders = await existing.json();
    if (!Array.isArray(recentOrders)) return reply({ error: 'Checkout is temporarily unavailable. No payment was attempted.' }, 503);
    if (recentOrders.length >= 5) return reply({ error: 'Too many checkout attempts. Please wait a minute.' }, 429);

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount, currency: 'INR', receipt: `nik_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: user.id, plan_code: planCode },
      }),
    });
    if (!orderRes.ok) return reply({ error: 'Payment provider could not create an order. No payment was attempted.' }, 502);
    const order = await orderRes.json();
    if (typeof order?.id !== 'string' || !/^order_[A-Za-z0-9]+$/.test(order.id) || order.amount !== amount || order.currency !== 'INR') {
      return reply({ error: 'Payment provider returned an invalid order. No payment was attempted.' }, 502);
    }

    const saved = await fetch(`${supabaseUrl}/rest/v1/checkout_orders`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ order_id: order.id, user_id: user.id, plan_code: planCode, amount_paise: amount }),
    });
    if (!saved.ok) return reply({ error: 'Checkout is temporarily unavailable. No payment was attempted.' }, 503);

    return reply({
      orderId: order.id, amount, currency: 'INR', keyId, planCode,
      planLabel: planCode === 'weekly' ? 'Weekly' : 'Monthly',
      userEmail: typeof user.email === 'string' ? user.email : '',
    });
  } catch (error) {
    console.error('Order creation failed', error);
    return reply({ error: 'Checkout is temporarily unavailable. No payment was attempted.' }, 503);
  }
});
