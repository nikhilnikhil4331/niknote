// ============================================================
// NikNote — Server-side product analytics
//
// Before this module existed, `trackEvent` only ever wrote to localStorage.
// Nothing left the browser, so the founder had zero visibility into what
// visitors actually did. analytics_events held a single row in the project's
// entire history.
//
// Design constraints:
//  - Consent-gated. Nothing is sent unless analytics consent was granted.
//  - Fire-and-forget. Analytics must never block a user action or throw.
//  - Scrubbed. No note content, prompts, emails, tokens or free text.
//  - Rate limited. A hard per-session cap plus per-event dedupe so a broken
//    component cannot flood the database.
//  - Lazily imported so the Supabase client is not pulled into the entry chunk.
// ============================================================
import { hasAnalyticsConsent } from '@/lib/consent';

/** Must stay in sync with the allowlist in validate_analytics_event(). */
export const SERVER_EVENT_TYPES = [
  'page_view',
  'landing_page_viewed',
  'pricing_viewed',
  'signup_started',
  'signup_completed',
  'onboarding_completed',
  'first_note_created',
  'note_exported',
  'returning_session_started',
  'checkout_started',
  'payment_succeeded',
  'payment_failed',
  'payment_success',
  'subscription_cancelled',
  'feature_use',
  'share',
  'pdf_export',
  'ai_query',
  'signup_attempt',
  'cta_click',
  'generate_lead',
  'b2b_lead',
  'app_error',
] as const;

export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];

/** Keys that must never reach the analytics table. */
const FORBIDDEN_KEYS =
  /^(note|notes|note_text|note_content|content|text|body|markdown|html|email|user_email|password|token|auth_token|jwt|secret|api_key|prompt|message|name|phone)$/i;

const EMAIL_LIKE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const SESSION_CAP_KEY = 'niknote_srv_event_count';
const SESSION_CAP = 80;
const DEDUPE_PREFIX = 'niknote_srv_seen:';

export type EventParams = Record<string, string | number | boolean>;

export function scrubParams(params?: EventParams): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  if (!params) return clean;

  for (const [key, raw] of Object.entries(params)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    if (raw === null || raw === undefined) continue;

    if (typeof raw === 'number') {
      if (Number.isFinite(raw)) clean[key] = raw;
      continue;
    }
    if (typeof raw === 'boolean') {
      clean[key] = raw;
      continue;
    }
    if (typeof raw === 'string') {
      const value = raw.trim();
      if (!value) continue;
      if (EMAIL_LIKE.test(value)) continue;
      clean[key] = value.slice(0, 80);
    }
  }
  return clean;
}

function canSend(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (!hasAnalyticsConsent()) return false;
    const used = Number(sessionStorage.getItem(SESSION_CAP_KEY) || '0');
    if (!Number.isFinite(used) || used >= SESSION_CAP) return false;
  } catch {
    return false;
  }
  return true;
}

function markSeen(key: string, limit: number): boolean {
  try {
    const storageKey = DEDUPE_PREFIX + key;
    const seen = Number(sessionStorage.getItem(storageKey) || '0');
    if (seen >= limit) return false;
    sessionStorage.setItem(storageKey, String(seen + 1));
    const used = Number(sessionStorage.getItem(SESSION_CAP_KEY) || '0');
    sessionStorage.setItem(SESSION_CAP_KEY, String(used + 1));
    return true;
  } catch {
    return false;
  }
}

/**
 * Full URL including the query string, because campaign attribution
 * (?utm_source=...) is the only way channel_performance can tell an
 * Instagram visitor from an organic one. Query is dropped entirely if it
 * looks like it carries an identifier we should not store.
 */
function currentPath(): string {
  try {
    const base = `${window.location.origin}${window.location.pathname}`;
    const search = window.location.search || '';
    if (!search) return base;
    if (EMAIL_LIKE.test(search)) return base;
    if (/[?&](email|phone|token|password|key|auth)=/i.test(search)) return base;
    return `${base}${search}`.slice(0, 300);
  } catch {
    return '';
  }
}

function currentReferrer(): string {
  try {
    const ref = document.referrer || '';
    if (!ref) return '';
    return ref === window.location.href ? '' : ref;
  } catch {
    return '';
  }
}

/**
 * Persist one product event to Supabase. Resolves to true when the row was
 * accepted. Never rejects.
 */
export async function sendServerEvent(
  eventType: ServerEventType,
  params?: EventParams,
  options?: { dedupeKey?: string; dedupeLimit?: number },
): Promise<boolean> {
  if (!SERVER_EVENT_TYPES.includes(eventType)) return false;
  if (!canSend()) return false;

  const key = options?.dedupeKey ?? eventType;
  if (!markSeen(key, options?.dedupeLimit ?? 5)) return false;

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.from('analytics_events').insert({
      event_type: eventType,
      event_data: scrubParams(params),
      page_url: currentPath(),
      referrer: currentReferrer(),
    });
    // A failed analytics insert is never surfaced to the user.
    return !error;
  } catch {
    return false;
  }
}

/** Fire and forget wrapper for use inside UI handlers. */
export function trackServerEvent(
  eventType: ServerEventType,
  params?: EventParams,
  options?: { dedupeKey?: string; dedupeLimit?: number },
): void {
  void sendServerEvent(eventType, params, options).catch(() => {});
}
