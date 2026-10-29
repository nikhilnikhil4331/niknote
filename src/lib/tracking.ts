// ============================================================
// NikNote — Production GA4 & Meta Pixel Tracking Engine
// - Consent-gated (Google Consent Mode v2 + Meta Pixel consent)
// - CSP-safe (no inline <script>; external scripts loaded once)
// - SPA route deduplication & transaction_id purchase dedup
// - Strict PII & note-content scrubbing
// ============================================================

import {
  CONSENT_UPDATED_EVENT,
  hasAnalyticsConsent,
  hasMarketingConsent,
} from '@/lib/consent';
import { resolveRouteSeo } from '@/lib/seoConfig';
import { trackEvent as trackLocalEvent } from '@/utils/analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: unknown;
  }
}

const SESSION_STARTED_KEY = 'niknote_ga_session_started';
const RECORDED_PURCHASES_KEY = 'niknote_recorded_purchases_v1';

const FORBIDDEN_PARAM_PATTERN =
  /^(note|notes|note_content|note_text|note_body|content|text|body|markdown|html|email|user_email|password|pass|token|auth_token|jwt|secret|api_key|private_key|key|phone|mobile|card|cvv|upi|signature|prompt|user_prompt|message|name|full_name|username|address|file_content)$/i;

const EMAIL_LIKE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

interface TrackingConfig {
  gaMeasurementId: string;
  metaPixelId: string;
}

function readEnvConfig(): TrackingConfig {
  // Refer to public identifiers individually: reading the whole Vite env
  // object would embed every VITE_* variable in the browser bundle.
  return {
    gaMeasurementId: (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim(),
    metaPixelId: (import.meta.env.VITE_META_PIXEL_ID ?? '').trim(),
  };
}

let activeConfig: TrackingConfig = readEnvConfig();
let gaInitializedId: string | null = null;
let pixelInitializedId: string | null = null;
let consentListenerBound = false;
let lastTrackedRouteKey: string | null = null;
let lastKnownRoute: { pathname: string; search: string } | null = null;
const recordedTransactions = new Set<string>();

export function isValidGaMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]{4,20}$/i.test(id.trim());
}

export function isValidMetaPixelId(id: string): boolean {
  return /^\d{10,20}$/.test(id.trim());
}

export function getTrackingStatus() {
  const gaConfigured = isValidGaMeasurementId(activeConfig.gaMeasurementId);
  const pixelConfigured = isValidMetaPixelId(activeConfig.metaPixelId);
  return {
    gaConfigured,
    gaInitialized: Boolean(gaInitializedId),
    metaPixelConfigured: pixelConfigured,
    metaPixelInitialized: Boolean(pixelInitializedId),
    analyticsConsent: hasAnalyticsConsent(),
    marketingConsent: hasMarketingConsent(),
  };
}

/**
 * Scrubs event parameters so private note content, prompts, emails,
 * passwords, tokens, or payment secrets can never be transmitted.
 */
export function sanitizeTrackingParams(
  raw?: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  if (!raw) return clean;

  for (const [key, value] of Object.entries(raw)) {
    if (FORBIDDEN_PARAM_PATTERN.test(key)) continue;
    if (value === null || value === undefined) continue;

    if (typeof value === 'number') {
      if (Number.isFinite(value)) clean[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      clean[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (EMAIL_LIKE_PATTERN.test(trimmed)) continue;
      clean[key] = trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
    }
  }
  return clean;
}

function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });
  }
}

function initGA4IfPermitted(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const gaId = activeConfig.gaMeasurementId;
  if (!isValidGaMeasurementId(gaId)) return false;
  if (!hasAnalyticsConsent()) return false;

  ensureGtagStub();
  window.gtag!('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: hasMarketingConsent() ? 'granted' : 'denied',
    ad_user_data: hasMarketingConsent() ? 'granted' : 'denied',
    ad_personalization: hasMarketingConsent() ? 'granted' : 'denied',
  });

  if (gaInitializedId === gaId) return true;

  if (!document.head.querySelector('script[data-niknote-ga="true"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    script.setAttribute('data-niknote-ga', 'true');
    document.head.appendChild(script);
  }

  window.gtag!('js', new Date());
  window.gtag!('config', gaId, {
    send_page_view: false, // SPA handles deduplicated page_view explicitly
    anonymize_ip: true,
  });

  gaInitializedId = gaId;
  return true;
}

