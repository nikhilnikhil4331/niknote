import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AUTO_GUEST } from '@/config/features';
import { RoutineApp } from '@/components/habits/RoutineApp';

/** Niknote Habit — animated routine tracker app experience. */
export default function RoutineAppPage() {
  const { user, loading, signInAsGuest } = useAuth() as any;
  const { pathname } = useLocation();
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!loading && !user && AUTO_GUEST) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div role="alert" className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Couldn't open your habits</h1>
          <p className="text-sm text-muted-foreground">
            {failed
              ? 'Still not connecting. Check your internet, or open this link in Chrome or Safari instead of an in-app browser (WhatsApp/Instagram), and turn off private mode.'
              : 'Your internet seems slow or blocked. Tap to try again.'}
          </p>
          <button
            type="button"
            disabled={retrying}
            className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-60"
            onClick={async () => {
              setRetrying(true);
              const r = await signInAsGuest();
              setRetrying(false);
              if (r?.error) setFailed(true);
            }}
          >
            {retrying ? 'Opening…' : 'Try again'}
          </button>
        </div>
      </main>
    );
  }

  if (!loading && !user) {
    try { sessionStorage.setItem('niknote_post_auth_redirect', pathname); } catch { /* noop */ }
    return <Navigate to="/auth" replace />;
  }

  return <RoutineApp />;
}
