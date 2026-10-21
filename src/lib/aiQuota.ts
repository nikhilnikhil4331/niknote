/**
 * Shared AI quota helpers — used by both sides of the proxy.
 *
 * Server (`api/ai.ts`): decides whether a request may spend provider credit and
 * tells the client what is left through response headers.
 * Client (`src/lib/aiEngine.ts`): reads those headers so the UI can show an
 * honest "X requests left this hour" instead of a silent failure.
 *
 * The metering itself lives in Postgres:
 *   - signed-in  -> `public.consume_ai_quota(limit, window)` (keyed on auth.uid())
 *   - signed-out -> `public.consume_anon_quota(bucket, limit, window)` (keyed on a
 *                   salted hash of IP + user-agent; no raw IP is ever stored)
 */

export type AiQuotaScope = 'user' | 'anon' | 'unknown';

export interface AiQuotaSnapshot {
  allowed: boolean;
  used: number;
  remaining: number;
  /** ISO timestamp when the current window rolls over. */
  resetAt: string | null;
}

const MAX_REMEMBERED = Number.MAX_SAFE_INTEGER;

function toFiniteInt(value: unknown): number | null {
  // null / '' / missing must stay "unknown", not silently become 0.
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(MAX_REMEMBERED, Math.floor(n));
}

/**
 * Accepts the shapes PostgREST can return for a `RETURNS TABLE` RPC
 * (`[{...}]`, `{...}`, or snake_case variants) and normalises them.
 * Returns null for anything unrecognisable so callers can fail open.
 */
export function parseQuotaPayload(payload: unknown): AiQuotaSnapshot | null {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') return null;

  const record = row as Record<string, unknown>;
  if (typeof record.allowed !== 'boolean') return null;

  const used = toFiniteInt(record.used);
  const remaining = toFiniteInt(record.remaining);
  // A negative `remaining` from the RPC means "over quota", which is 0 left.
  const clampedRemaining = remaining === null && Number(record.remaining) < 0 ? 0 : remaining;
  if (used === null || clampedRemaining === null) return null;

  const rawReset = record.reset_at ?? record.resetAt;
  const resetAt = typeof rawReset === 'string' && rawReset.trim() ? rawReset : null;

  return { allowed: record.allowed, used, remaining: clampedRemaining, resetAt };
}

/** Headers the proxy attaches to every AI response so the client can show quota. */
export function quotaHeaders(snapshot: AiQuotaSnapshot | null, scope: AiQuotaScope): Record<string, string> {
  const headers: Record<string, string> = { 'X-NikNote-Quota': scope };
  if (!snapshot) return headers;
  headers['X-NikNote-Quota-Allowed'] = String(snapshot.allowed);
  headers['X-NikNote-Quota-Remaining'] = String(snapshot.remaining);
  headers['X-NikNote-Quota-Used'] = String(snapshot.used);
  if (snapshot.resetAt) headers['X-NikNote-Quota-Reset'] = snapshot.resetAt;
  return headers;
}

/** Client-side reader for the headers above (returns null when unmetered). */
export function readQuotaHeaders(headers: Headers): { scope: AiQuotaScope; remaining: number | null; resetAt: string | null } {
  const scopeRaw = headers.get('x-niknote-quota');
  const scope: AiQuotaScope = scopeRaw === 'user' || scopeRaw === 'anon' ? scopeRaw : 'unknown';
  const remaining = toFiniteInt(headers.get('x-niknote-quota-remaining'));
  const resetRaw = headers.get('x-niknote-quota-reset');
  return { scope, remaining, resetAt: resetRaw && resetRaw.trim() ? resetRaw : null };
}

/**
 * Builds the anonymous quota bucket: salted SHA-256 of whatever the edge runtime
 * exposes (IP + user-agent), truncated to 32 hex chars. Irreversible, stable for
 * an hour, and never stored next to anything identifying.
 */
export async function anonQuotaBucket(clientKey: string, salt = 'niknote-anon-quota-v1'): Promise<string> {
  const input = `${salt}|${clientKey.trim()}`;
  const bytes = new TextEncoder().encode(input);
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('crypto.subtle unavailable');
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** Honest, user-facing copy for a 429 — no fake countdowns. */
export function quotaExceededMessage(snapshot: AiQuotaSnapshot | null): string {
  if (snapshot?.resetAt) {
    const when = new Date(snapshot.resetAt);
    if (!Number.isNaN(when.getTime())) {
      const minutes = Math.max(1, Math.ceil((when.getTime() - Date.now()) / 60000));
      return `Hourly AI limit reached (${snapshot.used} requests). NikAI works again in about ${minutes} min.`;
    }
  }
  return 'Hourly AI limit reached. Please try again a little later.';
}