function ensureFbqStub(): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq === 'function') return;

  const fbq: NonNullable<Window['fbq']> = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue!.push(args);
    }
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
}

function initMetaPixelIfPermitted(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const pixelId = activeConfig.metaPixelId;
  if (!isValidMetaPixelId(pixelId)) return false;
  if (!hasMarketingConsent()) return false;

  ensureFbqStub();
  window.fbq!('consent', 'grant');

  if (pixelInitializedId === pixelId) return true;

  if (!document.head.querySelector('script[data-niknote-fbq="true"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.setAttribute('data-niknote-fbq', 'true');
    document.head.appendChild(script);
  }

  window.fbq!('init', pixelId);
  pixelInitializedId = pixelId;
  return true;
}

export function syncConsentWithTrackers(): void {
  if (typeof window === 'undefined') return;

  const analyticsAllowed = hasAnalyticsConsent();
  const marketingAllowed = hasMarketingConsent();

  if (gaInitializedId && window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: analyticsAllowed ? 'granted' : 'denied',
      ad_storage: marketingAllowed ? 'granted' : 'denied',
      ad_user_data: marketingAllowed ? 'granted' : 'denied',
      ad_personalization: marketingAllowed ? 'granted' : 'denied',
    });
  } else if (analyticsAllowed) {
    initGA4IfPermitted();
  }

  if (pixelInitializedId && window.fbq) {
    window.fbq('consent', marketingAllowed ? 'grant' : 'revoke');
  } else if (marketingAllowed) {
    initMetaPixelIfPermitted();
  }

  // If the user just granted consent on the current page, record the active page view once
  if ((analyticsAllowed || marketingAllowed) && lastKnownRoute && !lastTrackedRouteKey) {
    trackRouteView(lastKnownRoute.pathname, lastKnownRoute.search);
  }
}

export function initTracking(): void {
  if (typeof window === 'undefined') return;
  if (!consentListenerBound) {
    window.addEventListener(CONSENT_UPDATED_EVENT, syncConsentWithTrackers);
    consentListenerBound = true;
  }
  syncConsentWithTrackers();
}

function sendGA4Event(eventName: string, params?: Record<string, unknown>, extraPayload?: Record<string, unknown>): void {
  const safe = sanitizeTrackingParams(params);
  // Always mirror into privacy-first local analytics (itself gated by consent)
  trackLocalEvent(eventName, safe as Record<string, string | number>);

  if (!initGA4IfPermitted() || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, extraPayload ? { ...safe, ...extraPayload } : safe);
}

function sendMetaEvent(
  standardEvent: 'PageView' | 'ViewContent' | 'CompleteRegistration' | 'Lead' | 'InitiateCheckout' | 'Purchase',
  params?: Record<string, unknown>,
  options?: { eventID?: string },
): void {
  if (!initMetaPixelIfPermitted() || typeof window.fbq !== 'function') return;
  const safe = sanitizeTrackingParams(params);
  if (options?.eventID) {
    window.fbq('track', standardEvent, safe, { eventID: options.eventID });
  } else {
    window.fbq('track', standardEvent, safe);
  }
}

// ============================================================
// Public Event API — Mapped to Real NikNote User Journey
// ============================================================

/**
 * 1 & 2. `page_view` + `session_start` (GA4) and `PageView` + `ViewContent` (Meta Pixel)
 * Deduplicated across SPA route changes and skips internal `/admin` routes.
 */
