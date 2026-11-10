import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readLimitedJson } from '../../supabase/functions/_shared/aiSecurity';

type Handler = (request: Request) => Promise<Response>;
const analysis = '## SUMMARY\nA short summary.\n\n## KEY POINTS\n- First point';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

function world(options: { rateCheckError?: boolean; rateInsertError?: boolean; providerBody?: unknown } = {}) {
  const rateBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(async () => options.rateCheckError
      ? { count: null, error: { message: 'rate lookup unavailable' } }
      : { count: 0, error: null }),
    insert: vi.fn(async () => options.rateInsertError
      ? { error: { message: 'rate reservation unavailable' } }
      : { error: null }),
  };
  rateBuilder.select.mockImplementation(() => rateBuilder);
  rateBuilder.eq.mockImplementation(() => rateBuilder);
  const adminClient = { from: vi.fn((table: string) => {
    if (table !== 'rate_limits') throw new Error(`Unexpected admin table ${table}`);
    return rateBuilder;
  }) };
  const publicClient = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-123' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table !== 'activity_logs') throw new Error(`Unexpected public table ${table}`);
      return { insert: vi.fn(async () => ({ error: null })) };
    }),
  };
  const createClient = vi.fn((_url: string, key: string) => key === 'service-key' ? adminClient : publicClient);
  const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const requestBody = JSON.parse(String(init?.body));
    if (requestBody.stream !== false) throw new Error('document processing must use non-streaming JSON');
    return json(options.providerBody ?? { choices: [{ message: { content: analysis } }] });
  });
  const values: Record<string, string> = {
    SUPABASE_URL: 'https://project.example',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    LOVABLE_API_KEY: 'provider-key',
  };
  let capturedHandler: Handler | undefined;
  const serve = (handler: Handler) => { capturedHandler = handler; };
  const deno = { env: { get: (name: string) => values[name] } };
  const source = readFileSync('supabase/functions/process-document/index.ts', 'utf8')
    .replace(/^import .*;\s*$/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function('serve', 'createClient', 'Deno', 'fetch', 'Response', 'readLimitedJson', code)(
    serve, createClient, deno, fetcher, Response, readLimitedJson,
  );
  if (!capturedHandler) throw new Error('process-document handler did not register');
  return { handler: capturedHandler, adminClient, publicClient, fetcher, rateBuilder };
}

function request(body: unknown, options: { token?: string; method?: string } = {}) {
  const method = options.method || 'POST';
  return new Request('https://edge.example/functions/v1/process-document', {
    method,
    headers: { ...(options.token === '' ? {} : { Authorization: `Bearer ${options.token || 'valid-token'}` }), 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? undefined : JSON.stringify(body),
  });
}

const validPayload = {
  content: 'Newton\'s second law relates force, mass, and acceleration.',
  processMode: 'summarize',
  userMode: 'student',
  title: 'Newton laws.pdf',
  additionalInstructions: 'Use the required headings.',
};

describe('process-document JSON contract', () => {
  it('accepts bounded extracted text and returns a JSON result instead of SSE', async () => {
    const w = world();
    const response = await w.handler(request(validPayload));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-type')).not.toContain('text/event-stream');
    expect(await response.json()).toMatchObject({
      text: validPayload.content,
      content: analysis,
      processMode: 'summarize',
    });

    const providerPayload = JSON.parse(String(w.fetcher.mock.calls[0][1]?.body));
    expect(providerPayload.stream).toBe(false);
    expect(providerPayload.messages[1].content).toContain('Title: Newton laws.pdf');
    expect(providerPayload.messages[1].content).toContain(validPayload.content);
    expect(providerPayload.messages[1].content).toContain(validPayload.additionalInstructions);
  });

  it('rejects malformed contracts, oversized bodies, and invalid modes before calling AI', async () => {
    const missing = world();
    expect((await missing.handler(request({ processMode: 'summarize', userMode: 'student' }))).status).toBe(400);
    expect(missing.fetcher).not.toHaveBeenCalled();

    const badMode = world();
    expect((await badMode.handler(request({ ...validPayload, processMode: 'extract-file' }))).status).toBe(400);
    expect(badMode.fetcher).not.toHaveBeenCalled();

    const largeContent = world();
    expect((await largeContent.handler(request({ ...validPayload, content: 'x'.repeat(16_001) }))).status).toBe(413);
    expect(largeContent.fetcher).not.toHaveBeenCalled();

    const oversizedBody = world();
    expect((await oversizedBody.handler(request({ ...validPayload, additionalInstructions: 'x'.repeat(110_000) }))).status).toBe(413);
    expect(oversizedBody.fetcher).not.toHaveBeenCalled();
  });

  it('requires a user session and fails closed when rate-limit storage cannot reserve a slot', async () => {
    const unauthenticated = world();
    expect((await unauthenticated.handler(request(validPayload, { token: '' }))).status).toBe(401);
    expect(unauthenticated.fetcher).not.toHaveBeenCalled();

    const unavailable = world({ rateCheckError: true });
    expect((await unavailable.handler(request(validPayload))).status).toBe(503);
    expect(unavailable.fetcher).not.toHaveBeenCalled();

    const reserveFailure = world({ rateInsertError: true });
    expect((await reserveFailure.handler(request(validPayload))).status).toBe(503);
    expect(reserveFailure.fetcher).not.toHaveBeenCalled();
  });

  it('returns a safe gateway error if the provider result is not valid JSON content', async () => {
    const w = world({ providerBody: { choices: [{ message: { content: '' } }] } });
    const response = await w.handler(request(validPayload));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: 'AI service returned an invalid response' });
  });
});
