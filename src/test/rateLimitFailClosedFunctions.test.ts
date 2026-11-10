import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readLimitedJson } from '../../supabase/functions/_shared/aiSecurity';

type Handler = (request: Request) => Promise<Response>;
type RateFailure = 'check' | 'reserve' | 'none';
type FunctionCase = { label: string; path: string };
const auditedFunctions: FunctionCase[] = [
  { label: 'process-document', path: 'supabase/functions/process-document/index.ts' },
  { label: 'extract-handwriting-text', path: 'supabase/functions/extract-handwriting-text/index.ts' },
  { label: 'analyze-handwriting', path: 'supabase/functions/analyze-handwriting/index.ts' },
];

function createHandler(path: string, failure: RateFailure) {
  const publicClient = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-id' } }, error: null })) },
  };
  const adminClient = {
    from: vi.fn((table: string) => {
      if (table !== 'rate_limits') throw new Error(`Unexpected table: ${table}`);
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(async () => failure === 'check'
          ? { count: null, error: { message: 'rate limit lookup unavailable' } }
          : { count: 0, error: null }),
        insert: vi.fn(async () => failure === 'reserve'
          ? { error: { message: 'rate limit reservation unavailable' } }
          : { error: null }),
      };
      return builder;
    }),
  };
  const createClient = vi.fn((_url: string, key: string) => key === 'service-key' ? adminClient : publicClient);
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  let capturedHandler: Handler | undefined;
  const serve = (handler: Handler) => { capturedHandler = handler; };
  const deno = { env: { get: (name: string) => ({
    SUPABASE_URL: 'https://project.example',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    LOVABLE_API_KEY: 'provider-key',
    OPENAI_API_KEY: 'provider-key',
  }[name]) } };
  const source = readFileSync(path, 'utf8').replace(/^\s*import .*;\s*$/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function('serve', 'createClient', 'Deno', 'fetch', 'Response', 'readLimitedJson', code)(
    serve,
    createClient,
    deno,
    fetcher,
    Response,
    readLimitedJson,
  );
  if (!capturedHandler) throw new Error(`${path} did not register a handler`);
  return { handler: capturedHandler, publicClient, adminClient, fetcher };
}

function postRequest() {
  return new Request('https://edge.example/functions/v1/audited', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
    body: '{}',
  });
}

describe('AI/OCR/document rate limits fail closed', () => {
  it.each(auditedFunctions)('$label returns service unavailable if the rate limit check fails', async ({ path }) => {
    const w = createHandler(path, 'check');
    const response = await w.handler(postRequest());
    expect(response.status).toBe(503);
    expect(w.adminClient.from).toHaveBeenCalledWith('rate_limits');
  });

  it.each(auditedFunctions)('$label returns service unavailable if reserving a rate-limit slot fails', async ({ path }) => {
    const w = createHandler(path, 'reserve');
    const response = await w.handler(postRequest());
    expect(response.status).toBe(503);
    expect(w.adminClient.from).toHaveBeenCalledWith('rate_limits');
  });

  it('extract-handwriting-text bounds OCR JSON bodies before invoking the provider', async () => {
    const ocr = auditedFunctions.find(({ label }) => label === 'extract-handwriting-text');
    if (!ocr) throw new Error('OCR function case is missing');
    const w = createHandler(ocr.path, 'none');
    const request = new Request('https://edge.example/functions/v1/extract-handwriting-text', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid',
        'Content-Type': 'application/json',
        'Content-Length': '14000001',
      },
      body: '{}',
    });

    const response = await w.handler(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: 'Request body too large' });
    expect(w.fetcher).not.toHaveBeenCalled();
  });
});
