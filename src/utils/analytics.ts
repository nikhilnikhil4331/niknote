// ============================================================
// NikNote 4.0 — Analytics & Growth Tracking Engine
// Simple, privacy-first analytics using localStorage
// (Server-side analytics would need Supabase integration)
// ============================================================

const ANALYTICS_KEY = 'niknote_analytics';
const CONSENT_KEY = 'niknote_optional_analytics';

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
  if (localStorage.getItem(CONSENT_KEY) !== 'accepted') return;
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

// Track AI query
export function trackAIQuery(topic: string): void {
  trackEvent('ai_query', { topic: topic.slice(0, 50) });
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
