import {
  type PaymentPlanCode,
  paymentReceiptCustomerName,
  paymentTransactionReference,
  resolvePaymentReceiptRecipient,
  sendPaymentConfirmationEmail,
} from '../_shared/payment-confirmation-email.ts';

const prices: Record<string, number> = { weekly: 4900, monthly: 9900 };
const MAX_BODY_BYTES = 256_000;
const reply = (body: unknown, status = 200) => Response.json(body, { status });
const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

async function readBoundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('Webhook body is too large');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

async function hasValidSignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const raw = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(raw), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const supplied = signature.toLowerCase();
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0;
}

function orderMatches(order: unknown, record: {
  order_id: string;
  user_id: string;
  plan_code: PaymentPlanCode;
  amount_paise: number;
}): boolean {
  const orderData = asRecord(order);
  const notes = asRecord(orderData.notes);
  return orderData.id === record.order_id && orderData.amount === record.amount_paise &&
    orderData.currency === 'INR' && notes.user_id === record.user_id &&
    notes.plan_code === record.plan_code;
}

function paymentMatches(payment: unknown, orderId: string, amountPaise: number): boolean {
  const paymentData = asRecord(payment);
  const refundStatus = paymentData.refund_status;
  return paymentData.order_id === orderId && typeof paymentData.id === 'string' &&
    /^pay_[A-Za-z0-9]+$/.test(paymentData.id) && paymentData.status === 'captured' &&
    paymentData.amount === amountPaise && paymentData.currency === 'INR' &&
    Number(paymentData.amount_refunded ?? 0) === 0 && refundStatus !== 'partial' && refundStatus !== 'full';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return reply({ error: 'Webhook body is too large' }, 413);

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
  if (!supabaseUrl || !serviceKey || !razorpayKeyId.startsWith('rzp_live_') || !razorpayKeySecret || !webhookSecret) {
    return reply({ error: 'Payment webhook is not configured' }, 503);
  }

  try {
    let rawBody: string;
    try { rawBody = await readBoundedBody(req); } catch { return reply({ error: 'Webhook body is too large' }, 413); }
    const signature = req.headers.get('x-razorpay-signature') || '';
    if (!await hasValidSignature(webhookSecret, rawBody, signature)) return reply({ error: 'Invalid webhook signature' }, 401);

    let eventValue: unknown;
    try { eventValue = JSON.parse(rawBody); } catch { return reply({ error: 'Invalid webhook payload' }, 400); }
    const event = asRecord(eventValue);
    if (event.event !== 'payment.captured') return reply({ received: true, ignored: true });

    const eventPayload = asRecord(event.payload);
    const paymentContainer = asRecord(eventPayload.payment);
    const eventPayment = asRecord(paymentContainer.entity);
    const paymentId = eventPayment.id;
    const orderId = eventPayment.order_id;
    if (typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
        typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId)) {
      return reply({ error: 'Invalid captured payment reference' }, 400);
    }

    const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const providerHeaders = { Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}` };
    async function provider(path: string): Promise<unknown> {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, { headers: providerHeaders });
      if (!response.ok) throw new Error('Razorpay could not confirm the captured payment');
      return await response.json();
    }

    const orderRowsResponse = await fetch(
      `${supabaseUrl}/rest/v1/checkout_orders?select=order_id,user_id,plan_code,amount_paise&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
      { headers: adminHeaders },
    );
    if (!orderRowsResponse.ok) throw new Error('Saved checkout order unavailable');
    const orderRows: unknown = await orderRowsResponse.json();
    if (!Array.isArray(orderRows)) throw new Error('Saved checkout order unavailable');
    if (orderRows.length === 0) return reply({ received: true, ignored: true });
    const record = asRecord(orderRows[0]);
    const planCodeValue = record.plan_code;
    if (typeof record.order_id !== 'string' || record.order_id !== orderId ||
        typeof record.user_id !== 'string' ||
        (planCodeValue !== 'weekly' && planCodeValue !== 'monthly') ||
        typeof record.amount_paise !== 'number' || record.amount_paise !== prices[planCodeValue]) {
      console.error('Captured payment does not match a valid NikNote checkout record');
      return reply({ received: true, ignored: true });
    }
    const planCode: PaymentPlanCode = planCodeValue;
    const amountPaise = prices[planCode];
    const userId = record.user_id;
    const checkoutRecord = { order_id: orderId, user_id: userId, plan_code: planCode, amount_paise: amountPaise };

    const [order, payment] = await Promise.all([
      provider(`orders/${encodeURIComponent(orderId)}`),
      provider(`payments/${encodeURIComponent(paymentId)}`),
    ]);
    const paymentData = asRecord(payment);
    if (!orderMatches(order, checkoutRecord) || paymentData.id !== paymentId ||
        !paymentMatches(paymentData, orderId, amountPaise)) {
      console.error('Razorpay captured payment did not pass server-side verification');
      return reply({ received: true, ignored: true });
    }

    const activation = await fetch(`${supabaseUrl}/rest/v1/rpc/activate_verified_purchase`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _user_id: userId,
        _payment_id: paymentId,
        _order_id: orderId,
        _plan_code: planCode,
        _amount_paise: amountPaise,
      }),
    });
    if (!activation.ok || await activation.json().catch(() => null) !== true) {
      throw new Error('Verified purchase activation failed');
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: adminHeaders,
    });
    if (!userResponse.ok) throw new Error('Payment recipient could not be resolved');
    const userPayload = asRecord(await userResponse.json());
    const user = asRecord(userPayload.user ?? userPayload);
    if (user.id !== userId) throw new Error('Payment recipient could not be resolved');
    const recipient = resolvePaymentReceiptRecipient(user, paymentData);
    if (!recipient) throw new Error('Payment receipt has no deliverable recipient');

    await sendPaymentConfirmationEmail(recipient, {
      customerName: paymentReceiptCustomerName(user, recipient),
      planCode,
      amountPaise,
      paymentId,
      transactionTimestamp: typeof paymentData.created_at === 'number' ? paymentData.created_at : undefined,
    }, {
      apiKey: Deno.env.get('LOVABLE_API_KEY') || '',
      sendUrl: Deno.env.get('LOVABLE_SEND_URL') || undefined,
      fetcher: fetch,
    });

    // A retried Razorpay event or browser recovery reuses the same payment ID;
    // the email provider also receives that stable key and will not duplicate it.
    const mark = await fetch(`${supabaseUrl}/rest/v1/checkout_orders?order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'verified', verified_at: new Date().toISOString() }),
    });
    if (!mark.ok) console.error('Could not mark checkout order verified after receipt send');

    return reply({
      received: true,
      verified: true,
      receiptSent: true,
      paymentId,
      transactionReference: paymentTransactionReference(paymentId),
    });
  } catch (error) {
    console.error('Razorpay webhook processing failed', error);
    // Razorpay retries non-2xx webhook deliveries.
    return reply({ error: 'Payment event could not be fully processed' }, 503);
  }
});
