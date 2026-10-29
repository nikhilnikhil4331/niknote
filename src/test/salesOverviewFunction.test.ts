import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
const json = (value: unknown, status = 200) => Response.json(value, { status });
function setup(opts: { tokenValid?: boolean; roleValid?: boolean; rpcFails?: boolean } = {}) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (url.pathname === '/rest/v1/admin_sessions') {
      if (headers.get('Authorization') !== 'Bearer service') throw new Error('No service role');
      return json(opts.tokenValid ? [{ id: 'valid-admin-session' }] : []);
    }
    if (url.pathname === '/auth/v1/user') return headers.get('Authorization') === 'Bearer user' ? json({ id: 'd6f42a27-971c-4b67-9035-e213db82e73e' }) : json({}, 401);
    if (url.pathname === '/rest/v1/user_roles') return json(opts.roleValid ? [{ id: 'valid-admin-role' }] : []);
    if (url.pathname === '/rest/v1/rpc/sales_overview') return opts.rpcFails ? json({}, 500) : json({ verifiedPayments: 1, grossVerifiedPaise: 4900, institutionLeads: 0, recentLeads: [] });
    throw new Error(`Unexpected ${url}`);
  });
  const source = readFileSync('supabase/functions/sales-overview/index.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let handler: Handler | undefined;
  const env: Record<string, string> = { SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' };
  new Function('Deno', 'fetch', 'crypto', 'Response', code)(
    { env: { get: (key: string) => env[key] }, serve: (h: Handler) => { handler = h; } }, fetcher, webcrypto, Response,
  );
  return { handler: handler!, fetcher };
}
const post = (headers: Record<string, string> = {}) => new Request('https://edge.example', { method: 'POST', headers });

describe('sales overview authorization (mock database)', () => {
  it('never exposes sales or lead records to an unauthenticated caller', async () => {
    const w = setup();
    expect((await w.handler(post())).status).toBe(403);
    expect(w.fetcher.mock.calls.some(([url]) => String(url).includes('/rpc/sales_overview'))).toBe(false);
  });
  it('rejects expired admin tokens and regular users', async () => {
    const w = setup();
    expect((await w.handler(post({ 'x-admin-token': 'invalid', Authorization: 'Bearer user' }))).status).toBe(403);
    expect(w.fetcher.mock.calls.some(([url]) => String(url).includes('/rpc/sales_overview'))).toBe(false);
  });
  it('accepts a validated admin session, hashes its token, and returns the actual ledger response', async () => {
    const w = setup({ tokenValid: true });
    const res = await w.handler(post({ 'x-admin-token': 'admin-token' }));
    expect(await res.json()).toMatchObject({ verifiedPayments: 1, grossVerifiedPaise: 4900 });
    const firstUrl = String(w.fetcher.mock.calls[0][0]);
    expect(firstUrl).toContain('token_hash=eq.');
    expect(firstUrl).not.toContain('admin-token');
  });
  it('accepts an authenticated user only when the server confirms the admin role', async () => {
    const w = setup({ roleValid: true });
    expect((await w.handler(post({ Authorization: 'Bearer user' }))).status).toBe(200);
  });
  it('reports database failures instead of displaying zero as fact', async () => {
    const w = setup({ tokenValid: true, rpcFails: true });
    const res = await w.handler(post({ 'x-admin-token': 'admin-token' }));
    expect(res.status).toBe(503);
    expect((await res.json()).verifiedPayments).toBeUndefined();
  });
});
