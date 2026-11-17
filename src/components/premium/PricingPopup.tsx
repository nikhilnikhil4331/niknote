// ============================================================
// NikNote — first-visit pricing popup
//
// A single, well-made announcement for the paid plans. It has to earn its
// interruption, so it follows a few hard rules:
//
//  - It never shows on a page where it would be in the way (checkout, the
//    pricing page itself, auth, B2B, blog, legal).
//  - It shows to a given browser at most once a week, and at most once per
//    tab. Dismissing is a real "no", not a snooze.
//  - It never shows to someone who already has an active subscription.
//  - It waits a few seconds before appearing so it reads as an offer, not a
//    wall you hit before you saw anything.
//  - Every line in it is checkable. No countdown, no "2,500+ students", no
//    invented rating, no fake discount. The prices are the real prices in
//    Razorpay and the feature list matches what `premiumLocked` actually
//    gates in the editor.
//
// If you change what premium unlocks, change GATED_FEATURES below in the same
// commit, or this popup starts advertising things that do not exist.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, Crown, Mic, ScanLine, Sparkles, Star, Wand2, X, Zap,
} from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { CONSENT_UPDATED_EVENT, getSavedConsent } from '@/lib/consent';

/** Delay before the popup appears. Short enough to feel like "on open",
 *  long enough that the visitor has seen the product first. */
const OPEN_DELAY_MS = 5000;

/** Show at most once per browser per this many days. */
const REPEAT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const STORAGE_KEY = 'niknote:pricing-popup:last-shown';
const SESSION_KEY = 'niknote:pricing-popup:session';

/** Routes where an offer would be noise, a distraction, or actively harmful. */
const SUPPRESSED_PREFIXES = [
  '/payment',
  '/upgrade',
  '/login',
  '/signup',
  '/account',
  '/schools',
  '/institutions',
  '/blog',
  '/handbook',
  '/privacy',
  '/terms',
  '/refunds',
  '/welcome',
];

const isSuppressed = (pathname: string) =>
  SUPPRESSED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

/**
 * What premium actually unlocks today, verified against the editor:
 *   - PenPalette passes `premiumLocked={!premium.isPremium}` to the AI writing
 *     assistant and gates the dictation button on the same prop.
 *   - ControlPanel receives `premiumLocked` and overlays a lock on the AI Style
 *     Matcher and Handwriting Import panels.
 * Everything else in the editor (all handwriting styles, AI notes and solver,
 * flashcards, PDF tools, exports) is free for everyone and is deliberately not
 * listed here.
 */
const GATED_FEATURES = [
  { icon: Wand2, label: 'AI writing assistant', detail: 'Rewrite, summarise, expand', color: '#1F56B4', surface: '#EAF2FF' },
  { icon: Mic, label: 'Voice dictation', detail: 'Speak instead of typing', color: '#A92F47', surface: '#FFF0F1' },
  { icon: Sparkles, label: 'AI style matcher', detail: 'Match your real handwriting', color: '#1F56B4', surface: '#EAF2FF' },
  { icon: ScanLine, label: 'Handwriting import', detail: 'Photo of notes → editable text', color: '#8A6500', surface: '#FFF8D6' },
];

const PLANS = [
  {
    code: 'weekly',
    label: 'Student Pro',
    price: '₹49',
    period: '/week',
    note: 'Try it for a week',
    icon: Zap,
    featured: false,
  },
  {
    code: 'monthly',
    label: 'Premium',
    price: '₹99',
    period: '/month',
    note: 'About half the weekly rate',
    icon: Star,
    featured: true,
  },
];

const readLastShown = (): number => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Storage blocked (private mode, cookie banner rejected). Treat as "shown
    // recently" so we fail closed rather than popup on every single page view.
    return Date.now();
  }
};

const writeLastShown = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* nothing we can do; the session guard below still holds */
  }
};

const alreadyShownThisSession = (): boolean => {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return true;
  }
};

const markShownThisSession = () => {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
};

