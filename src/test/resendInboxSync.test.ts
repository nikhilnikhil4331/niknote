import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
const json = (body: unknown, status = 200) => Response.json(body, { status });
function setup({ authorized = true, forbidden = false }: { authorized?: boolean; forbidden?: boolean } = {}) {
  let handler!: Handler;
  const stored: Array<Record<string, unknown>> = [];
  const fetcher = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    if (url.pathname === '/rest/v1/admin_sessions') return json(authorized ? [{ id: 'session' }] : []);
    if (url.pathname === '/rest/v1/mailflare_config') return json([{ resend_api_key: 'test-key' }]);
    if (url.pathname === '/rest/v1/admin_mailboxes') return json([{ id: 'support', address: 'support@niknote.online', disabled: false }]);
    if (url.origin === 'https://api.resend.com' && url.pathname === '/emails/receiving') {
      if (forbidden) return json({}, 403);
      return json({ has_more: false, data: [{ id: 'abc-123', to: ['support@niknote.online'] }, { id: 'other-123', to: ['private@example.com'] }] });
    }
    if (url.origin === 'https://api.resend.com' && url.pathname === '/emails/receiving/abc-123') {
      return json({ from: '"Someone" <person@example.com>', to: ['support@niknote.online'], subject: 'Hello', text: 'Test only', message_id: '<message@example.com>', created_at: '2026-11-01T00:00:00Z' });
    }
    if (url.pathname === '/rest/v1/admin_email_messages') {
      const row = JSON.parse(String(init.body));
      if (stored.some(x => x.provider_message_id === row.provider_message_id)) return json({ code: '23505' }, 409);
      stored.push(row);
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const source = readFileSync('supabase/functions/resend-inbox-sync/index.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const env: Record<string, string> = { SUPABASE_URL: 'https://project.example', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' };
  new Function('Deno', 'fetch', 'crypto', 'Response', 'URL', 'TextEncoder', code)(
    { env: { get: (key: string) => env[key] }, serve: (h: Handler) => { handler = h; } }, fetcher, webcrypto, Response, URL, TextEncoder,
  );
  return { handler, fetcher, stored };
}
const request = () => new Request('https://project.example/functions/v1/resend-inbox-sync', { method: 'POST', headers: { 'x-admin-token': 'valid-token' } });

describe('Resend inbox sync', () => {
  it('rejects unauthorised callers before contacting Resend', async () => {
    const ctx = setup({ authorized: false });
    expect((await ctx.handler(request())).status).toBe(403);
    expect(ctx.fetcher.mock.calls.some(([url]) => String(url).includes('api.resend.com'))).toBe(false);
  });
  it('imports only registered mailbox messages, retains the actual Message-ID, and deduplicates retries', async () => {
    const ctx = setup();
    const first = await ctx.handler(request());
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ checked: 2, matched: 1, saved: 1 });
    expect(ctx.stored).toHaveLength(1);
    expect(ctx.stored[0]).toMatchObject({ mailbox_address: 'support@niknote.online', body_text: 'Test only', provider: 'resend-inbound', in_reply_to: '<message@example.com>' });
    expect(ctx.fetcher.mock.calls.some(([url]) => String(url).endsWith('other-123'))).toBe(false);
    const second = await ctx.handler(request());
    expect(await second.json()).toMatchObject({ saved: 0 });
    expect(ctx.stored).toHaveLength(1);
  });
  it('reports missing API read permission without exposing the key', async () => {
    const ctx = setup({ forbidden: true });
    const res = await ctx.handler(request());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/read received emails/);
    expect(JSON.stringify(body)).not.toContain('test-key');
  });
});
