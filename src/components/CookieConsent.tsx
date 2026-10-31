// ============================================================
// NikNote — Cookie & Tracking Consent Banner (Mobile-Nav Safe)
// Governs Essential storage, GA4 Analytics, and Meta Pixel.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cookie, X, Check, Shield } from 'lucide-react';
import {
  getSavedConsent,
  saveConsentPreferences,
  OPEN_COOKIE_SETTINGS_EVENT,
} from '@/lib/consent';

export const CookieConsent: React.FC = () => {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = getSavedConsent();
    if (saved) {
      setAnalytics(saved.analytics);
      setMarketing(saved.marketing);
    } else {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleOpenSettings = () => {
      const saved = getSavedConsent();
      setAnalytics(saved?.analytics ?? false);
      setMarketing(saved?.marketing ?? false);
      setShowDetails(true);
      setForcedOpen(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);
  }, []);

  const persistChoice = (nextAnalytics: boolean, nextMarketing: boolean) => {
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    saveConsentPreferences({ analytics: nextAnalytics, marketing: nextMarketing });
    setForcedOpen(false);
    setVisible(false);
  };

  const handleAcceptAll = () => persistChoice(true, true);
  const handleRejectNonEssential = () => persistChoice(false, false);
  const handleSavePreferences = () => persistChoice(analytics, marketing);

  // Never cover full-screen immersive workspaces unless explicitly opened via Cookie settings
  if (!visible || (!forcedOpen && (pathname === '/habit' || pathname === '/board' || pathname === '/ai'))) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-4 z-[95] px-3 sm:px-4"
      role="region"
      aria-label="Cookie preferences"
    >
      <div className="pointer-events-auto max-w-xl mx-auto rounded-2xl border border-border/80 bg-background/95 shadow-xl p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Cookie className="w-4 h-4 text-accent-rose flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-snug">
              We use essential storage to keep your notes &amp; sign-in working, and optional analytics &amp; conversion cookies only with your permission.{' '}
              <Link to="/privacy" className="text-accent-rose underline font-medium">
                Privacy Policy
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={handleRejectNonEssential}
            className="min-w-[36px] min-h-[36px] -mr-1 -mt-1 grid place-items-center text-muted-foreground hover:text-foreground rounded-lg"
            aria-label="Close cookie banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showDetails && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-muted/50 space-y-2 text-xs">
            <label className="flex items-center justify-between py-0.5">
              <span>
                <strong className="text-foreground">Essential</strong> · Sign-in &amp; note storage (always active)
              </span>
              <input type="checkbox" checked disabled className="rounded accent-primary w-4 h-4" />
            </label>
            <label className="flex items-center justify-between py-0.5 cursor-pointer">
              <span>
                <strong className="text-foreground">Analytics</strong> · Google Analytics 4 &amp; usage insights
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="rounded accent-primary w-4 h-4 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between py-0.5 cursor-pointer">
              <span>
                <strong className="text-foreground">Marketing</strong> · Meta Pixel conversion measurement
              </span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="rounded accent-primary w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-[0.98]"
          >
            <Check className="w-3.5 h-3.5" />
            Accept all
          </button>
          {showDetails ? (
            <button
              type="button"
              onClick={handleSavePreferences}
              className="inline-flex items-center justify-center min-h-[40px] px-3.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium"
            >
              Save
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="inline-flex items-center justify-center gap-1 min-h-[40px] px-3 rounded-xl text-muted-foreground hover:text-foreground text-xs"
            >
              <Shield className="w-3.5 h-3.5" />
              Options
            </button>
          )}
          <button
            type="button"
            onClick={handleRejectNonEssential}
            className="inline-flex items-center justify-center min-h-[40px] px-3 rounded-xl border border-border text-foreground text-xs font-medium ml-auto sm:ml-0"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
};
