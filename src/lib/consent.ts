// ============================================================
// NikNote — Unified Privacy & Cookie Consent State
// Single source of truth for Essential, Analytics (GA4/local),
// and Marketing (Meta Pixel) consent across the application.
// ============================================================

export const COOKIE_CONSENT_KEY = 'niknote_cookie_consent';
export const LEGACY_ANALYTICS_CONSENT_KEY = 'niknote_optional_analytics';
export const CONSENT_UPDATED_EVENT = 'niknote:consent-updated';
export const OPEN_COOKIE_SETTINGS_EVENT = 'niknote:cookie-settings';

export interface CookieConsentState {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

/**
 * Reads stored user consent, or returns `null` if the user has not yet made a choice.
 * Non-essential tracking must NEVER fire when this returns `null`.
 */
export function getSavedConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          essential: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
          timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : '',
        };
      }
    }

    // Legacy key compatibility (only grants analytics, never marketing)
    const legacy = localStorage.getItem(LEGACY_ANALYTICS_CONSENT_KEY);
    if (legacy === 'accepted') {
      return { essential: true, analytics: true, marketing: false, timestamp: '' };
    }
    if (legacy === 'declined') {
      return { essential: true, analytics: false, marketing: false, timestamp: '' };
    }
  } catch {
    // Storage blocked in strict private browsing — default to no non-essential tracking
  }
  return null;
}

export function hasAnalyticsConsent(): boolean {
  return Boolean(getSavedConsent()?.analytics);
}

export function hasMarketingConsent(): boolean {
  return Boolean(getSavedConsent()?.marketing);
}

export function saveConsentPreferences(input: {
  analytics: boolean;
  marketing: boolean;
}): CookieConsentState {
  const next: CookieConsentState = {
    essential: true,
    analytics: Boolean(input.analytics),
    marketing: Boolean(input.marketing),
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next));
      localStorage.setItem(LEGACY_ANALYTICS_CONSENT_KEY, next.analytics ? 'accepted' : 'declined');
    } catch {
      // Ignore storage quota / private mode failures
    }
    window.dispatchEvent(new CustomEvent<CookieConsentState>(CONSENT_UPDATED_EVENT, { detail: next }));
  }

  return next;
}

export function formatConsentSummary(state: CookieConsentState | null): string {
  if (!state) return 'not set yet';
  if (state.analytics && state.marketing) return 'analytics & marketing allowed';
  if (state.analytics) return 'analytics only';
  if (state.marketing) return 'marketing only';
  return 'essential only';
}
