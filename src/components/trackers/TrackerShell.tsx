import { ReactNode } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppDock } from '@/components/AppDock';

export function TrackerShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { user, loading } = useAuth() as any;
  const { pathname } = useLocation();
  if (!loading && !user) {
    try { sessionStorage.setItem('niknote_post_auth_redirect', pathname); } catch { /* noop */ }
    return <Navigate to="/auth" replace />;
  }
  const tabs = [
    { to: '/money', label: 'Money', icon: Wallet },
    { to: '/routine', label: 'Routine', icon: CalendarCheck },
  ];
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5 pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-xl hover:bg-muted" aria-label="Back to notes"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-foreground leading-tight truncate">{title}</h1>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
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
      <motion.main initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
        className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {children}
      </motion.main>
      <AppDock />
    </div>
  );
}

export function Panel({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-border bg-card/80 backdrop-blur p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
