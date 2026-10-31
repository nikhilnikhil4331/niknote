import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { haptic } from '@/hooks/useHaptics';
import { RoutineProvider, useRoutine } from '@/components/habits/RoutineProvider';
import type { TabId } from '@/components/habits/ui';
import { FloatingNav } from '@/components/habits/FloatingNav';
import { Splash } from '@/components/habits/screens/Splash';
import { HomeScreen } from '@/components/habits/screens/Home';
import { HabitsScreen } from '@/components/habits/screens/Habits';
import { AddHabitScreen } from '@/components/habits/screens/AddHabit';
import { HabitDetailScreen } from '@/components/habits/screens/HabitDetail';
import { FocusTimerScreen } from '@/components/habits/screens/FocusTimer';
import { InsightsScreen } from '@/components/habits/screens/Insights';
import { SleepScreen } from '@/components/habits/screens/Sleep';
import { ExerciseScreen } from '@/components/habits/screens/Exercise';
import { CalendarScreen } from '@/components/habits/screens/CalendarView';
import { StreaksScreen } from '@/components/habits/screens/Streaks';
import { ProfileScreen } from '@/components/habits/screens/Profile';
import './habits.css';

type View =
  | { name: 'tab'; id: TabId }
  | { name: 'add' }
  | { name: 'detail'; id: string }
  | { name: 'focus' }
  | { name: 'sleep' }
  | { name: 'exercise' }
  | { name: 'calendar' }
  | { name: 'streaks' };

/** Pushed screens keep the nav context of the tab they belong to. */
const PARENT_TAB: Record<Exclude<View['name'], 'tab'>, TabId> = {
  add: 'habits',
  detail: 'habits',
  focus: 'home',
  sleep: 'home',
  exercise: 'home',
  calendar: 'home',
  streaks: 'insights',
};

