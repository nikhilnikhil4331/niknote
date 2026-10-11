// Niknote — app-wide mobile dock for non-editor screens
import { Link, useLocation } from 'react-router-dom';
import { PenLine, Wallet, CalendarCheck, Layers, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/hooks/useHaptics';

const ITEMS = [
  { to: '/', label: 'Notes', icon: PenLine },
  { to: '/money', label: 'Money', icon: Wallet },
  { to: '/routine', label: 'Routine', icon: CalendarCheck },
  { to: '/flashcards', label: 'Cards', icon: Layers },
  { to: '/hub', label: 'Apps', icon: LayoutGrid },
];

export function AppDock() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden px-3 pb-[max(env(safe-area-inset-bottom),8px)]">
      <div className="mx-auto max-w-md flex h-16 items-center rounded-[1.75rem] border border-border/70 bg-background/80 backdrop-blur-2xl shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.35)] px-1.5">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} onClick={() => haptic('selection')}
              className={cn('flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all active:scale-90',
                active ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md' : 'text-muted-foreground')}>
              <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
