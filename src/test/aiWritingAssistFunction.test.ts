import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readLimitedJson } from '../../supabase/functions/_shared/aiSecurity';

type Handler = (request: Request) => Promise<Response>;
type Options = { rateCheckError?: boolean; rateInsertError?: boolean };

function createHandler(options: Options = {}) {
  const providerFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response('data: {"choices":[]}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
  const adminClient = {
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(async () => options.rateCheckError
          ? { count: null, error: { message: 'rate limit store unavailable' } }
          : { count: 0, error: null }),
        insert: vi.fn(async () => options.rateInsertError
          ? { error: { message: 'rate limit reserve failed' } }
          : { error: null }),
      };
      if (table !== 'rate_limits') throw new Error(`Unexpected admin table ${table}`);
      return builder;
    }),
  };
  const publicClient = {
    auth: { getUser: vi.fn(async (token: string) => token === 'valid'
      ? { data: { user: { id: 'user-id' } }, error: null }
      : { data: { user: null }, error: { message: 'invalid token' } }) },
  };
  const createClient = vi.fn((_url: string, key: string) => key === 'service-key' ? adminClient : publicClient);
  let capturedHandler: Handler | undefined;
  const serve = (fn: Handler) => { capturedHandler = fn; };
  const deno = { env: { get: (name: string) => ({
    SUPABASE_URL: 'https://project.example',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    LARPROUTER_API_KEY: 'provider-key',
  }[name]) } };
  const source = readFileSync('supabase/functions/ai-writing-assist/index.ts', 'utf8')
    .replace(/^\s*import .*;\s*$/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function('serve', 'createClient', 'Deno', 'fetch', 'Response', 'readLimitedJson', code)(
    serve,
    createClient,
    deno,
    providerFetch,
    Response,
    readLimitedJson,
  );
  if (!capturedHandler) throw new Error('ai-writing-assist handler did not register');
  return { handler: capturedHandler, providerFetch };
}

function request(body: unknown, token = 'valid') {
  return new Request('https://edge.example/functions/v1/ai-writing-assist', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('ai-writing-assist edge function', () => {
  it('requires a verified user session', async () => {
    const w = createHandler();
    expect((await w.handler(request({ text: 'Write a paragraph' }, 'invalid'))).status).toBe(401);
    expect(w.providerFetch).not.toHaveBeenCalled();
  });

  it('fails closed when rate-limit check or reservation fails', async () => {
    const checkFailure = createHandler({ rateCheckError: true });
    expect((await checkFailure.handler(request({ text: 'Write a paragraph' }))).status).toBe(503);
    expect(checkFailure.providerFetch).not.toHaveBeenCalled();

    const reserveFailure = createHandler({ rateInsertError: true });
    expect((await reserveFailure.handler(request({ text: 'Write a paragraph' }))).status).toBe(503);
    expect(reserveFailure.providerFetch).not.toHaveBeenCalled();
  });

  it('bounds incoming request size and prompt fields', async () => {
    const oversized = createHandler();
    expect((await oversized.handler(request({ text: 'x'.repeat(129 * 1024) }))).status).toBe(413);
    expect(oversized.providerFetch).not.toHaveBeenCalled();

    const longPrompt = createHandler();
    expect((await longPrompt.handler(request({ text: 'short', systemPrompt: 'x'.repeat(12_001) }))).status).toBe(400);
    expect(longPrompt.providerFetch).not.toHaveBeenCalled();
  });

  it('returns the provider stream for an authenticated, bounded prompt', async () => {
    const w = createHandler();
    const response = await w.handler(request({ mode: 'generate', text: 'A short writing prompt', systemPrompt: 'Be concise.' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(w.providerFetch).toHaveBeenCalledOnce();
    const [, init] = w.providerFetch.mock.calls[0];
    expect(JSON.parse(String(init?.body)).messages[1].content).toContain('A short writing prompt');
  });
});
