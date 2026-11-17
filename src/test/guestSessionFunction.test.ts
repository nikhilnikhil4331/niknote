import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readLimitedJson } from '../../supabase/functions/_shared/aiSecurity';

type Handler = (request: Request) => Promise<Response>;
type Options = { quotaAllowed?: boolean; quotaError?: boolean; resumeError?: boolean };

function world(options: Options = {}) {
  const user = {
    id: 'guest-user-1',
    is_anonymous: false,
    user_metadata: { is_guest: true, full_name: 'A guest' },
  };
  const admin = {
    auth: {
      admin: {
        createUser: vi.fn(async () => ({ data: { user }, error: null })),
      },
    },
    rpc: vi.fn(async (_name: string, _params: Record<string, unknown>) => ({
      data: [{ allowed: options.quotaAllowed !== false, reset_at: new Date(Date.now() + 60_000).toISOString() }],
      error: options.quotaError ? { message: 'quota RPC unavailable' } : null,
    })),
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) })),
  };
  const publicClient = {
    auth: {
      signInWithPassword: vi.fn(async ({ email }: { email: string }) => options.resumeError && email === 'guest@example.test'
        ? { data: { session: null, user: null }, error: { message: 'invalid credentials' } }
        : {
          data: {
            session: { access_token: 'guest-access-token', refresh_token: 'guest-refresh-token' },
            user,
          },
          error: null,
        }),
    },
  };
  const createClient = vi.fn((_url: string, key: string) => key === 'service-role' ? admin : publicClient);
  const values: Record<string, string> = {
    SUPABASE_URL: 'https://project.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    SUPABASE_ANON_KEY: 'anon-key',
  };
  let capturedHandler: Handler | undefined;
  const deno = { env: { get: (name: string) => values[name] }, serve: (fn: Handler) => { capturedHandler = fn; } };
  const source = readFileSync('supabase/functions/guest-session/index.ts', 'utf8')
    .replace(/^import .*;\s*$/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function('Deno', 'Response', 'crypto', 'createClient', 'readLimitedJson', code)(
    deno,
    Response,
    globalThis.crypto,
    createClient,
    readLimitedJson,
  );
  if (!capturedHandler) throw new Error('guest-session handler did not register');
  return { handler: capturedHandler, admin, publicClient, createClient };
}

function request(body: unknown, options: { ip?: string; method?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.ip) headers.set('x-forwarded-for', `198.51.100.10, ${options.ip}`);
  return new Request('https://edge.example/functions/v1/guest-session', {
    method: options.method || 'POST',
    headers,
    ...(['OPTIONS', 'GET', 'HEAD'].includes(options.method || '') ? {} : { body: JSON.stringify(body) }),
  });
}

describe('guest-session edge function', () => {
  it('uses a keyed, server-derived quota bucket and the service-role-only quota RPC', async () => {
    const w = world();
    const response = await w.handler(request({ action: 'create', guest_name: 'Riya' }, { ip: '203.0.113.22' }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.user.id).toBe('guest-user-1');
    expect(w.admin.rpc).toHaveBeenCalledOnce();
    const [rpcName, rpcArgs] = w.admin.rpc.mock.calls[0];
    expect(rpcName).toBe('consume_anon_quota');
    expect(rpcArgs).toMatchObject({ p_limit: 5, p_window_seconds: 3600 });
    expect(String(rpcArgs.p_bucket)).toMatch(/^[a-f0-9]{64}$/);
    expect(w.publicClient).not.toHaveProperty('rpc');
    expect(w.admin.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({
      user_metadata: expect.objectContaining({ full_name: 'Riya', is_guest: true }),
    }));
  });

  it('fails closed on guest creation when quota storage is unavailable or exhausted', async () => {
    const unavailable = world({ quotaError: true });
    expect((await unavailable.handler(request({ action: 'create' }, { ip: '203.0.113.23' }))).status).toBe(503);
    expect(unavailable.admin.auth.admin.createUser).not.toHaveBeenCalled();

    const limited = world({ quotaAllowed: false });
    const response = await limited.handler(request({ action: 'create' }, { ip: '203.0.113.24' }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(limited.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('does not create a guest when the platform did not provide a usable requester IP', async () => {
    const w = world();
    const response = await w.handler(request({ action: 'create' }));
    expect(response.status).toBe(503);
    expect(w.admin.rpc).not.toHaveBeenCalled();
    expect(w.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('resumes existing guest credentials without consuming a new-account quota slot', async () => {
    const w = world();
    const response = await w.handler(request({ email: 'guest@example.test', password: 'secret', guest_name: 'Riya' }));
    expect(response.status).toBe(200);
    expect((await response.json()).resumed).toBe(true);
    expect(w.admin.rpc).not.toHaveBeenCalled();
    expect(w.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('does not create a replacement guest when saved guest credentials cannot be resumed', async () => {
    const w = world({ resumeError: true });
    const response = await w.handler(request({ email: 'guest@example.test', password: 'stale-password' }));
    expect(response.status).toBe(401);
    expect(w.admin.rpc).not.toHaveBeenCalled();
    expect(w.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('rejects the former admin-based upgrade action; email changes must use the authenticated user flow', async () => {
    const w = world();
    const response = await w.handler(request({ action: 'upgrade', email: 'riya@example.com', password: 'a-strong-password' }, { ip: '203.0.113.26' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Unsupported guest session action' });
    expect(w.admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(w.admin.rpc).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies before creating a user', async () => {
    const w = world();
    const response = await w.handler(request({ action: 'create', guest_name: 'x'.repeat(9000) }, { ip: '203.0.113.25' }));
    expect(response.status).toBe(413);
    expect(w.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('handles preflight and rejects non-POST methods', async () => {
    const w = world();
    expect((await w.handler(request({}, { method: 'OPTIONS' }))).status).toBe(204);
    expect((await w.handler(request({}, { method: 'GET' }))).status).toBe(405);
  });
});
