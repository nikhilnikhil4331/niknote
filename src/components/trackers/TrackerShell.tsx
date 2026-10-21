import { ReactNode } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, CalendarCheck, CloudOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppDock } from '@/components/AppDock';
import { AUTO_GUEST } from '@/config/features';

export function TrackerShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (!loading && !user && !AUTO_GUEST) {
    try { sessionStorage.setItem('niknote_post_auth_redirect', pathname); } catch { /* noop */ }
    return <Navigate to="/auth" replace />;
  }

  const tabs = [
    { to: '/money', label: 'Money', icon: Wallet },
    { to: '/routine', label: 'Routine', icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5 pb-28">
      <header className="sticky top-0 z-30 bg-background/95 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="min-w-[40px] min-h-[40px] grid place-items-center rounded-xl hover:bg-muted active:scale-95 transition" aria-label="Back to notes">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-foreground leading-tight truncate">{title}</h1>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
          {!user && !loading && (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0"
              title="Saved locally on this device — tap to sign in for cloud sync"
            >
              <CloudOff className="w-3 h-3" />
              <span className="hidden sm:inline">Device mode · Sign in</span>
              <span className="sm:hidden">Sync</span>
            </Link>
          )}
          <nav className="hidden md:flex gap-1 bg-muted/60 rounded-xl p-1">
            {tabs.map(t => (
              <Link key={t.to} to={t.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${pathname === t.to ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {/* Settle in place: a tiny fade + lift, never a horizontal shove that
          makes the whole tracker feel like it jumps between sections. */}
      <motion.main initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {children}
      </motion.main>
      <AppDock />
    </div>
  );
}

export function Panel({ title, action, children, className = '', id }: { title: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-3xl border border-border bg-card/90 p-5 shadow-sm scroll-mt-20 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
