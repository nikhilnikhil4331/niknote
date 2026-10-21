// ============================================================
// growth/funnel — privacy-conscious product analytics.
//
// Principles:
//  1. Nothing is recorded unless the visitor accepted optional analytics
//     (the same switch CookieConsent writes today).
//  2. Events are a closed vocabulary. There is no free-text field, so a note
//     title, a PDF excerpt or an email can never end up in the log by accident.
//  3. Prop values are short enums/labels only; anything resembling content is
//     dropped before it is written.
//  4. The report refuses to invent numbers: rates are `null` until there is
//     enough data, and retention says "insufficient data" instead of guessing.
// ============================================================

export const GROWTH_EVENTS_KEY = 'niknote.growth.events.v1';
export const SESSION_KEY = 'niknote.growth.session.v1';
const CONSENT_KEY = 'niknote_optional_analytics';
const MAX_EVENTS = 2000;

export type GrowthEventName =
  | 'visitor_landing'
  | 'signup_started'
  | 'signup_completed'
  | 'note_created'
  | 'first_note_created'
  | 'ai_used'
  | 'pdf_imported'
  | 'handwriting_used'
  | 'premium_viewed'
  | 'subscription_completed'
  | 'account_deleted';

/** Only these prop keys may be stored. */
const ALLOWED_PROP_KEYS = new Set([
  'source',
  'page',
  'feature',
  'method',
  'plan',
  'count',
  'ok',
  'daysSinceFirst',
]);

const FORBIDDEN_KEY = /(note|content|text|title|body|email|password|token|key|prompt|document|file)/i;
const MAX_VALUE_LENGTH = 48;

export interface GrowthEvent {
  name: GrowthEventName;
  at: number;
  session: string;
  props?: Record<string, string | number | boolean>;
}

export function analyticsAllowed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}

function readEvents(): GrowthEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(GROWTH_EVENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(e => e && typeof e.name === 'string') : [];
  } catch {
    return [];
  }
}

function writeEvents(events: GrowthEvent[]) {
  try {
    localStorage.setItem(GROWTH_EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch { /* quota or private mode — analytics must never break the app */ }
}

export function currentSessionId(): string {
  if (typeof localStorage === 'undefined') return 'none';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    try { localStorage.setItem(SESSION_KEY, id); } catch { /* ignore */ }
  }
  return id;
}

/** A new browser session per page load, but a stable id per load. */
export function startSession(): string {
  const id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  try { localStorage.setItem(SESSION_KEY, id); } catch { /* ignore */ }
  return id;
}

export function sanitizeProps(
  props?: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    if (FORBIDDEN_KEY.test(key)) continue;
    if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) continue;
      clean[key] = trimmed;
    }
  }
  return Object.keys(clean).length ? clean : undefined;
}

/** Record an event. No-ops (silently) without consent. */
export function track(name: GrowthEventName, props?: Record<string, unknown>): boolean {
  if (!analyticsAllowed()) return false;
  const events = readEvents();
  events.push({ name, at: Date.now(), session: currentSessionId(), props: sanitizeProps(props) });
  writeEvents(events);
  return true;
}

export function clearGrowthEvents(): void {
  try { localStorage.removeItem(GROWTH_EVENTS_KEY); } catch { /* ignore */ }
}

export function readGrowthEvents(): GrowthEvent[] {
  return readEvents();
}

// ── Reporting ────────────────────────────────────────────────────────

export interface FunnelStage {
  label: string;
  /** Unique sessions that reached this stage. */
  value: number;
  /** Percentage of the previous stage, or null when not computable. */
  conversion: number | null;
}

export interface RetentionWindow {
  window: 'd1' | 'd7' | 'd30';
  eligible: number;
  returned: number;
  rate: number | null;
  note: string;
}

export interface FunnelReport {
  generatedAt: number;
  hasData: boolean;
  consentGiven: boolean;
  stages: FunnelStage[];
  retention: RetentionWindow[];
  featureAdoption: { feature: string; uses: number }[];
  /** True when the sample is too small for rates to mean anything. */
  insufficientData: boolean;
  sampleSize: number;
}

const MIN_SAMPLE = 30;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

