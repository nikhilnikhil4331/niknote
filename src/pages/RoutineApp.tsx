import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AUTO_GUEST } from '@/config/features';
import { RoutineApp } from '@/components/habits/RoutineApp';

/** Niknote Habit — animated routine tracker app experience. */
export default function RoutineAppPage() {
  const { user, loading, signInAsGuest, signInWithGoogle } = useAuth();
  const { pathname } = useLocation();
  const [retrying, setRetrying] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  if (!loading && !user && !AUTO_GUEST) {
    try { sessionStorage.setItem('niknote_post_auth_redirect', pathname); } catch { /* noop */ }
    return <Navigate to="/auth" replace />;
  }

  const showBanner = !loading && !user && AUTO_GUEST;
  return (
    <div className="relative">
      {showBanner && (
        <div role="status" className="sticky top-0 z-50 px-4 py-2 bg-amber-50 text-amber-950 text-xs border-b border-amber-200">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0">Niknote account connected nahi hai. Habits abhi is device par save hain.</span>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" disabled={retrying} className="min-h-[40px] px-2 font-semibold underline disabled:opacity-60" onClick={async () => {
                setRetrying(true);
                try { const result = await signInAsGuest(); setConnectionError(result.error?.message ?? ''); }
                catch (err) { setConnectionError(err instanceof Error ? err.message : 'Connection failed'); }
                finally { setRetrying(false); }
              }}>{retrying ? 'Connecting…' : 'Retry'}</button>
              <button type="button" className="min-h-[40px] rounded-full bg-violet-700 px-3 font-semibold text-white" onClick={() => {
                try { sessionStorage.setItem('niknote_post_auth_redirect', pathname); } catch { /* noop */ }
                void signInWithGoogle().then(result => setConnectionError(result.error?.message ?? ''));
              }}>Connect</button>
            </div>
          </div>
          {connectionError && <p className="pt-1 text-[11px]" role="alert">Connection issue: {connectionError}</p>}
        </div>
      )}
      <div className={showBanner ? 'pt-1' : ''}>
        <RoutineApp />
      </div>
    </div>
  );
}
