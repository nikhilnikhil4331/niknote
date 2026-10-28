// ============================================================
// NikNote 4.0 — Analytics & Growth Tracking Engine
// Simple, privacy-first analytics using localStorage
// (Server-side analytics would need Supabase integration)
// ============================================================

import { hasAnalyticsConsent } from '@/lib/consent';
import {
  SERVER_EVENT_TYPES,
  trackServerEvent,
  type ServerEventType,
} from '@/lib/serverAnalytics';

const ANALYTICS_KEY = 'niknote_analytics';

interface AnalyticsEvent {
  event: string;
  timestamp: number;
  data?: Record<string, string | number>;
}

interface AnalyticsSummary {
  totalEvents: number;
  uniqueDays: number;
  pageViews: { [page: string]: number };
  featureUsage: { [feature: string]: number };
  shareActions: { [platform: string]: number };
  signUpAttempts: number;
  pdfExports: number;
  aiQueries: number;
  firstVisit: number;
  lastVisit: number;
  sessionCount: number;
}

// Track an event
export function trackEvent(event: string, data?: Record<string, string | number>): void {
  if (!hasAnalyticsConsent()) return;

  // Mirror allowed events to the server so the founder can actually see them.
  // Previously every event died in localStorage.
  if ((SERVER_EVENT_TYPES as readonly string[]).includes(event)) {
    // Per-page dedupe: an SPA fires page_view on every route change, so a
    // single global key would silently cap a session at a handful of views.
    const page = typeof data?.page === 'string' ? data.page : '';
    const dedupeKey = page ? `${event}:${page}` : event;
    trackServerEvent(event as ServerEventType, data, {
      dedupeKey,
      dedupeLimit: event === 'page_view' ? 1 : 5,
    });
  }

  try {
    const events: AnalyticsEvent[] = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
    events.push({
      event,
      timestamp: Date.now(),
      data,
    });

    // Keep only last 1000 events
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }

    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));

    // Track session
    const today = new Date().toDateString();
    const lastSession = localStorage.getItem('niknote_last_session');
    if (lastSession !== today) {
      localStorage.setItem('niknote_last_session', today);
      const sessions = parseInt(localStorage.getItem('niknote_sessions') || '0', 10);
      localStorage.setItem('niknote_sessions', (sessions + 1).toString());
    }
  } catch (e) {
    // Analytics should never break the app
  }
}

// Get analytics summary
export function getAnalyticsSummary(): AnalyticsSummary {
  try {
    const events: AnalyticsEvent[] = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');

    const summary: AnalyticsSummary = {
      totalEvents: events.length,
      uniqueDays: new Set(events.map(e => new Date(e.timestamp).toDateString())).size,
      pageViews: {},
      featureUsage: {},
      shareActions: {},
      signUpAttempts: 0,
      pdfExports: 0,
      aiQueries: 0,
      firstVisit: events[0]?.timestamp || Date.now(),
      lastVisit: events[events.length - 1]?.timestamp || Date.now(),
      sessionCount: parseInt(localStorage.getItem('niknote_sessions') || '1', 10),
    };

    events.forEach(e => {
      // Page views
      if (e.event === 'page_view' && e.data?.page) {
        summary.pageViews[e.data.page as string] = (summary.pageViews[e.data.page as string] || 0) + 1;
      }
      // Feature usage
      if (e.event === 'feature_use' && e.data?.feature) {
        summary.featureUsage[e.data.feature as string] = (summary.featureUsage[e.data.feature as string] || 0) + 1;
      }
      // Share actions
      if (e.event === 'share' && e.data?.platform) {
        summary.shareActions[e.data.platform as string] = (summary.shareActions[e.data.platform as string] || 0) + 1;
      }
      // Sign up attempts
      if (e.event === 'signup_attempt') summary.signUpAttempts++;
      // PDF exports
      if (e.event === 'pdf_export') summary.pdfExports++;
      // AI queries
      if (e.event === 'ai_query') summary.aiQueries++;
    });

    return summary;
  } catch {
    return {
      totalEvents: 0, uniqueDays: 0, pageViews: {}, featureUsage: {},
      shareActions: {}, signUpAttempts: 0, pdfExports: 0, aiQueries: 0,
      firstVisit: Date.now(), lastVisit: Date.now(), sessionCount: 1,
    };
  }
}

