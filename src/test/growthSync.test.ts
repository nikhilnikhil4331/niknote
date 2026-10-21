import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => getUserMock() },
    from: () => ({ upsert: (rows: unknown, options: unknown) => upsertMock(rows, options) }),
    rpc: vi.fn(),
  },
}));

import {
  DEVICE_KEY, GROWTH_EVENTS_KEY, SESSION_KEY, track, type GrowthEvent,
} from '@/lib/growth/funnel';
import { syncGrowthEvents, unsyncedGrowthEventCount } from '@/lib/growth/sync';

const CONSENT_KEY = 'niknote_optional_analytics';

function seed(events: GrowthEvent[]) {
  localStorage.setItem(GROWTH_EVENTS_KEY, JSON.stringify(events));
}

function stored(): GrowthEvent[] {
  return JSON.parse(localStorage.getItem(GROWTH_EVENTS_KEY) || '[]');
}

beforeEach(() => {
  localStorage.clear();
  upsertMock.mockReset();
  getUserMock.mockReset();
  upsertMock.mockResolvedValue({ error: null });
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('server funnel sync', () => {
  it('does nothing without analytics consent', async () => {
    seed([{ id: 'a', name: 'note_created', at: Date.now(), session: 's1' }]);
    const result = await syncGrowthEvents();
    expect(result).toEqual({ uploaded: 0, skipped: 0, error: 'no-consent' });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('uploads pending events with their client id and marks them synced', async () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    localStorage.setItem(SESSION_KEY, 's1');
    seed([
      { id: 'evt-1', name: 'note_created', at: Date.now(), session: 's1', props: { feature: 'editor' } },
      { id: 'evt-2', name: 'visitor_landing', at: Date.now(), session: 's1' },
    ]);

    const first = await syncGrowthEvents();
    expect(first.uploaded).toBe(2);
    expect(first.error).toBeUndefined();

    const [rows] = upsertMock.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'evt-1',
      user_id: 'user-1',
      name: 'note_created',
      props: { feature: 'editor' },
    });
    // The id makes retries idempotent.
    expect(upsertMock.mock.calls[0][1]).toEqual({ onConflict: 'id', ignoreDuplicates: true });

    expect(stored().every(event => event.synced)).toBe(true);
    expect(unsyncedGrowthEventCount()).toBe(0);

    const second = await syncGrowthEvents();
    expect(second.uploaded).toBe(0);
  });

  it('keeps events pending when the upload fails, so the next visit retries', async () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    upsertMock.mockResolvedValue({ error: { message: 'relation does not exist' } });
    seed([{ id: 'evt-3', name: 'note_created', at: Date.now(), session: 's1' }]);

    const result = await syncGrowthEvents();
    expect(result.uploaded).toBe(0);
    expect(result.error).toContain('relation does not exist');
    expect(unsyncedGrowthEventCount()).toBe(1);
  });

  it('only uploads pre-login events while signed out', async () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    getUserMock.mockResolvedValue({ data: { user: null } });
    seed([
      { id: 'evt-4', name: 'visitor_landing', at: Date.now(), session: 's1' },
      { id: 'evt-5', name: 'note_created', at: Date.now(), session: 's1' },
    ]);

    const result = await syncGrowthEvents();
    expect(result.uploaded).toBe(1);
    expect(result.skipped).toBe(1);

    const [rows] = upsertMock.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('visitor_landing');
    expect(rows[0].user_id).toBeNull();
    expect(rows[0].anonymous_id).toBe(localStorage.getItem(DEVICE_KEY));
    // The note event stays queued for after login.
    expect(unsyncedGrowthEventCount()).toBe(1);
  });

  it('never puts note text in the payload', async () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    track('note_created', { feature: 'editor', noteText: 'my private notes', title: 'secret' });
    await syncGrowthEvents();

    const [rows] = upsertMock.mock.calls[0];
    const payload = JSON.stringify(rows);
    expect(payload).not.toContain('private notes');
    expect(payload).not.toContain('secret');
    expect(rows[0].props).toEqual({ feature: 'editor' });
  });
});
