import { readFileSync } from 'node:fs';
import { createHmac, webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
type StoredOrder = { order_id: string; user_id: string; plan_code: string; amount_paise: number; status?: string };

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECRET = 'test-secret-only';
const env: Record<string, string> = {
  SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  RAZORPAY_KEY_ID: 'rzp_live_mock', RAZORPAY_KEY_SECRET: SECRET,
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

async function loadHandler(file: string, fetcher: typeof fetch, overrides: Record<string, string> = {}): Promise<Handler> {
  const source = readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let handler: Handler | undefined;
  const deno = { env: { get: (key: string) => ({ ...env, ...overrides })[key] }, serve: (fn: Handler) => { handler = fn; } };
  new Function('Deno', 'fetch', 'crypto', 'btoa', 'Response', code)(deno, fetcher, webcrypto, btoa, Response);
  if (!handler) throw new Error('Edge handler did not register');
  return handler;
}

function mockWorld() {
  const stored: StoredOrder[] = [];
  const providerOrders: Record<string, any> = {};
  const payments: Record<string, any> = {};
  const ledger = new Map<string, string>();
  let failSave = false;
  let failActivation = false;
  let orderNumber = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    const method = init.method || 'GET';
    if (url.hostname === 'project.example' && url.pathname === '/auth/v1/user') {
      const token = headers.get('Authorization');
      if (token === 'Bearer user-a') return json({ id: USER_A, email: 'a@example.test' });
      if (token === 'Bearer user-b') return json({ id: USER_B, email: 'b@example.test' });
      return json({ error: 'invalid' }, 401);
    }
    if (url.hostname === 'api.razorpay.com' && url.pathname === '/v1/orders' && method === 'POST') {
      const request = JSON.parse(String(init.body));
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
      return json(stored.filter((row) => row.user_id === uid && (!oid || row.order_id === oid) && (!status || row.status === status)).slice(0, 10));
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
      if (parts[4] === 'payments') return json({ items: Object.values(payments).filter((p: any) => p.order_id === orderId) });
      return providerOrders[orderId] ? json(providerOrders[orderId]) : json({}, 404);
    }
    if (url.hostname === 'api.razorpay.com' && url.pathname.startsWith('/v1/payments/')) {
      const payment = payments[url.pathname.split('/')[3]];
      return payment ? json(payment) : json({}, 404);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  return { stored, providerOrders, payments, ledger, fetcher,
    setFailSave: (value: boolean) => { failSave = value; },
    setFailActivation: (value: boolean) => { failActivation = value; },
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
async function createOrder(world: ReturnType<typeof mockWorld>, token = 'user-a', planCode = 'weekly') {
  const handler = await loadHandler('supabase/functions/create-razorpay-order/index.ts', world.fetcher);
  const res = await handler(post({ planCode, amount: 1, user_id: USER_B }, token));
  expect(res.status).toBe(200);
  return await res.json();
}
function capture(world: ReturnType<typeof mockWorld>, orderId: string, paymentId = 'pay_Test1', overrides: Record<string, unknown> = {}) {
  const order = world.providerOrders[orderId];
  world.payments[paymentId] = { id: paymentId, order_id: orderId, status: 'captured', amount: order.amount, currency: 'INR', amount_refunded: 0, ...overrides };
}
function callback(orderId: string, paymentId = 'pay_Test1', planCode = 'weekly') {
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature(orderId, paymentId), planCode };
}

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
    expect(await response.json()).toMatchObject({ success: true, planCode: 'weekly', periodDays: 7 });
    expect(world.ledger.size).toBe(1);
    expect(world.stored[0].status).toBe('verified');
    expect((await verify(post(callback(order.orderId)))).status).toBe(200);
    expect(world.ledger.size).toBe(1);
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
});
