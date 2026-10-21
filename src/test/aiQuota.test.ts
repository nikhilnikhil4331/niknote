/**
 * AI quota contract between `/api/ai` (Vercel edge) and the browser.
 *
 * The edge function meters every request in Postgres through SECURITY DEFINER
 * RPCs: `consume_ai_quota()` for signed-in users (keyed on auth.uid()) and
 * `consume_anon_quota()` for signed-out visitors (keyed on a salted SHA-256 of
 * IP + user-agent — no raw IP is stored anywhere). These tests pin the parsing
 * and the privacy properties, not the network calls.
 */
import { describe, expect, it } from 'vitest';
import {
  anonQuotaBucket,
  parseQuotaPayload,
  quotaExceededMessage,
  quotaHeaders,
  readQuotaHeaders,
} from '@/lib/aiQuota';

describe('parseQuotaPayload', () => {
  it('reads the array shape PostgREST returns for an RPC', () => {
    const parsed = parseQuotaPayload([
      { allowed: true, used: 3, remaining: 37, reset_at: '2026-10-21T19:00:00+00:00' },
    ]);
    expect(parsed).toEqual({ allowed: true, used: 3, remaining: 37, resetAt: '2026-10-21T19:00:00+00:00' });
  });

  it('accepts a bare object and camelCase reset field', () => {
    expect(parseQuotaPayload({ allowed: false, used: 40, remaining: 0, resetAt: '2026-10-21T19:00:00Z' })).toEqual({
      allowed: false,
      used: 40,
      remaining: 0,
      resetAt: '2026-10-21T19:00:00Z',
    });
  });

  it('never invents numbers — malformed payloads return null so callers fail open', () => {
    expect(parseQuotaPayload(null)).toBeNull();
    expect(parseQuotaPayload({})).toBeNull();
    expect(parseQuotaPayload({ allowed: 'yes', used: 1, remaining: 1 })).toBeNull();
    expect(parseQuotaPayload([{ allowed: true, used: 'x', remaining: 1 }])).toBeNull();
    expect(parseQuotaPayload('nope')).toBeNull();
  });

  it('clamps negative remaining to zero and floors fractions', () => {
    expect(parseQuotaPayload({ allowed: true, used: 1.9, remaining: -4 })).toEqual({
      allowed: true,
      used: 1,
      remaining: 0,
      resetAt: null,
    });
  });
});

describe('quotaHeaders / readQuotaHeaders', () => {
  it('round-trips through real Headers', () => {
    const headers = new Headers(
      quotaHeaders({ allowed: true, used: 5, remaining: 35, resetAt: '2026-10-21T19:00:00Z' }, 'user'),
    );
    expect(readQuotaHeaders(headers)).toEqual({
      scope: 'user',
      remaining: 35,
      resetAt: '2026-10-21T19:00:00Z',
    });
  });

  it('marks unmetered responses as unknown without fake numbers', () => {
    const headers = new Headers(quotaHeaders(null, 'anon'));
    expect(readQuotaHeaders(headers)).toEqual({ scope: 'anon', remaining: null, resetAt: null });
    expect(headers.get('x-niknote-quota-remaining')).toBeNull();
  });
});

describe('anonQuotaBucket', () => {
  it('is a stable 32-char hex digest and hides the input', async () => {
    const bucket = await anonQuotaBucket('203.0.113.9|Mozilla/5.0');
    expect(bucket).toMatch(/^[a-f0-9]{32}$/);
    expect(bucket).not.toContain('203.0.113');
    await expect(anonQuotaBucket('203.0.113.9|Mozilla/5.0')).resolves.toBe(bucket);
  });

  it('changes with the salt, the IP and the user-agent', async () => {
    const base = await anonQuotaBucket('203.0.113.9|Mozilla/5.0');
    expect(await anonQuotaBucket('203.0.113.9|Mozilla/5.0', 'other-salt')).not.toBe(base);
    expect(await anonQuotaBucket('203.0.113.10|Mozilla/5.0')).not.toBe(base);
    expect(await anonQuotaBucket('203.0.113.9|curl/8')).not.toBe(base);
  });
});

describe('quotaExceededMessage', () => {
  it('quotes the real reset time instead of a fake one', () => {
    const resetAt = new Date(Date.now() + 25 * 60_000).toISOString();
    const message = quotaExceededMessage({ allowed: false, used: 40, remaining: 0, resetAt });
    expect(message).toContain('40 requests');
    expect(message).toMatch(/about 2[4-6] min/);
  });

  it('stays honest when no reset time is known', () => {
    expect(quotaExceededMessage(null)).toBe('Hourly AI limit reached. Please try again a little later.');
  });
});
