import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
const image = 'data:image/png;base64,aGVsbG8=';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

function world(options: { entitled?: boolean; rateAllowed?: boolean; content?: string } = {}) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (url.pathname === '/auth/v1/user') {
      return headers.get('Authorization') === 'Bearer valid' ? json({ id: 'user-id' }) : json({}, 401);
    }
    if (url.pathname === '/rest/v1/user_subscriptions') {
      if (headers.get('Authorization') !== 'Bearer service') throw new Error('missing service role');
      return json(options.entitled === false ? [] : [{ status: 'active', current_period_end: '2099-01-01' }]);
    }
    if (url.pathname === '/rest/v1/rpc/reserve_handwriting_request') {
      if (headers.get('Authorization') !== 'Bearer service') throw new Error('missing service role');
      const body = JSON.parse(String(init.body));
      if (body._user_id !== 'user-id') throw new Error('wrong user');
      return json(options.rateAllowed !== false);
    }
    if (url.hostname === 'www.niknote.online' && url.pathname === '/api/ai') {
      const body = JSON.parse(String(init.body));
      if (body.model !== 'astra-vision' || body.stream !== false || body.messages[1].images[0].dataUrl !== image) throw new Error('wrong gateway payload');
      return json({ content: options.content ?? JSON.stringify({ extractedText: 'Hello\nworld', lines: ['Hello', 'world'], confidence: 0.9, warnings: [], success: true }) });
    }
    throw new Error(`Unexpected request ${url}`);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  return { fetcher };
}
function handler(fetcher: typeof fetch): Handler {
  const source = readFileSync('supabase/functions/handwriting-vision/index.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let result: Handler | undefined;
  const values: Record<string, string> = { SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' };
  const deno = { env: { get: (name: string) => values[name] }, serve: (fn: Handler) => { result = fn; } };
  new Function('Deno', 'fetch', 'Response', code)(deno, fetcher, Response);
  if (!result) throw new Error('missing edge handler');
  return result;
}
function request(body: unknown, token = 'valid') {
  return new Request('https://edge.example', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('paid handwriting vision edge function (mock provider)', () => {
  it('requires authentication and an active paid entitlement', async () => {
    const unauth = world();
    expect((await handler(unauth.fetcher)(request({ kind: 'ocr', imageBase64: image }, 'invalid'))).status).toBe(401);
    const unpaid = world({ entitled: false });
    expect((await handler(unpaid.fetcher)(request({ kind: 'ocr', imageBase64: image }))).status).toBe(403);
    expect(unpaid.fetcher.mock.calls.some((call: any[]) => String(call[0]).includes('niknote.online'))).toBe(false);
  });

  it('fails closed at the rate limit and does not send the image', async () => {
    const w = world({ rateAllowed: false });
    expect((await handler(w.fetcher)(request({ kind: 'ocr', imageBase64: image }))).status).toBe(429);
    expect(w.fetcher.mock.calls.some((call: any[]) => String(call[0]).includes('niknote.online'))).toBe(false);
  });

  it('calls the vision gateway and returns OCR lines', async () => {
    const w = world();
    const response = await handler(w.fetcher)(request({ kind: 'ocr', imageBase64: image }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, lines: ['Hello', 'world'], confidence: 0.9 });
  });

  it('returns an approximate bounded style only for a usable result', async () => {
    const w = world({ content: '```json\n{"suggestedFont":"caveat","fontSize":900,"inkColor":"blue","slant":-50,"analysisNotes":"A loose print style"}\n```' });
    const response = await handler(w.fetcher)(request({ kind: 'style', imageBase64: image }));
    expect(await response.json()).toMatchObject({ suggestedFont: 'caveat', fontSize: 40, slant: -15 });
    const bad = world({ content: '{}' });
    expect((await handler(bad.fetcher)(request({ kind: 'style', imageBase64: image }))).status).toBe(502);
  });

  it('rejects invalid images and malformed AI responses without inventing a result', async () => {
    const invalid = world();
    expect((await handler(invalid.fetcher)(request({ kind: 'ocr', imageBase64: 'not-an-image' }))).status).toBe(400);
    const bad = world({ content: 'not JSON' });
    expect((await handler(bad.fetcher)(request({ kind: 'ocr', imageBase64: image }))).status).toBe(502);
  });
});
