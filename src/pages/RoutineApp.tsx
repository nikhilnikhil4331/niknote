import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AUTO_GUEST } from '@/config/features';
import { RoutineApp } from '@/components/habits/RoutineApp';

/** Niknote Habit — animated routine tracker app experience. */
export default function RoutineAppPage() {
  const { user, loading, signInAsGuest } = useAuth();
  const { pathname } = useLocation();
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!loading && !user && !AUTO_GUEST) {
    try { sessionStorage.setItem('niknote_post_auth_redirect', pathname); } catch { /* noop */ }
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="relative">
      {!loading && !user && AUTO_GUEST && (
        <div role="status" className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 text-amber-950 text-xs">
          <span>{failed ? 'Still offline. Your habits stay saved on this device.' : 'Cloud connection unavailable. Habits work on this device.'}</span>
          <button
            type="button"
            disabled={retrying}
            className="shrink-0 min-h-[44px] px-3 font-semibold underline disabled:opacity-60"
            onClick={async () => {
              setRetrying(true);
              try {
                const result = await signInAsGuest();
                setFailed(Boolean(result.error));
              } catch {
                setFailed(true);
              } finally {
                setRetrying(false);
              }
            }}
          >
            {retrying ? 'Connecting…' : 'Retry sync'}
          </button>
        </div>
      )}
      <RoutineApp />
    </div>
  );
}
