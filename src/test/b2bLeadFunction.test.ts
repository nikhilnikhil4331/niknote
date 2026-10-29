import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';

function loadHandler(fetchMock: typeof fetch) {
  const source = fs.readFileSync('supabase/functions/b2b-lead/index.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const env: Record<string, string> = { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
  new Function('Deno', 'fetch', 'Response', 'Request', code)(
    { env: { get: (key: string) => env[key] }, serve: (h: typeof handler) => { handler = h; } },
    fetchMock, Response, Request,
  );
  return handler!;
}
const valid = { name: 'Test Teacher', email: 'teacher@example.test', institution: 'Example School', students: '75', message: 'Worksheets' };
const request = (body: unknown) => new Request('https://edge.example.test/b2b-lead', { method: 'POST', body: JSON.stringify(body) });
afterEach(() => vi.restoreAllMocks());

describe('institution inquiry function', () => {
  it('saves one lead and returns success only after the database confirms it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ id: 'mock-lead-id' }]));
    const res = await loadHandler(fetchMock as unknown as typeof fetch)(request(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'Inquiry received.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/rest/v1/sales_leads');
    expect(JSON.parse(init.body)).toMatchObject({ students: 75, segment: 'school', stage: 'new' });
    expect(init.headers.Prefer).toContain('ignore-duplicates');
  });
  it('does not say a repeat inquiry with unsaved details was received', async () => {
    const res = await loadHandler(vi.fn().mockResolvedValue(Response.json([])) as unknown as typeof fetch)(request(valid));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('already exists');
  });
  it('reports database failure and does not claim success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await loadHandler(vi.fn().mockResolvedValue(new Response('', { status: 500 })) as unknown as typeof fetch)(request(valid));
    expect(res.status).toBe(503);
    expect((await res.json()).success).not.toBe(true);
  });
  it('validates required contact details before writing', async () => {
    const fetchMock = vi.fn();
    const res = await loadHandler(fetchMock as unknown as typeof fetch)(request({ ...valid, email: 'bad' }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