export function Shell() {
  const { state, setOnboarded } = useRoutine();
  const reduced = useReducedMotion();
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<TabId>('home');

  // The habit screen owns the viewport: no page-level scrolling behind the app,
  // so the floating nav always sits exactly where it is drawn.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { htmlOverflow: html.style.overflow, bodyOverflow: body.style.overflow, bodyTouch: body.style.touchAction };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'pan-x pan-y';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.touchAction = prev.bodyTouch;
    };
  }, []);
  // Navigation history: tabs are roots, pushed screens form a real stack so
  // Back (and the hardware/browser back key) returns to the previous screen.
  const [stack, setStack] = useState<View[]>([]);
  const [dir, setDir] = useState(1);
  const pushed = stack.length ? stack[stack.length - 1] : null;

  const view: View = pushed ?? { name: 'tab', id: tab };
  const viewKey = pushed ? pushed.name + (pushed.name === 'detail' ? pushed.id : '') : 'tab:' + tab;
  const activeTab: TabId = pushed ? PARENT_TAB[pushed.name] : tab;

  const go = useCallback((s: { name: string; id?: string }) => {
    haptic('selection');
    if (s.name === 'tab') {
      if (!s.id) return;
      setDir(stack.length ? -1 : 1);
      setStack([]);
      setTab(s.id as TabId);
      return;
    }
    const next = { name: s.name, ...(s.id ? { id: s.id } : {}) } as View;
    const top = stack[stack.length - 1];
    if (top && top.name === next.name &&
      (next.name !== 'detail' || (top as { id?: string }).id === (next as { id?: string }).id)) return;
    setDir(1);
    // one reversible browser entry per pushed screen
    if (typeof window !== 'undefined' && window.history?.pushState) window.history.pushState({ nnh: 'nav' }, '');
    setStack(prev => [...prev, next]);
  }, [stack]);

  const back = useCallback(() => {
    setDir(-1);
    setStack(prev => prev.slice(0, -1));
  }, []);

  // Browser / Android hardware back walks the same stack the UI uses.
  const stackRef = useRef<View[]>([]);
  stackRef.current = stack;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      // an open overlay owns the back gesture: close it, keep the screen
      if (document.querySelector('#nnh-quick-actions, [role="dialog"]')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        window.history.pushState({ nnh: 'nav' }, '');
        return;
      }
      if (stackRef.current.length) {
        setDir(-1);
        setStack(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Hardware back / Escape pops pushed views — but never while an overlay menu owns Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !pushed) return;
      if (document.querySelector('#nnh-quick-actions, [role="menu"], [role="dialog"]')) return;
      e.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushed, back]);

  const screen = useMemo(() => {
    switch (view.name) {
      case 'tab':
        if (view.id === 'habits') return <HabitsScreen go={go} />;
        if (view.id === 'insights') return <InsightsScreen go={go} />;
        if (view.id === 'profile') return <ProfileScreen go={go} />;
        return <HomeScreen go={go} />;
      case 'add': return <AddHabitScreen go={go} />;
      case 'detail': return <HabitDetailScreen id={view.id} go={go} />;
      case 'focus': return <FocusTimerScreen go={go} />;
      case 'sleep': return <SleepScreen go={go} />;
      case 'exercise': return <ExerciseScreen go={go} />;
      case 'calendar': return <CalendarScreen go={go} />;
      case 'streaks': return <StreaksScreen go={go} />;
    }
  }, [view, go]);

  const anim = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, x: dir * 36, scale: 0.99 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: dir * -28, scale: 0.995 },
    transition: { duration: reduced ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <Frame dark={state.theme === 'dark'}>
    <div className={`nn-habits relative flex h-full w-full flex-col overflow-hidden ${state.theme === 'dark' ? 'nnh-dark' : ''}`}>
      {/* ambient light — static-ish, slow, and paused for reduced motion */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden="true">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full nnh-anim-aurora"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.20), transparent 68%)' }} />
        <div className="absolute -left-24 top-8 h-64 w-64 rounded-full nnh-anim-aurora"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18), transparent 68%)', animationDelay: '-9s' }} />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="sync" custom={dir} initial={false}>
          <motion.div key={viewKey} {...anim} className="absolute inset-0 overflow-y-auto overscroll-contain nnh-scroll"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            {screen}
            <div aria-hidden="true" style={{ height: 'var(--nnh-nav-space)' }} />
          </motion.div>
        </AnimatePresence>
      </div>

      {!splash && (
        <FloatingNav
          active={activeTab}
          onTab={t => go({ name: 'tab', id: t })}
          onNavigate={name => go({ name })}
        />
      )}

      <AnimatePresence>
        {splash && (
          <motion.div key="splash" className="absolute inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.4 }}>
            <Splash isBack={state.onboarded} onEnter={() => { setOnboarded(true); setSplash(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </Frame>
  );
}

/** Phone-style frame on desktop, full-bleed on mobile, with desktop-only chrome outside it. */
function Frame({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  const brandInk = dark ? '#f7eeec' : '#241b2e';
  const brandSub = dark ? '#a79bae' : '#6b5a73';
  const brandAccent = dark ? '#e9bcb9' : '#8c3149';
  return (
    <div
      /* Mobile: pin to the visual viewport so the floating nav can never end up
         below the browser's URL bar / whatever made the page taller than the screen. */
      className="fixed inset-0 flex h-[100dvh] w-full items-center justify-center gap-8 overflow-hidden px-0 py-0 md:static md:h-auto md:min-h-screen md:overflow-visible md:px-6 md:py-5"
      style={{
        background: dark
          ? 'linear-gradient(135deg, #121020 0%, #1b1931 48%, #2a1235 100%)'
          : 'linear-gradient(135deg, #fdf4f1 0%, #f7e6e2 48%, #f6d9cb 100%)',
      }}
    >
      <div className="hidden max-w-[300px] flex-col gap-5 xl:flex">
        <img src="/niknote-logo.png" alt="Niknote" className="w-[210px] select-none" draggable={false} />
        <p className="text-[27px] font-semibold leading-tight" style={{ color: brandInk, fontFamily: "'Space Grotesk', sans-serif" }}>
          Better Habits,<br />A Brighter You.
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: brandSub }}>
          Track hydration, sleep, movement and focus in one calm daily ritual. Your data stays on this device and syncs only when you ask.
        </p>
        <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: brandAccent }}>
          <ArrowRight size={14} /> Small habits. Big changes.
        </div>
      </div>

      <div className="relative h-full w-full max-w-[430px] overflow-hidden md:h-[844px] md:max-h-[92vh] md:rounded-[2.6rem] md:border-[10px] md:border-active md:shadow-[0_50px_100px_-40px_rgba(27,25,49,0.6)]">
        {children}
      </div>
    </div>
  );
}

/** Habit experience entry point — one provider, one navigation system, one frame. */
export function RoutineApp() {
  return (
    <RoutineProvider>
      <Shell />
    </RoutineProvider>
  );
}
