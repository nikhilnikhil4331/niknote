// A callback alone is not a sale. Both callback verification and recovery
// require an authenticated user, a provider-confirmed captured payment, the
// original order's user/plan notes, the fixed INR amount, and the atomic
// service-role-only activate_verified_purchase RPC.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const prices: Record<string, number> = { weekly: 4900, monthly: 9900 };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

async function validSignature(secret: string, orderId: string, paymentId: string, signature: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const raw = await crypto.subtle.sign('HMAC', key, encoder.encode(`${orderId}|${paymentId}`));
  const expected = Array.from(new Uint8Array(raw), (b) => b.toString(16).padStart(2, '0')).join('');
  const supplied = signature.toLowerCase();
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

function orderMatches(order: any, orderId: string, userId: string, planCode: string): boolean {
  const amount = prices[planCode];
  return Boolean(Object.hasOwn(prices, planCode) && amount && order?.id === orderId &&
    order.amount === amount && order.currency === 'INR' &&
    order.notes?.user_id === userId && order.notes?.plan_code === planCode);
}

function paymentMatches(payment: any, orderId: string, planCode: string): boolean {
  const amount = prices[planCode];
  return Boolean(amount && typeof payment?.id === 'string' && /^pay_[A-Za-z0-9]+$/.test(payment.id) &&
    payment.order_id === orderId && payment.status === 'captured' &&
    payment.amount === amount && payment.currency === 'INR' &&
    Number(payment.amount_refunded || 0) === 0 && !['partial', 'full'].includes(payment.refund_status));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
  if (!supabaseUrl || !anonKey || !serviceKey || !keyId.startsWith('rzp_live_') || !secret) {
    return reply({ error: 'Live payment verification is unavailable. If charged, do not pay again; contact support.' }, 503);
  }

  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ error: 'Unauthorized' }, 401);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
    if (!userRes.ok) return reply({ error: 'Unauthorized' }, 401);
    const user = await userRes.json();
    if (typeof user?.id !== 'string' || !user.id) return reply({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const providerHeaders = { Authorization: `Basic ${btoa(`${keyId}:${secret}`)}` };

    async function provider(path: string): Promise<any> {
      const res = await fetch(`https://api.razorpay.com/v1/${path}`, { headers: providerHeaders });
      if (!res.ok) throw new Error('Provider confirmation unavailable');
      return await res.json();
    }

    async function activate(payment: any, orderId: string, planCode: string): Promise<void> {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/activate_verified_purchase`, {
        method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _user_id: user.id, _payment_id: payment.id, _order_id: orderId,
          _plan_code: planCode, _amount_paise: prices[planCode],
        }),
      });
      if (!res.ok || await res.json().catch(() => null) !== true) throw new Error('Activation failed');
      // The RPC is idempotent even if this bookkeeping update fails.
      const mark = await fetch(`${supabaseUrl}/rest/v1/checkout_orders?order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'verified', verified_at: new Date().toISOString() }),
      });
      if (!mark.ok) console.error('Could not mark checkout order verified');
    }

    if (body?.recover === true) {
      // Stored server-created orders permit recovery even without a callback or
      // signature. Provider API authentication, order notes and captured status
      // are all checked again; the client cannot choose another user's order.
      const requestedOrderId = body?.orderId;
      if (requestedOrderId !== undefined && (typeof requestedOrderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(requestedOrderId))) {
        return reply({ error: 'Invalid order reference' }, 400);
      }
      const orderFilter = requestedOrderId
        ? `&order_id=eq.${encodeURIComponent(requestedOrderId)}`
        : '&order=created_at.desc&limit=10';
      const query = `${supabaseUrl}/rest/v1/checkout_orders?select=order_id,plan_code,amount_paise&user_id=eq.${encodeURIComponent(user.id)}&status=eq.created${orderFilter}`;
      const pendingRes = await fetch(query, { headers: adminHeaders });
      if (!pendingRes.ok) throw new Error('Pending orders unavailable');
      const pending = await pendingRes.json();
      if (!Array.isArray(pending)) throw new Error('Pending orders unavailable');
      const recovered: Array<{ paymentId: string; planCode: string }> = [];
      let incomplete = false;
      for (const record of pending) {
        const orderId = record?.order_id;
        const planCode = record?.plan_code;
        if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId) ||
            typeof planCode !== 'string' || !Object.hasOwn(prices, planCode) || record.amount_paise !== prices[planCode]) continue;
        try {
          const order = await provider(`orders/${encodeURIComponent(orderId)}`);
          if (!orderMatches(order, orderId, user.id, planCode)) continue;
          const paymentList = await provider(`orders/${encodeURIComponent(orderId)}/payments`);
          const payment = Array.isArray(paymentList?.items)
            ? paymentList.items.find((item: any) => paymentMatches(item, orderId, planCode))
            : null;
          if (!payment) continue;
          await activate(payment, orderId, planCode);
          recovered.push({ paymentId: payment.id, planCode });
        } catch (error) {
          console.error('Could not check one pending order', error);
          incomplete = true;
        }
      }
      if (recovered.length) return reply({ success: true, recovered, incomplete });
      if (incomplete) return reply({ error: 'Payment check is temporarily unavailable. If charged, do not pay again; retry or contact support.' }, 503);
      return reply({ success: false, code: 'no_captured_payment', message: 'No captured payment found yet. If charged, do not pay again; retry or contact support.' });
    }

    const orderId = body?.razorpay_order_id;
    const paymentId = body?.razorpay_payment_id;
    const signature = body?.razorpay_signature;
    const planCode = body?.planCode;
    if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId) ||
        typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
        typeof signature !== 'string' || typeof planCode !== 'string' || !Object.hasOwn(prices, planCode)) {
      return reply({ error: 'Invalid payment details' }, 400);
    }
    if (!await validSignature(secret, orderId, paymentId, signature)) return reply({ error: 'Payment verification failed' }, 400);
    const [order, payment] = await Promise.all([
      provider(`orders/${encodeURIComponent(orderId)}`), provider(`payments/${encodeURIComponent(paymentId)}`),
    ]);
    if (!orderMatches(order, orderId, user.id, planCode) || payment?.id !== paymentId) {
      return reply({ error: 'Purchase details do not match' }, 400);
    }
    if (!paymentMatches(payment, orderId, planCode)) {
      return reply({ error: 'Payment has not been confirmed as captured. If charged, do not pay again; retry verification.' }, 409);
    }
    await activate(payment, orderId, planCode);
    return reply({ success: true, planCode, periodDays: planCode === 'weekly' ? 7 : 30 });
  } catch (error) {
    console.error('Payment verification failed', error);
    return reply({ error: 'Payment could not be verified yet. If charged, do not pay again; retry or contact support.' }, 503);
  }
});
