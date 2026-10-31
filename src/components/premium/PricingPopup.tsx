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
  { icon: Wand2, label: 'AI writing assistant', detail: 'Rewrite, summarise, expand' },
  { icon: Mic, label: 'Voice dictation', detail: 'Speak instead of typing' },
  { icon: Sparkles, label: 'AI style matcher', detail: 'Match your real handwriting' },
  { icon: ScanLine, label: 'Handwriting import', detail: 'Photo of notes → editable text' },
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

  // Escape closes, body does not scroll behind the sheet.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') rememberAndClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primaryRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
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
          className="fixed inset-0 z-[90] flex items-end justify-center bg-nk-midnight/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={rememberAndClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nn-pricing-popup-title"
            aria-describedby="nn-pricing-popup-desc"
            className="relative w-full max-w-lg overflow-hidden rounded-t-[26px] border border-[color:var(--nk-glass-border)] bg-card shadow-[0_30px_90px_-20px_rgba(15,23,42,0.65)] sm:max-w-2xl sm:rounded-[26px]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary via-nk-rose to-[hsl(var(--ink-pink))] px-5 pb-6 pt-5 text-white sm:px-7 sm:pb-7 sm:pt-6">
              {/* Dark scrim: in dark mode --primary and --accent are bright, and
                  the theme's own --primary-foreground flips to near-black, which
                  would leave this header mixing dark text with the white/20
                  chips below. A fixed scrim plus fixed white text is legible in
                  both themes. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-nk-midnight/25"
              />
              {/* ruled-paper texture, the app's own visual language */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.13]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(180deg, transparent 0 21px, #E9BCB9 21px 22px)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-surface/20 blur-2xl"
              />

              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
                    <Crown className="h-3 w-3" />
                    NikNote Premium
                  </span>
                  <h2
                    id="nn-pricing-popup-title"
                    className="mt-2.5 text-[22px] font-bold leading-[1.15] tracking-tight sm:text-[26px]"
                  >
                    Four tools that
                    <br className="hidden sm:block" /> change how fast you write
                  </h2>
                  <p
                    id="nn-pricing-popup-desc"
                    className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/85"
                  >
                    Everything you already use stays free. These are the extras.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={rememberAndClose}
                  aria-label="Close pricing popup"
                  className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-white/80 transition hover:bg-surface/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            <div className="px-5 pb-4 pt-5 sm:px-7">
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {GATED_FEATURES.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-accent-rose">
                      <feature.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight text-foreground">
                        {feature.label}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-muted-foreground">
                        {feature.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[color:hsl(var(--success)/0.25)] bg-success/[0.07] px-3 py-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">
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
                        ? 'relative rounded-2xl border-2 border-primary bg-primary/[0.06] p-3.5'
                        : 'relative rounded-2xl border border-border/70 p-3.5'
                    }
                  >
                    {plan.featured && (
                      <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                        Best value
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <plan.icon className="h-3.5 w-3.5 text-accent-rose" />
                      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {plan.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-0.5">
                      <span className="text-2xl font-bold tracking-tight text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{plan.note}</p>
                  </div>
                ))}
              </div>

              {/* ── CTA ────────────────────────────────────────────── */}
              <button
                ref={primaryRef}
                type="button"
                onClick={goToPlans}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-nk-rose px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                See the plans
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={rememberAndClose}
                className="mt-2 w-full rounded-xl px-4 py-2 text-[12.5px] font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Not now
              </button>

              <p className="mt-1 pb-1 text-center text-[10.5px] leading-relaxed text-muted-foreground">
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
