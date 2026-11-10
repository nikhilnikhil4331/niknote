import { readFileSync } from 'node:fs';
import { createHmac, webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
type StoredOrder = { order_id: string; user_id: string; plan_code: string; amount_paise: number; status?: string };
type ProviderOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  notes: { user_id: string; plan_code: string };
};
type ProviderPayment = {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  amount_refunded: number;
  email?: string;
  created_at?: number;
  refund_status?: string | null;
};
type EmailPayload = Record<string, unknown>;

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECRET = 'test-secret-only';
const env: Record<string, string> = {
  SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  RAZORPAY_KEY_ID: 'rzp_live_mock', RAZORPAY_KEY_SECRET: SECRET,
  RAZORPAY_WEBHOOK_SECRET: 'webhook-test-secret', LOVABLE_API_KEY: 'lovable-test-key',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

function loadPaymentEmailHelper() {
  const source = readFileSync('supabase/functions/_shared/payment-confirmation-email.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function('exports', 'require', code)(exports, () => { throw new Error('Unexpected helper dependency'); });
  return exports;
}

async function loadHandler(file: string, fetcher: typeof fetch, overrides: Record<string, string> = {}): Promise<Handler> {
  const source = readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let handler: Handler | undefined;
  const deno = { env: { get: (key: string) => ({ ...env, ...overrides })[key] }, serve: (fn: Handler) => { handler = fn; } };
  const require = (id: string) => {
    if (id.includes('payment-confirmation-email')) return loadPaymentEmailHelper();
    throw new Error(`Unexpected Edge Function import: ${id}`);
  };
  new Function('Deno', 'fetch', 'crypto', 'btoa', 'Response', 'require', 'exports', code)(deno, fetcher, webcrypto, btoa, Response, require, {});
  if (!handler) throw new Error('Edge handler did not register');
  return handler;
}

function mockWorld() {
  const stored: StoredOrder[] = [];
  const providerOrders: Record<string, ProviderOrder> = {};
  const payments: Record<string, ProviderPayment> = {};
  const ledger = new Map<string, string>();
  const emailAttempts: Array<{ idempotencyKey: string | null; payload: EmailPayload }> = [];
  const deliveredEmails: Array<{ idempotencyKey: string | null; payload: EmailPayload }> = [];
  const deliveredEmailKeys = new Set<string>();
  let failSave = false;
  let failActivation = false;
  let failEmail = false;
  let orderNumber = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    const method = init.method || 'GET';
    if (url.hostname === 'api.lovable.dev' && url.pathname === '/v1/messaging/email/send' && method === 'POST') {
      if (headers.get('Authorization') !== 'Bearer lovable-test-key') throw new Error('Transactional mail key required');
      const payload = JSON.parse(String(init.body)) as EmailPayload;
      const idempotencyKey = headers.get('Idempotency-Key');
      emailAttempts.push({ idempotencyKey, payload });
      if (failEmail) return json({ error: 'mail provider unavailable' }, 503);
      if (idempotencyKey && !deliveredEmailKeys.has(idempotencyKey)) {
        deliveredEmailKeys.add(idempotencyKey);
        deliveredEmails.push({ idempotencyKey, payload });
      }
      return json({ success: true, message_id: `msg_${idempotencyKey || emailAttempts.length}` });
    }
    if (url.hostname === 'project.example' && url.pathname === '/auth/v1/user') {
      const token = headers.get('Authorization');
      if (token === 'Bearer user-a') return json({ id: USER_A, email: 'a@example.test', user_metadata: { full_name: 'A Student' } });
      if (token === 'Bearer user-b') return json({ id: USER_B, email: 'b@example.test', user_metadata: { full_name: 'Another Student' } });
      return json({ error: 'invalid' }, 401);
    }
    if (url.hostname === 'project.example' && url.pathname.startsWith('/auth/v1/admin/users/')) {
      if (headers.get('Authorization') !== 'Bearer service') throw new Error('Service key required');
      const userId = url.pathname.split('/').at(-1);
      if (userId === USER_A) return json({ id: USER_A, email: 'a@example.test', user_metadata: { full_name: 'A Student' } });
      if (userId === USER_B) return json({ id: USER_B, email: 'b@example.test', user_metadata: { full_name: 'Another Student' } });
      return json({ error: 'missing' }, 404);
    }
    if (url.hostname === 'api.razorpay.com' && url.pathname === '/v1/orders' && method === 'POST') {
      const request = JSON.parse(String(init.body)) as Omit<ProviderOrder, 'id'>;
      const id = `order_Test${++orderNumber}`;
      providerOrders[id] = { id, ...request };
      return json(providerOrders[id]);
    }
    if (url.hostname === 'project.example' && url.pathname === '/rest/v1/checkout_orders') {
      if (headers.get('Authorization') !== 'Bearer service') throw new Error('Service key required');
      if (method === 'POST') {
        if (failSave) return json({ error: 'offline' }, 503);
        stored.push({ ...JSON.parse(String(init.body)), status: 'created' });
        return new Response(null, { status: 201 });
      }
      const uid = url.searchParams.get('user_id')?.replace('eq.', '');
      const oid = url.searchParams.get('order_id')?.replace('eq.', '');
      if (method === 'PATCH') {
        for (const row of stored) if (row.user_id === uid && row.order_id === oid) row.status = 'verified';
        return new Response(null, { status: 204 });
      }
      const status = url.searchParams.get('status')?.replace('eq.', '');
      return json(stored.filter((row) => (!uid || row.user_id === uid) && (!oid || row.order_id === oid) && (!status || row.status === status)).slice(0, 10));
    }
    if (url.hostname === 'project.example' && url.pathname === '/rest/v1/rpc/activate_verified_purchase') {
      if (headers.get('Authorization') !== 'Bearer service') throw new Error('Service key required');
      if (failActivation) return json({ error: 'db unavailable' }, 500);
      const body = JSON.parse(String(init.body));
      const previous = ledger.get(body._payment_id);
      if (previous && previous !== body._user_id) return json({ error: 'replay' }, 400);
      ledger.set(body._payment_id, body._user_id);
      return json(true);
    }
    if (url.hostname === 'api.razorpay.com' && url.pathname.startsWith('/v1/orders/')) {
      const parts = url.pathname.split('/');
      const orderId = parts[3];
      if (parts[4] === 'payments') return json({ items: Object.values(payments).filter((payment) => payment.order_id === orderId) });
      return providerOrders[orderId] ? json(providerOrders[orderId]) : json({}, 404);
    }
    if (url.hostname === 'api.razorpay.com' && url.pathname.startsWith('/v1/payments/')) {
      const payment = payments[url.pathname.split('/')[3]];
      return payment ? json(payment) : json({}, 404);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  return { stored, providerOrders, payments, ledger, fetcher, emailAttempts, deliveredEmails,
    setFailSave: (value: boolean) => { failSave = value; },
    setFailActivation: (value: boolean) => { failActivation = value; },
    setFailEmail: (value: boolean) => { failEmail = value; },
  };
}

function post(body: unknown, token = 'user-a') {
  return new Request('https://edge.example', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function signature(orderId: string, paymentId: string) {
  return createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}
function razorpayWebhookRequest(event: unknown, signingSecret = 'webhook-test-secret') {
  const rawBody = JSON.stringify(event);
  const signature = createHmac('sha256', signingSecret).update(rawBody).digest('hex');
  return new Request('https://edge.example/razorpay-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
    body: rawBody,
  });
}
async function createOrder(world: ReturnType<typeof mockWorld>, token = 'user-a', planCode = 'weekly') {
  const handler = await loadHandler('supabase/functions/create-razorpay-order/index.ts', world.fetcher);
  const res = await handler(post({ planCode, amount: 1, user_id: USER_B }, token));
  expect(res.status).toBe(200);
  return await res.json() as { orderId: string; amount: number };
}
function capture(world: ReturnType<typeof mockWorld>, orderId: string, paymentId = 'pay_Test1', overrides: Record<string, unknown> = {}) {
  const order = world.providerOrders[orderId];
  if (!order) throw new Error(`Unknown mocked order: ${orderId}`);
  world.payments[paymentId] = {
    id: paymentId, order_id: orderId, status: 'captured', amount: order.amount, currency: 'INR',
    amount_refunded: 0, email: 'a@example.test', created_at: 1_790_000_000, ...overrides,
  };
}
function callback(orderId: string, paymentId = 'pay_Test1', planCode = 'weekly') {
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature(orderId, paymentId), planCode };
}

describe('payment confirmation email presentation', () => {
  it('uses the branded web fonts with safe fallbacks and keeps the receipt email responsive', () => {
    const buildEmail = loadPaymentEmailHelper().buildPaymentConfirmationEmail as (details: {
      customerName: string;
      planCode: 'weekly' | 'monthly';
      amountPaise: number;
      paymentId: string;
      transactionTimestamp?: number;
    }) => { html: string; text: string; subject: string };
    const { html, text } = buildEmail({
      customerName: 'NikNote Student',
      planCode: 'weekly',
      amountPaise: 4900,
      paymentId: 'pay_FontStyle1',
      transactionTimestamp: 1_790_000_000,
    });

    expect(html).toContain('fonts.googleapis.com/css2?family=Fredoka');
    expect(html).toContain('family=Inter:wght');
    expect(html).toContain("font-family:'Fredoka', 'Inter', 'Aptos', 'Segoe UI', Arial, sans-serif");
    expect(html).toContain("font-family:'Inter', 'Aptos', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif");
    expect(html).toContain('border-top:5px solid #3285F4');
    expect(html).toContain('nn-email-title');
    expect(text).toContain('Payment ID: pay_FontStyle1');
  });
});

describe('Razorpay edge functions (mock provider, no real payments)', () => {
  it('reports configuration without exposing credentials and refuses test mode', async () => {
    const world = mockWorld();
    const handler = await loadHandler('supabase/functions/create-razorpay-order/index.ts', world.fetcher, { RAZORPAY_KEY_ID: 'rzp_test_mock' });
    const status = await handler(new Request('https://edge.example'));
    expect(await status.json()).toEqual({ mode: 'test', configured: false });
    const response = await handler(post({ planCode: 'weekly' }));
    expect(response.status).toBe(503);
    expect(world.fetcher).not.toHaveBeenCalled();
  });

  it('requires an authenticated user and uses server-side prices and ownership', async () => {
    const world = mockWorld();
    const handler = await loadHandler('supabase/functions/create-razorpay-order/index.ts', world.fetcher);
    const unauthorized = await handler(post({ planCode: 'weekly' }, 'invalid'));
    expect(unauthorized.status).toBe(401);
    const order = await createOrder(world);
    expect(order.amount).toBe(4900);
    expect(world.providerOrders[order.orderId].notes).toEqual({ user_id: USER_A, plan_code: 'weekly' });
    expect(world.stored).toMatchObject([{ order_id: order.orderId, user_id: USER_A, amount_paise: 4900 }]);
  });

  it('never hands checkout to the client if the recoverable order cannot be saved', async () => {
    const world = mockWorld(); world.setFailSave(true);
    const handler = await loadHandler('supabase/functions/create-razorpay-order/index.ts', world.fetcher);
    const response = await handler(post({ planCode: 'weekly' }));
    expect(response.status).toBe(503);
    expect((await response.json()).orderId).toBeUndefined();
  });

  it('records only a signature-verified, captured purchase; retries are idempotent', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId);
    const verify = await loadHandler('supabase/functions/verify-razorpay-payment/index.ts', world.fetcher);
    const response = await verify(post(callback(order.orderId)));
    expect(await response.json()).toMatchObject({
      success: true, planCode: 'weekly', periodDays: 7, receiptSent: true,
      paymentId: 'pay_Test1', transactionReference: 'NN-pay_Test1',
    });
    expect(world.ledger.size).toBe(1);
    expect(world.stored[0].status).toBe('verified');
    expect(world.deliveredEmails).toHaveLength(1);
    expect(world.deliveredEmails[0].payload).toMatchObject({
      to: 'a@example.test', purpose: 'transactional', label: 'payment-confirmation',
      idempotency_key: 'niknote-payment-pay_Test1',
    });
    expect((await verify(post(callback(order.orderId)))).status).toBe(200);
    expect(world.ledger.size).toBe(1);
    expect(world.emailAttempts).toHaveLength(2);
    expect(world.emailAttempts[0].idempotencyKey).toBe(world.emailAttempts[1].idempotencyKey);
    expect(world.deliveredEmails).toHaveLength(1);
  });

  it('rejects tampered signatures, other users, wrong amounts and refunds', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId);
    const verify = await loadHandler('supabase/functions/verify-razorpay-payment/index.ts', world.fetcher);
    expect((await verify(post({ ...callback(order.orderId), razorpay_signature: '0'.repeat(64) }))).status).toBe(400);
    expect((await verify(post(callback(order.orderId), 'user-b'))).status).toBe(400);
    world.payments.pay_Test1.amount = 1;
    expect((await verify(post(callback(order.orderId)))).status).toBe(409);
    world.payments.pay_Test1.amount = 4900;
    world.payments.pay_Test1.amount_refunded = 4900;
    expect((await verify(post(callback(order.orderId)))).status).toBe(409);
    expect(world.ledger.size).toBe(0);
    expect(world.emailAttempts).toHaveLength(0);
  });

  it('recovers a captured payment without a callback, and never recovers another user’s order', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId, 'pay_Test1', { status: 'authorized' });
    const verify = await loadHandler('supabase/functions/verify-razorpay-payment/index.ts', world.fetcher);
    expect((await verify(post(callback(order.orderId)))).status).toBe(409);
    expect((await (await verify(post({ recover: true, orderId: order.orderId }, 'user-b'))).json()).success).toBe(false);
    world.payments.pay_Test1.status = 'captured';
    const recovered = await verify(post({ recover: true, orderId: order.orderId }));
    expect(await recovered.json()).toMatchObject({ success: true, recovered: [{ paymentId: 'pay_Test1', planCode: 'weekly' }] });
    expect(world.ledger.get('pay_Test1')).toBe(USER_A);
    expect(world.stored[0].status).toBe('verified');
    expect((await (await verify(post({ recover: true }))).json()).success).toBe(false);
    expect(world.ledger.size).toBe(1);
  });

  it('keeps a verified payment recoverable when email delivery fails, then retries idempotently', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId);
    world.setFailEmail(true);
    const verify = await loadHandler('supabase/functions/verify-razorpay-payment/index.ts', world.fetcher);
    const first = await verify(post(callback(order.orderId)));
    expect(await first.json()).toMatchObject({ success: true, receiptSent: false, paymentId: 'pay_Test1' });
    expect(world.ledger.size).toBe(1);
    expect(world.stored[0].status).toBe('created');
    expect(world.deliveredEmails).toHaveLength(0);

    world.setFailEmail(false);
    const retry = await verify(post({ recover: true }));
    expect(await retry.json()).toMatchObject({
      success: true,
      recovered: [{ paymentId: 'pay_Test1', planCode: 'weekly', receiptSent: true }],
      incomplete: false,
    });
    expect(world.ledger.size).toBe(1);
    expect(world.stored[0].status).toBe('verified');
    expect(world.deliveredEmails).toHaveLength(1);
  });

  it('fails closed if activation fails and can recover later without charging again', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId);
    world.setFailActivation(true);
    const verify = await loadHandler('supabase/functions/verify-razorpay-payment/index.ts', world.fetcher);
    expect((await verify(post(callback(order.orderId)))).status).toBe(503);
    expect(world.stored[0].status).toBe('created');
    expect(world.ledger.size).toBe(0);
    world.setFailActivation(false);
    expect((await (await verify(post({ recover: true }))).json()).success).toBe(true);
    expect(world.ledger.size).toBe(1);
  });

  it('verifies Razorpay payment.captured webhooks and sends one idempotent receipt', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId);
    const event = { event: 'payment.captured', payload: { payment: { entity: world.payments.pay_Test1 } } };
    const webhook = await loadHandler('supabase/functions/razorpay-webhook/index.ts', world.fetcher);

    const response = await webhook(razorpayWebhookRequest(event));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      received: true, verified: true, receiptSent: true,
      paymentId: 'pay_Test1', transactionReference: 'NN-pay_Test1',
    });
    expect(world.ledger.get('pay_Test1')).toBe(USER_A);
    expect(world.stored[0].status).toBe('verified');
    expect(world.deliveredEmails).toHaveLength(1);

    const replay = await webhook(razorpayWebhookRequest(event));
    expect(replay.status).toBe(200);
    expect(world.ledger.size).toBe(1);
    expect(world.emailAttempts).toHaveLength(2);
    expect(world.deliveredEmails).toHaveLength(1);
  });

  it('rejects unsigned webhook calls and retries signed events if the email provider is down', async () => {
    const world = mockWorld();
    const order = await createOrder(world);
    capture(world, order.orderId);
    const event = { event: 'payment.captured', payload: { payment: { entity: world.payments.pay_Test1 } } };
    const webhook = await loadHandler('supabase/functions/razorpay-webhook/index.ts', world.fetcher);
    const invalid = new Request('https://edge.example/razorpay-webhook', {
      method: 'POST', headers: { 'x-razorpay-signature': '0'.repeat(64) }, body: JSON.stringify(event),
    });
    expect((await webhook(invalid)).status).toBe(401);
    expect(world.ledger.size).toBe(0);
    expect(world.emailAttempts).toHaveLength(0);

    world.setFailEmail(true);
    expect((await webhook(razorpayWebhookRequest(event))).status).toBe(503);
    expect(world.ledger.size).toBe(1);
    expect(world.stored[0].status).toBe('created');
    world.setFailEmail(false);
    expect((await webhook(razorpayWebhookRequest(event))).status).toBe(200);
    expect(world.stored[0].status).toBe('verified');
    expect(world.deliveredEmails).toHaveLength(1);
  });
});