export function trackRouteView(pathname: string, search: string = ''): void {
  if (typeof window === 'undefined') return;
  lastKnownRoute = { pathname, search };

  // Never send internal admin paths to external analytics/ad platforms
  if (pathname.startsWith('/admin')) return;

  const analyticsAllowed = hasAnalyticsConsent();
  const marketingAllowed = hasMarketingConsent();
  if (!analyticsAllowed && !marketingAllowed) return;

  const routeKey = `${pathname}${search}`;
  if (lastTrackedRouteKey === routeKey) return;
  lastTrackedRouteKey = routeKey;

  const seo = resolveRouteSeo(pathname);

  if (analyticsAllowed) {
    try {
      if (!sessionStorage.getItem(SESSION_STARTED_KEY)) {
        sessionStorage.setItem(SESSION_STARTED_KEY, '1');
        sendGA4Event('session_start', {
          page_type: seo.pageType,
          landing_path: pathname,
        });
      }
    } catch {
      // sessionStorage unavailable
    }

    sendGA4Event('page_view', {
      page_path: pathname,
      page_title: seo.title,
      page_location: `${window.location.origin}${pathname}${search}`,
      page_type: seo.pageType,
    });
  }

  if (marketingAllowed) {
    sendMetaEvent('PageView');
    if (seo.trackViewContent) {
      sendMetaEvent('ViewContent', {
        content_name: seo.title,
        content_category: seo.pageType,
        content_type: 'product',
      });
    }
  }
}

/**
 * 3. `sign_up` (GA4) + `CompleteRegistration` (Meta Pixel)
 * Strictly ignores guest/anonymous sessions per Phase 6 rules.
 */
export function trackSignUpCompleted(method: 'email' | 'google' | string, source = 'auth_page'): void {
  const normalized = (method || '').toLowerCase().trim();
  if (!normalized || normalized === 'guest' || normalized === 'anonymous' || normalized === 'anon') {
    return;
  }
  sendGA4Event('sign_up', {
    method: normalized,
    conversion_source: source,
    page_type: 'auth',
  });
  sendMetaEvent('CompleteRegistration', {
    content_name: normalized,
    status: true,
  });
}

/**
 * 4. `login` (GA4)
 * Strictly ignores guest/anonymous sessions.
 */
export function trackLoginCompleted(method: 'email' | 'google' | string, source = 'auth_page'): void {
  const normalized = (method || '').toLowerCase().trim();
  if (!normalized || normalized === 'guest' || normalized === 'anonymous' || normalized === 'anon') {
    return;
  }
  sendGA4Event('login', {
    method: normalized,
    conversion_source: source,
    page_type: 'auth',
  });
}

/**
 * 5. `begin_checkout` (GA4) + `InitiateCheckout` (Meta Pixel)
 * Fired ONLY when user actively starts Razorpay checkout, NOT on page load.
 */
export function trackBeginCheckout(input: {
  planCode: string;
  planName: string;
  value: number;
  currency?: string;
}): void {
  const currency = input.currency || 'INR';
  sendGA4Event(
    'begin_checkout',
    {
      currency,
      value: input.value,
      plan_name: input.planName,
      page_type: 'checkout',
      conversion_source: 'payment_page',
    },
    {
      items: [
        {
          item_id: input.planCode,
          item_name: `NikNote ${input.planName}`,
          price: input.value,
          quantity: 1,
        },
      ],
    },
  );

  sendMetaEvent('InitiateCheckout', {
    currency,
    value: input.value,
    content_name: `NikNote ${input.planName}`,
    content_category: 'subscription',
    num_items: 1,
  });
}

function hasRecordedTransaction(txnId: string): boolean {
  if (recordedTransactions.has(txnId)) return true;
  if (typeof window === 'undefined') return false;
  try {
    const list = JSON.parse(localStorage.getItem(RECORDED_PURCHASES_KEY) || '[]') as string[];
    return Array.isArray(list) && list.includes(txnId);
  } catch {
    return false;
  }
}

