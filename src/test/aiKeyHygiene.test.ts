/**
 * P0 — AI provider keys must never reach the browser bundle.
 *
 * Anything named `VITE_*` is inlined into the shipped JS at build time. The app
 * used to read `VITE_GEMINI_KEY` / `VITE_GROQ_KEY` from `src/`, which meant a
 * public, unmetered key. Keys now live only in:
 *   - the `ai-proxy` / `editor-ai` Supabase edge functions (Deno.env secrets), and
 *   - the same-origin `/api/ai` Vercel function (server env, never bundled).
 *
 * These assertions fail the build if someone reintroduces a bundled key path, or
 * if the CSP loses the Supabase origin the new proxy calls depend on.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// The guard itself names the forbidden identifiers, so skip it while scanning.
const clientFiles = walk(resolve(root, 'src')).filter((f) => !f.endsWith('aiKeyHygiene.test.ts'));
const rel = (f: string) => f.slice(root.length + 1);

describe('AI key hygiene', () => {
  it('does not read any provider key from import.meta.env inside src/', () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const text = readFileSync(file, 'utf8');
      if (/import\.meta\.env\.VITE_(GROQ|GEMINI|OPENAI)_KEY/.test(text)) offenders.push(rel(file));
      // Also catch the destructured form: const { VITE_GROQ_KEY } = import.meta.env
      if (/\bVITE_(GROQ|GEMINI|OPENAI)_KEY\b/.test(text)) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the proxy as the only server-side key reader', () => {
    const proxy = readFileSync(resolve(root, 'supabase/functions/ai-proxy/index.ts'), 'utf8');
    expect(proxy).toContain('GROQ_API_KEY');
    expect(proxy).toContain('GEMINI_API_KEY');
    expect(proxy).not.toMatch(/Deno\.env\.get\(['"]VITE_(GROQ|GEMINI)_KEY/);
    // No key ever leaves the function body in a response payload.
    expect(proxy).not.toMatch(/apiKey\s*[,}]/);
  });

  it('lets the browser call the Supabase proxy origin under the deployed CSP', () => {
    const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const global = config.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
    const csp = global.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    const connectSrc = csp.split(';').find((d) => d.trim().startsWith('connect-src')) ?? '';
    expect(connectSrc).toContain('https://*.supabase.co');
    expect(connectSrc).toContain('https://atuxocibsmflgwlwuvmv.supabase.co');
    // The proxy must be reachable; direct provider origins stay allowed only for
    // the server-side /api/ai function and user-pasted keys.
    expect(connectSrc).toContain("'self'");
  });

  it('keeps the client proxy flag opt-in so a 503 cannot break the editor', () => {
    const engine = readFileSync(resolve(root, 'src/lib/aiEngine.ts'), 'utf8');
    expect(engine).toContain('VITE_AI_PROXY');
    // Default off: only an explicit "1"/"true" turns the proxy on.
    expect(engine).toMatch(/VITE_AI_PROXY[\s\S]{0,200}(===|includes).{0,60}(1|true)/);
  });
});
