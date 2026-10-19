import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'niknote_optional_analytics';

export function CookieConsent() {
  const { pathname } = useLocation();
  // On the habit app the floating nav owns the bottom edge — keep the sheet above it.
  const habitRoute = pathname.startsWith('/habit');
  const [choice, setChoice] = useState<string | null>(() => localStorage.getItem(CONSENT_KEY));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showSettings = () => setOpen(true);
    window.addEventListener('niknote:cookie-settings', showSettings);
    return () => window.removeEventListener('niknote:cookie-settings', showSettings);
  }, []);

  const choose = (value: 'accepted' | 'declined') => {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === 'declined') {
      localStorage.removeItem('niknote_analytics');
      localStorage.removeItem('niknote_last_session');
      localStorage.removeItem('niknote_sessions');
    }
    window.dispatchEvent(new Event('niknote:consent-changed'));
    setChoice(value);
    setOpen(false);
  };

  if (choice && !open) return null;

  return <aside aria-label="Privacy choices" data-habit={habitRoute || undefined}
    className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl border border-border bg-background p-5 shadow-xl sm:bottom-6 sm:p-6"
    style={habitRoute ? { bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' } : undefined}>
    <h2 className="text-lg font-semibold text-foreground">Your privacy choices</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Essential sign-in storage keeps NikNote working. Optional usage analytics help us improve the app and stay off unless you allow them. Read our <Link to="/privacy" className="underline text-primary">Privacy Policy</Link>.</p>
    <div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => choose('accepted')}>Allow analytics</Button><Button variant="outline" onClick={() => choose('declined')}>Essential only</Button></div>
  </aside>;
}