// Track page view
export function trackPageView(page: string): void {
  trackEvent('page_view', { page });
}

// Track feature usage
export function trackFeatureUse(feature: string): void {
  trackEvent('feature_use', { feature });
}

// Track share action
export function trackShareAction(platform: string): void {
  trackEvent('share', { platform });
}

// Track PDF export
export function trackPDFExport(pages: number): void {
  trackEvent('pdf_export', { pages });
}

// Track AI query (do not record raw prompt text)
export function trackAIQuery(_topic?: string): void {
  trackEvent('ai_query');
}

// Track signup
export function trackSignupAttempt(method: string): void {
  trackEvent('signup_attempt', { method });
}

// Get user engagement score (0-100)
export function getEngagementScore(): number {
  const summary = getAnalyticsSummary();
  let score = 0;

  // Active days (max 30 points)
  score += Math.min(summary.uniqueDays * 2, 30);

  // Feature usage (max 20 points)
  const featureCount = Object.keys(summary.featureUsage).length;
  score += Math.min(featureCount * 4, 20);

  // AI queries (max 20 points)
  score += Math.min(summary.aiQueries * 2, 20);

  // PDF exports (max 15 points)
  score += Math.min(summary.pdfExports * 3, 15);

  // Shares (max 15 points)
  const totalShares = Object.values(summary.shareActions).reduce((a, b) => a + b, 0);
  score += Math.min(totalShares * 3, 15);

  return Math.min(score, 100);
}

// Format engagement level
export function getEngagementLevel(score: number): { level: string; emoji: string; color: string } {
  if (score >= 80) return { level: 'Super User', emoji: '🏆', color: 'text-amber-500' };
  if (score >= 60) return { level: 'Power User', emoji: '⚡', color: 'text-blue-500' };
  if (score >= 40) return { level: 'Active User', emoji: '🔥', color: 'text-orange-500' };
  if (score >= 20) return { level: 'Regular User', emoji: '📚', color: 'text-green-500' };
  return { level: 'New Explorer', emoji: '🌱', color: 'text-gray-500' };
}

// ============================================================
// Acquisition funnel events (Phase 8)
// These are the events that answer "where do visitors drop off?"
// ============================================================

/** Visitor landed on the public marketing surface. */
export function trackLandingView(source?: string): void {
  trackServerEvent('landing_page_viewed', source ? { source } : undefined, {
    dedupeKey: 'landing_page_viewed',
    dedupeLimit: 1,
  });
}

/** Visitor opened the pricing / upgrade surface. */
export function trackPricingViewed(plan?: string): void {
  trackServerEvent('pricing_viewed', plan ? { plan } : undefined, {
    dedupeKey: 'pricing_viewed',
    dedupeLimit: 2,
  });
}

export function trackCheckoutStarted(plan: string): void {
  trackServerEvent('checkout_started', { plan });
}

export function trackPaymentSucceeded(plan: string): void {
  trackServerEvent('payment_succeeded', { plan }, { dedupeKey: `paid:${plan}`, dedupeLimit: 1 });
}

export function trackPaymentFailed(plan: string, reason?: string): void {
  trackServerEvent('payment_failed', reason ? { plan, reason } : { plan });
}

export function trackSignupCompleted(method: string): void {
  trackServerEvent('signup_completed', { method }, { dedupeKey: 'signup_completed', dedupeLimit: 1 });
}

export function trackFirstNoteCreated(): void {
  // Only the first real activation matters, so dedupe hard.
  trackServerEvent('first_note_created', undefined, {
    dedupeKey: 'first_note_created',
    dedupeLimit: 1,
  });
}

export function trackReturningSession(): void {
  trackServerEvent('returning_session_started', undefined, {
    dedupeKey: 'returning_session_started',
    dedupeLimit: 1,
  });
}