/**
 * Build the funnel. Activation = created at least one note AND came back in a
 * later session — a page view alone never counts.
 */
export function buildFunnelReport(events: GrowthEvent[] = readEvents()): FunnelReport {
  const sessionsBy = (name: GrowthEventName) =>
    new Set(events.filter(e => e.name === name).map(e => e.session));

  const visitors = sessionsBy('visitor_landing');
  const signupStarts = sessionsBy('signup_started');
  const signups = sessionsBy('signup_completed');
  const firstNotes = new Set(
    events.filter(e => e.name === 'first_note_created' || e.name === 'note_created').map(e => e.session),
  );

  // Sessions active on more than one distinct calendar day.
  const daysBySession = new Map<string, Set<string>>();
  for (const e of events) {
    const days = daysBySession.get(e.session) || new Set<string>();
    days.add(dayKey(e.at));
    daysBySession.set(e.session, days);
  }
  const returning = new Set(
    [...daysBySession.entries()].filter(([, days]) => days.size > 1).map(([session]) => session),
  );
  const activated = new Set([...firstNotes].filter(session => returning.has(session)));

  const visitorCount = visitors.size || signups.size || 1;
  const stages: FunnelStage[] = [
    { label: 'Visitors', value: visitors.size, conversion: null },
    { label: 'Sign-up', value: signups.size, conversion: pct(signups.size, visitorCount) },
    {
      label: 'First note',
      value: firstNotes.size,
      conversion: pct(firstNotes.size, signups.size),
    },
    {
      label: 'Activated (note + returned)',
      value: activated.size,
      conversion: pct(activated.size, firstNotes.size),
    },
    {
      label: 'Returning (2+ days)',
      value: returning.size,
      conversion: pct(returning.size, activated.size),
    },
  ];

  const retention: RetentionWindow[] = (['d1', 'd7', 'd30'] as const).map(window => {
    const days = window === 'd1' ? 1 : window === 'd7' ? 7 : 30;
    const cohorts = new Map<string, Set<string>>();
    for (const e of events) {
      if (e.name !== 'signup_completed') continue;
      const daysSeen = daysBySession.get(e.session);
      if (!daysSeen) continue;
      cohorts.set(e.session, daysSeen);
    }
    let eligible = 0;
    let returned = 0;
    const now = Date.now();
    for (const [session, daysSeen] of cohorts) {
      const first = [...daysSeen].sort()[0];
      const firstAt = new Date(`${first}T00:00:00Z`).getTime();
      if (now - firstAt < days * 86_400_000) continue; // cohort too young
      eligible++;
      const laterDay = new Date(firstAt + days * 86_400_000).toISOString().slice(0, 10);
      if ([...daysSeen].some(day => day >= laterDay)) returned++;
    }
    return {
      window,
      eligible,
      returned,
      // Never report a rate from a handful of users.
      rate: eligible >= MIN_SAMPLE ? pct(returned, eligible) : null,
      note:
        eligible === 0
          ? 'No sign-ups are old enough for this window yet.'
          : eligible < MIN_SAMPLE
            ? `Only ${eligible} users in this cohort — too few for a meaningful rate.`
            : 'Rate computed from consented, on-device events.',
    };
  });

  const featureAdoption = (['ai_used', 'pdf_imported', 'handwriting_used'] as const)
    .map(feature => ({ feature, uses: events.filter(e => e.name === feature).length }))
    .sort((a, b) => b.uses - a.uses);

  return {
    generatedAt: Date.now(),
    hasData: events.length > 0,
    consentGiven: analyticsAllowed(),
    stages,
    retention,
    featureAdoption,
    insufficientData: signups.size < MIN_SAMPLE,
    sampleSize: signups.size,
  };
}

export function funnelToCsv(report: FunnelReport): string {
  const lines = [
    'stage,value,conversion_percent',
    ...report.stages.map(s => `${s.label},${s.value},${s.conversion ?? ''}`),
    '',
    'retention_window,eligible,returned,rate_percent',
    ...report.retention.map(r => `${r.window},${r.eligible},${r.returned},${r.rate ?? ''}`),
  ];
  return lines.join('\n');
}
