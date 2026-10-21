// ============================================================
// growth/sync — push the local funnel to the server, idempotently.
//
// Rules that are not negotiable:
//  - nothing is uploaded without analytics consent;
//  - nothing is uploaded twice (each event carries a client-generated id);
//  - signed-out events are limited to the two that can happen before login;
//  - no note text, title, email or prompt exists in the payload by design.
//
// Failure is silent by intention: if the table is missing or the network is
// down, the local log keeps working and the next visit retries.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import {
  analyticsAllowed,
  deviceId,
  readEvents,
  writeEvents,
  type GrowthEvent,
} from './funnel';

const BATCH_SIZE = 40;
const ANONYMOUS_ALLOWED = new Set(['visitor_landing', 'signup_started']);

export interface SyncResult {
  uploaded: number;
  skipped: number;
  error?: string;
}

function isoAt(event: GrowthEvent): string {
  return new Date(event.at).toISOString();
}

/**
 * Upload pending events for the current user. Returns what actually happened
 * so the dashboard can report "not synced yet" instead of pretending.
 */
export async function syncGrowthEvents(): Promise<SyncResult> {
  if (!analyticsAllowed()) return { uploaded: 0, skipped: 0, error: 'no-consent' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { uploaded: 0, skipped: 0, error: 'offline' };
  }

  const events = readEvents();
  const pending = events.filter(event => !event.synced).slice(0, BATCH_SIZE);
  if (!pending.length) return { uploaded: 0, skipped: 0 };

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }

  const device = deviceId();
  const rows = pending
    .filter(event => userId !== null || ANONYMOUS_ALLOWED.has(event.name))
    .map(event => ({
      id: event.id,
      user_id: userId,
      anonymous_id: userId ? null : device,
      name: event.name,
      props: event.props ?? {},
      occurred_at: isoAt(event),
    }));

  const skipped = pending.length - rows.length;
  if (!rows.length) return { uploaded: 0, skipped, error: 'sign-in-required' };

  const { error } = await supabase
    .from('growth_events' as never)
    .upsert(rows as never, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    // Keep everything pending; the next visit retries. A missing table is the
    // most likely cause right after a fresh environment.
    return { uploaded: 0, skipped, error: error.message };
  }

  const uploadedIds = new Set(rows.map(row => row.id));
  writeEvents(events.map(event => (
    uploadedIds.has(event.id) ? { ...event, synced: true } : event
  )));

  return { uploaded: rows.length, skipped };
}

/** How many events are still waiting for the network. */
export function unsyncedGrowthEventCount(): number {
  return readEvents().filter(event => !event.synced).length;
}

export interface ServerFunnelRow {
  day: string;
  name: string;
  events: number;
  unique_actors: number;
}

/**
 * Aggregated funnel from the server (admin only). Returns null with a reason
 * instead of zeros when the call is not allowed or the function is missing —
 * an empty chart must never look like "zero users".
 */
export async function fetchServerFunnel(days = 30): Promise<
  { rows: ServerFunnelRow[]; error?: undefined } | { rows: []; error: string }
> {
  try {
    const { data, error } = await supabase.rpc('growth_event_summary' as never, {
      p_days: Math.max(1, Math.min(180, Math.round(days))),
    } as never);
    if (error) return { rows: [], error: error.message };
    const rows = Array.isArray(data) ? (data as ServerFunnelRow[]) : [];
    return { rows };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'unknown error' };
  }
}