export const PricingPopup: React.FC = () => {
  const [open, setOpen] = useState(false);
  // The cookie banner sits above this popup and asks for consent. Two asks at
  // once is noise, and covering a consent prompt with a sales prompt is the
  // kind of thing that gets an app reported. Wait until that choice is made.
  const [consentDecided, setConsentDecided] = useState(() => getSavedConsent() !== null);
  const { isPremium, loading } = usePremium();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const rememberAndClose = useCallback(() => {
    writeLastShown();
    setOpen(false);
  }, []);

  const goToPlans = useCallback(() => {
    writeLastShown();
    setOpen(false);
    navigate('/upgrade');
  }, [navigate]);

  useEffect(() => {
    const onConsentUpdated = () => setConsentDecided(getSavedConsent() !== null);
    window.addEventListener(CONSENT_UPDATED_EVENT, onConsentUpdated);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, onConsentUpdated);
  }, []);

  // Decide once whether this visit is eligible.
  useEffect(() => {
    if (loading) return;
    if (!consentDecided) return;
    if (isPremium) return;
    if (isSuppressed(location.pathname)) return;
    if (alreadyShownThisSession()) return;
    if (Date.now() - readLastShown() < REPEAT_AFTER_MS) return;

    const timer = window.setTimeout(() => {
      markShownThisSession();
      setOpen(true);
    }, OPEN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loading, consentDecided, isPremium, location.pathname]);

  // Keep keyboard focus inside the modal, restore it on close and prevent the
  // page behind the mobile sheet from scrolling.
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        rememberAndClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primaryRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open, rememberAndClose]);

  // Never leave an offer hanging over a route it does not belong on.
  useEffect(() => {
    if (open && isSuppressed(location.pathname)) setOpen(false);
  }, [location.pathname, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[#101C34]/55 p-2 pb-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={rememberAndClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nn-pricing-popup-title"
            aria-describedby="nn-pricing-popup-desc"
            tabIndex={-1}
            className="relative flex max-h-[calc(100dvh-8px)] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[26px] border-2 border-[#171313] bg-[#FFFDF5] text-[#171313] shadow-[7px_8px_0_#171313,0_28px_70px_rgba(15,23,42,0.38)] outline-none sm:max-h-[min(820px,calc(100dvh-32px))] sm:rounded-[26px]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* ── Header: NikNote mark, coral paper and ink outline ── */}
            <div className="relative shrink-0 overflow-hidden border-b-2 border-[#171313] bg-[#FF858F] px-5 pb-5 pt-4 sm:px-7 sm:pb-6 sm:pt-5">
              <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#FFE45C]/55 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-28 h-2 w-14 rotate-[-12deg] rounded-full bg-[#2869D5]/85" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <img src="/images/brand/niknote-primary-mark.png" alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" />
                    <img src="/images/brand/niknote-primary-wordmark.png" alt="NikNote" className="h-[18px] w-auto max-w-[92px] object-contain sm:h-5" />
                    <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#171313] bg-[#FFE45C] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.11em]">
                      <Crown className="h-3 w-3" /> Premium
                    </span>
                  </div>
                  <h2
                    id="nn-pricing-popup-title"
                    className="mt-3 text-[24px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[31px]"
                  >
                    Four tools that
                    <br className="hidden sm:block" /> change how fast you write
                  </h2>
                  <p id="nn-pricing-popup-desc" className="mt-1.5 max-w-md text-[13px] font-medium leading-relaxed text-[#312124] sm:text-sm">
                    Everything you already use stays free. These are the extras.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={rememberAndClose}
                  aria-label="Close pricing popup"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#171313] bg-[#FFFDF5] text-[#171313] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2869D5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FF858F]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-5 sm:pt-5">
              <ul className="grid gap-2 sm:grid-cols-2">
                {GATED_FEATURES.map((feature) => (
                  <li key={feature.label} className="flex min-h-[62px] items-center gap-2.5 rounded-xl border border-[#E2E7F0] bg-white/85 p-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-black/5" style={{ backgroundColor: feature.surface, color: feature.color }}>
                      <feature.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold leading-tight text-[#171313]">
                        {feature.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-[#5E5961]">
                        {feature.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#8FC79C] bg-[#EAF7EC] px-3 py-2.5">
                <Check className="h-4 w-4 shrink-0 text-[#2E7D32]" />
                <p className="text-[11.5px] leading-snug text-[#38433A]">
                  <span className="font-bold text-[#171313]">
                    16+ handwriting styles, AI notes, PDF tools and exports stay free
                  </span>{' '}
                  — no card needed.
                </p>
              </div>

              {/* ── Plans ──────────────────────────────────────────── */}
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {PLANS.map((plan) => (
                  <div
                    key={plan.code}
                    className={
                      plan.featured
                        ? 'relative min-h-[112px] rounded-2xl border-2 border-[#2869D5] bg-[#EAF2FF] p-3.5 shadow-[3px_4px_0_#171313]'
                        : 'relative min-h-[112px] rounded-2xl border-2 border-[#171313] bg-white p-3.5 shadow-[3px_4px_0_#171313]'
                    }
                  >
                    {plan.featured && (
                      <span className="absolute -top-2 right-3 rounded-md border-2 border-[#171313] bg-[#FFE45C] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#171313]">
                        Best value
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <plan.icon className="h-3.5 w-3.5" style={{ color: plan.featured ? '#C83F58' : '#2869D5' }} />
                      <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-[#5E5961]">
                        {plan.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-0.5">
                      <span className="text-2xl font-extrabold tracking-tight text-[#171313]">
                        {plan.price}
                      </span>
                      <span className="text-xs font-semibold text-[#5E5961]">
                        {plan.period}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#5E5961]">{plan.note}</p>
                  </div>
                ))}
              </div>

              {/* ── CTA ────────────────────────────────────────────── */}
              <button
                ref={primaryRef}
                type="button"
                onClick={goToPlans}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#171313] bg-[#2869D5] px-4 py-3 text-sm font-extrabold text-white shadow-[3px_4px_0_#171313] transition hover:bg-[#1F56B4] active:translate-y-0.5 active:shadow-[1px_2px_0_#171313] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C83F58] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFDF5]"
              >
                See the plans
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={rememberAndClose}
                className="mt-2 min-h-10 w-full rounded-xl px-4 py-2 text-[12.5px] font-semibold text-[#5E5961] underline decoration-[#C83F58]/70 underline-offset-4 transition hover:text-[#171313] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2869D5]/50"
              >
                Not now
              </button>

              <p className="mt-1 pb-1 text-center text-[10.5px] leading-relaxed text-[#5E5961]">
                Razorpay checkout · No automatic renewal
                <br />
                No countdown, no fake discount.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PricingPopup;
