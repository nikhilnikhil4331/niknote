import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLimitedJson, requireAIUser } from '../../supabase/functions/_shared/aiSecurity';

const cors = { 'Access-Control-Allow-Origin': '*' };
const url = 'https://unit-test.supabase.co';

function request(token = 'user-token') {
  return new Request('https://edge.test/ai', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('shared AI edge security', () => {
  type DenoMock = { env: { get: (name: string) => string | undefined } };
  const runtime = globalThis as typeof globalThis & { Deno?: DenoMock };
  const originalFetch = globalThis.fetch;
  const originalDeno = runtime.Deno;

  beforeEach(() => {
    const values: Record<string, string> = { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'public-anon-key' };
    runtime.Deno = { env: { get: (name) => values[name] } };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalDeno === undefined) Reflect.deleteProperty(runtime, 'Deno');
    else runtime.Deno = originalDeno;
    vi.restoreAllMocks();
  });

  it('requires a user bearer token before making any Supabase request', async () => {
    const fetcher = vi.fn();
    globalThis.fetch = fetcher as unknown as typeof fetch;
    const result = await requireAIUser(new Request('https://edge.test/ai', { method: 'POST' }), cors);
    expect('response' in result && result.response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('verifies the user, then consumes a fixed 30-per-hour quota', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      calls.push({ url: target, init });
      if (target.endsWith('/auth/v1/user')) return Response.json({ id: 'user-123' });
      return Response.json([{ allowed: true, used: 1, remaining: 29, reset_at: '2026-11-04T12:00:00Z' }]);
    }) as unknown as typeof fetch;

    const result = await requireAIUser(request(), cors);
    expect('userId' in result && result.userId).toBe('user-123');
    expect(calls.map((call) => call.url)).toEqual([
      `${url}/auth/v1/user`,
      `${url}/rest/v1/rpc/consume_ai_quota`,
    ]);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ p_limit: 30, p_window_seconds: 3600 });
    expect(new Headers(calls[1].init?.headers).get('authorization')).toBe('Bearer user-token');
  });

  it('fails closed if quota storage is unavailable and returns 429 when exhausted', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/v1/user')
        ? Response.json({ id: 'user-123' })
        : Response.json({ error: 'unavailable' }, { status: 500 })
    ) as unknown as typeof fetch;
    const unavailable = await requireAIUser(request(), cors);
    expect('response' in unavailable && unavailable.response.status).toBe(503);

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/v1/user')
        ? Response.json({ id: 'user-123' })
        : Response.json([{ allowed: false, reset_at: new Date(Date.now() + 60_000).toISOString() }])
    ) as unknown as typeof fetch;
    const limited = await requireAIUser(request(), cors);
    expect('response' in limited && limited.response.status).toBe(429);
    expect('response' in limited && limited.response.headers.get('Retry-After')).toBeTruthy();
  });

  it('bounds JSON reads even when a request omits Content-Length', async () => {
    const tooLarge = await readLimitedJson(
      new Request('https://edge.test/ai', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(128) }) }),
      64
    );
    expect(tooLarge).toEqual({ ok: false, reason: 'too_large' });

    const valid = await readLimitedJson(
      new Request('https://edge.test/ai', { method: 'POST', body: JSON.stringify({ text: 'hello' }) }),
      128
    );
    expect(valid).toEqual({ ok: true, value: { text: 'hello' } });
  });
});
