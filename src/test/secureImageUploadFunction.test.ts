import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readLimitedJson } from '../../supabase/functions/_shared/aiSecurity';

type Handler = (request: Request) => Promise<Response>;
const png = `data:image/png;base64,${btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))}`;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

type Options = { rateError?: boolean; insertError?: boolean };

function createHandler(options: Options = {}) {
  const storageUpload = vi.fn(async () => ({ data: { path: 'user-id/sample.png' }, error: null }));
  const storageFrom = vi.fn((bucket: string) => ({
    upload: storageUpload,
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/${bucket}/${path}` } }),
  }));
  const adminClient = {
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(async () => options.rateError
          ? { count: null, error: { message: 'rate limit storage unavailable' } }
          : { count: 0, error: null }),
        insert: vi.fn(async () => options.insertError
          ? { error: { message: 'rate limit reservation unavailable' } }
          : { error: null }),
      };
      if (table !== 'rate_limits') throw new Error(`Unexpected admin table ${table}`);
      return builder;
    }),
    storage: { from: storageFrom },
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
  }[name]) } };
  const source = readFileSync('supabase/functions/secure-image-upload/index.ts', 'utf8')
    .replace(/^\s*import .*;\s*$/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function('serve', 'createClient', 'Deno', 'Response', 'crypto', 'atob', 'readLimitedJson', code)(
    serve,
    createClient,
    deno,
    Response,
    globalThis.crypto,
    atob,
    readLimitedJson,
  );
  if (!capturedHandler) throw new Error('secure-image-upload handler did not register');
  return { handler: capturedHandler, storageFrom, storageUpload, publicClient };
}

function request(body: unknown, token = 'valid') {
  return new Request('https://edge.example/functions/v1/secure-image-upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('secure-image-upload edge function', () => {
  it('rejects arbitrary bucket names before writing with the service-role client', async () => {
    const w = createHandler();
    const response = await w.handler(request({ bucket: 'profiles', imageBase64: png }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Unsupported upload bucket' });
    expect(w.storageFrom).not.toHaveBeenCalled();
    expect(w.storageUpload).not.toHaveBeenCalled();
  });

  it('only uploads validated images into the allow-listed private bucket', async () => {
    const w = createHandler();
    const response = await w.handler(request({ bucket: 'handwriting-samples', imageBase64: png }));
    expect(response.status).toBe(200);
    expect(w.storageFrom).toHaveBeenCalledTimes(2);
    expect(w.storageFrom).toHaveBeenCalledWith('handwriting-samples');
    expect(w.storageUpload).toHaveBeenCalledOnce();
  });

  it('fails closed when the rate-limit store cannot check or reserve a request', async () => {
    const checkFailure = createHandler({ rateError: true });
    expect((await checkFailure.handler(request({ imageBase64: png }))).status).toBe(503);
    expect(checkFailure.storageFrom).not.toHaveBeenCalled();

    const reserveFailure = createHandler({ insertError: true });
    expect((await reserveFailure.handler(request({ imageBase64: png }))).status).toBe(503);
    expect(reserveFailure.storageFrom).not.toHaveBeenCalled();
  });

  it('validates auth and caps the decoded JSON body before storage work', async () => {
    const unauthenticated = createHandler();
    expect((await unauthenticated.handler(request({ imageBase64: png }, 'invalid'))).status).toBe(401);
    expect(unauthenticated.storageFrom).not.toHaveBeenCalled();

    const tooLarge = createHandler();
    const response = await tooLarge.handler(request({ imageBase64: 'x'.repeat(7 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(tooLarge.storageFrom).not.toHaveBeenCalled();
  });
});
