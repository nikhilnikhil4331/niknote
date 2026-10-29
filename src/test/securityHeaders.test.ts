/**
 * Audit F-02 — security headers must stay in the deployed config.
 *
 * vercel.json is the only place these headers exist (there is no server and no
 * CI). A silent deletion here would remove clickjacking protection and the
 * CSP that backstops any future HTML-injection bug, so pin the important
 * directives with a test.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
) as { headers: { source: string; headers: { key: string; value: string }[] }[] };

const globalHeaders = config.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
const header = (key: string) => globalHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('vercel.json security headers', () => {
  it('keeps transport and sniffing protections', () => {
    expect(header('Strict-Transport-Security')).toContain('max-age=');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
  });

  it('blocks framing', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('ships a CSP that blocks inline script and plugins', () => {
    const csp = header('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    // Inline <script> and on* handlers must NOT be allowed. 'unsafe-eval' is
    // present only because FormulaEngine/WorkflowEngine use new Function().
    expect(csp).toMatch(/script-src [^;]*'self'/);
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src [^;]*\*/);
  });

  it('does not over-restrict the features that need device access', () => {
    const policy = header('Permissions-Policy') ?? '';
    expect(policy).toContain('camera=(self)');
    expect(policy).toContain('microphone=(self)');
  });

  it('allows the origins the app actually calls', () => {
    const csp = header('Content-Security-Policy') ?? '';
    for (const origin of [
      'https://*.supabase.co',
      'https://checkout.razorpay.com',
      'https://api.openai.com',
      'https://larprouter.com',
      'https://www.niknote.online',
      'https://fonts.gstatic.com',
      'https://accounts.google.com',
    ]) {
      expect(csp, `${origin} missing from CSP`).toContain(origin);
    }
  });
});
