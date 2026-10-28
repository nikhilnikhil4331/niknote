// ============================================================
// serverAnalytics — unit tests
//
// These guard the two things that make analytics safe to ship:
// consent gating (nothing leaves the browser without permission) and
// scrubbing (note content / PII never reaches the database).
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';

const insert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert }) },
}));

const consent = { granted: true };
vi.mock('@/lib/consent', () => ({
  hasAnalyticsConsent: () => consent.granted,
}));

import {
  SERVER_EVENT_TYPES,
  scrubParams,
  sendServerEvent,
  trackServerEvent,
} from '@/lib/serverAnalytics';

beforeEach(() => {
  // reset() (not restoreAllMocks) — restoring would drop the mock's resolved
  // value and make the destructured `{ error }` throw, which silently turns
  // every assertion into "returned false".
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  consent.granted = true;
  sessionStorage.clear();
});

describe('scrubParams', () => {
  it('keeps ordinary dimensions', () => {
    expect(scrubParams({ page: '/blog', plan: 'monthly', pages: 3, ok: true })).toEqual({
      page: '/blog',
      plan: 'monthly',
      pages: 3,
      ok: true,
    });
  });

  it('drops note content and credential-like keys', () => {
    const out = scrubParams({
      note: 'my private notes',
      note_text: 'secret',
      content: 'x',
      text: 'x',
      email: 'student@example.com',
      password: 'hunter2',
      token: 'abc',
      prompt: 'solve this',
      page: '/upgrade',
    } as never);
    expect(out).toEqual({ page: '/upgrade' });
  });

  it('drops values that look like an email address even under a benign key', () => {
    expect(scrubParams({ label: 'student@example.com' })).toEqual({});
  });

  it('drops non-finite numbers, empty strings and nullish values', () => {
    expect(
      scrubParams({ a: Number.NaN, b: Infinity, c: '', d: null, e: undefined } as never),
    ).toEqual({});
  });

  it('truncates long strings', () => {
    const out = scrubParams({ q: 'a'.repeat(500) });
    expect(String(out.q).length).toBe(80);
  });
});

describe('sendServerEvent', () => {
  it('does nothing without analytics consent', async () => {
    consent.granted = false;
    const ok = await sendServerEvent('page_view', { page: '/' });
    expect(ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('writes an allowed event once consent is granted', async () => {
    const ok = await sendServerEvent('pricing_viewed', { plan: 'monthly' });
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row.event_type).toBe('pricing_viewed');
    expect(row.event_data).toEqual({ plan: 'monthly' });
  });

  it('rejects event types outside the allowlist', async () => {
    // @ts-expect-error deliberately invalid
    const ok = await sendServerEvent('made_up_event', {});
    expect(ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('deduplicates repeated identical events in one session', async () => {
    await sendServerEvent('page_view', { page: '/blog' }, { dedupeKey: 'p:/blog', dedupeLimit: 1 });
    await sendServerEvent('page_view', { page: '/blog' }, { dedupeKey: 'p:/blog', dedupeLimit: 1 });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('allows distinct pages through the same session', async () => {
    await sendServerEvent('page_view', { page: '/blog' }, { dedupeKey: 'p:/blog', dedupeLimit: 1 });
    await sendServerEvent('page_view', { page: '/upgrade' }, { dedupeKey: 'p:/upgrade', dedupeLimit: 1 });
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('respects the hard per-session cap', async () => {
    for (let i = 0; i < 200; i += 1) {
      await sendServerEvent('feature_use', { feature: `f${i}` }, { dedupeKey: `f${i}`, dedupeLimit: 1 });
    }
    expect(insert.mock.calls.length).toBeLessThanOrEqual(80);
  });

  it('never throws when the insert fails', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'boom' } });
    await expect(sendServerEvent('feature_use', { feature: 'x' })).resolves.toBe(false);
  });
});

describe('trackServerEvent', () => {
  it('is safe to call in a fire-and-forget way', () => {
    expect(() => trackServerEvent('cta_click', { cta: 'hero' })).not.toThrow();
  });
});

describe('allowlist contract', () => {
  it('contains the funnel events the product emits', () => {
    const required = [
      'page_view',
      'pricing_viewed',
      'signup_completed',
      'first_note_created',
      'checkout_started',
      'payment_succeeded',
      'payment_failed',
    ];
    for (const event of required) {
      expect(SERVER_EVENT_TYPES as readonly string[]).toContain(event);
    }
  });
});