function markTransactionRecorded(txnId: string): void {
  recordedTransactions.add(txnId);
  if (typeof window === 'undefined') return;
  try {
    const prev = JSON.parse(localStorage.getItem(RECORDED_PURCHASES_KEY) || '[]') as string[];
    const next = Array.from(new Set([...(Array.isArray(prev) ? prev : []), txnId])).slice(-100);
    localStorage.setItem(RECORDED_PURCHASES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

/**
 * 6. `purchase` (GA4) + `Purchase` (Meta Pixel)
 * Fired ONLY after server-side Razorpay signature verification succeeds.
 * Deduplicated by `transactionId` across reloads and includes `eventID` for CAPI dedup.
 */
export function trackVerifiedPurchase(input: {
  transactionId: string;
  orderId?: string;
  planCode: string;
  planName: string;
  value: number;
  currency?: string;
}): boolean {
  const txnId = (input.transactionId || '').trim();
  if (!txnId) return false;
  if (hasRecordedTransaction(txnId)) return false;

  markTransactionRecorded(txnId);
  const currency = input.currency || 'INR';

  sendGA4Event(
    'purchase',
    {
      transaction_id: txnId,
      currency,
      value: input.value,
      plan_name: input.planName,
      page_type: 'checkout',
    },
    {
      items: [
        {
          item_id: input.planCode,
          item_name: `NikNote ${input.planName}`,
          price: input.value,
          quantity: 1,
        },
      ],
    },
  );

  sendMetaEvent(
    'Purchase',
    {
      currency,
      value: input.value,
      content_name: `NikNote ${input.planName}`,
      content_type: 'product',
      num_items: 1,
    },
    { eventID: `purchase_${txnId}` },
  );

  return true;
}

/**
 * 7. `generate_lead` (GA4) + `Lead` (Meta Pixel)
 * Fired when a school/institution lead inquiry is submitted (zero PII sent).
 */
export function trackGenerateLead(input: {
  planName?: string;
  conversionSource: string;
  pageType?: string;
}): void {
  sendGA4Event('generate_lead', {
    currency: 'INR',
    plan_name: input.planName || 'school_pro',
    conversion_source: input.conversionSource,
    page_type: input.pageType || 'b2b',
  });

  sendMetaEvent('Lead', {
    content_name: input.planName || 'school_pro',
    content_category: 'b2b_inquiry',
  });
}

/**
 * 8. `click_cta` (GA4)
 */
export function trackClickCTA(input: {
  buttonLocation: string;
  conversionSource: string;
  pageType?: string;
  featureName?: string;
}): void {
  sendGA4Event('click_cta', {
    button_location: input.buttonLocation,
    conversion_source: input.conversionSource,
    page_type: input.pageType || 'landing',
    feature_name: input.featureName || 'handwriting_editor',
  });
}

/**
 * 9. `start_note_creation` (GA4) — never transmits note title or text.
 */
export function trackStartNoteCreation(input: {
  conversionSource: string;
  featureName?: string;
  pageType?: string;
}): void {
  sendGA4Event('start_note_creation', {
    conversion_source: input.conversionSource,
    feature_name: input.featureName || 'handwriting_editor',
    page_type: input.pageType || 'workspace',
  });
}

/**
 * 10. `save_note` (GA4) — never transmits note title or text.
 */
export function trackSaveNote(input: {
  featureName: string;
  conversionSource?: string;
  pageCount?: number;
}): void {
  sendGA4Event('save_note', {
    feature_name: input.featureName,
    conversion_source: input.conversionSource || 'editor',
    ...(typeof input.pageCount === 'number' ? { page_count: input.pageCount } : {}),
  });
}

/**
 * 11. `export_note` (GA4) — never transmits document filename or contents.
 */
export function trackExportNote(input: {
  exportFormat: 'pdf' | 'png' | 'jpeg';
  pageCount: number;
  featureName?: string;
}): void {
  sendGA4Event('export_note', {
    export_format: input.exportFormat,
    page_count: input.pageCount,
    feature_name: input.featureName || 'handwriting_editor',
  });
}

/**
 * 12. `premium_upgrade_click` (GA4)
 */
export function trackPremiumUpgradeClick(input: {
  planName: string;
  buttonLocation: string;
  conversionSource: string;
  pageType?: string;
}): void {
  sendGA4Event('premium_upgrade_click', {
    plan_name: input.planName,
    button_location: input.buttonLocation,
    conversion_source: input.conversionSource,
    page_type: input.pageType || 'pricing',
  });
}

/**
 * Test-only reset & config helper for deterministic Vitest validation.
 */
export function __resetTrackingForTests(overrideConfig?: Partial<TrackingConfig>): void {
  activeConfig = {
    ...readEnvConfig(),
    ...overrideConfig,
  };
  gaInitializedId = null;
  pixelInitializedId = null;
  lastTrackedRouteKey = null;
  lastKnownRoute = null;
  recordedTransactions.clear();
  if (typeof document !== 'undefined') {
    document.head.querySelectorAll('script[data-niknote-ga], script[data-niknote-fbq]').forEach((el) => el.remove());
  }
}
