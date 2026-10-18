import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { haptic } from '@/hooks/useHaptics';
import { RoutineProvider, useRoutine } from '@/components/habits/RoutineProvider';
import { BottomNav, type TabId } from '@/components/habits/ui';
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

const TAB_VIEWS: TabId[] = ['home', 'habits', 'insights', 'profile'];

function Shell() {
  const { state, setOnboarded } = useRoutine();
  const reduced = useReducedMotion();
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<TabId>('home');
  const [pushed, setPushed] = useState<View | null>(null);
  const [dir, setDir] = useState(1);

  const view: View = pushed ?? { name: 'tab', id: tab };
  const viewKey = pushed ? pushed.name + (pushed.name === 'detail' ? pushed.id : '') : 'tab:' + tab;

  const go = useCallback((s: { name: string; id?: string }) => {
    haptic('selection');
    if (s.name === 'tab' && s.id) {
      setPushed(null);
      setTab(s.id as TabId);
      return;
    }
    if (s.name === 'tab') return;
    setDir(1);
    if (s.name === 'detail' && pushed?.name === 'detail' && pushed.id === s.id) return;
    setPushed({ name: s.name, ...(s.id ? { id: s.id } : {}) } as View);
  }, [pushed]);

  const back = useCallback(() => {
    setDir(-1);
    setPushed(null);
  }, []);

  // Hardware back / Escape should pop pushed views
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && pushed) { e.preventDefault(); back(); } };
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
    initial: reduced ? { opacity: 0 } : { opacity: 0, x: dir * 44 },
    animate: { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: dir * -44 },
    transition: { duration: reduced ? 0.15 : 0.26, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className={`nn-habits relative w-full h-full flex flex-col ${state.theme === 'dark' ? 'nnh-dark' : ''}`}>
      {/* ambient blobs */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full nnh-anim-float-slow pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16), transparent 70%)' }} aria-hidden="true" />
      <div className="absolute top-1/3 -left-20 w-56 h-56 rounded-full nnh-anim-float-slow pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%)', animationDelay: '-3s' }} aria-hidden="true" />

      {/* screen stack */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="sync" custom={dir} initial={false}>
          <motion.div key={viewKey} {...anim} className="absolute inset-0 overflow-y-auto nnh-scroll">
            {screen}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* bottom nav */}
      <AnimatePresence>
        {!splash && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <BottomNav
              active={pushed ? '' : tab}
              onTab={t => go({ name: 'tab', id: t })}
              onAdd={() => go({ name: 'add' })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* splash */}
      <AnimatePresence>
        {splash && (
          <motion.div key="splash" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.06 }} transition={{ duration: 0.45 }}>
            <Splash isBack={state.onboarded} onEnter={() => { setOnboarded(true); setSplash(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoutineApp() {
  return (
    <RoutineProvider>
      <Frame>
        <Shell />
      </Frame>
    </RoutineProvider>
  );
}

/** Phone-style frame on desktop, full-bleed on mobile. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex justify-center md:py-5" style={{ background: 'linear-gradient(135deg, #f9d9ec 0%, #e7dbfc 50%, #d7e5ff 100%)' }}>
      <div className="relative w-full max-w-[420px] h-[100dvh] md:h-[820px] md:max-h-[92vh] md:rounded-[2.4rem] overflow-hidden md:border-[10px] md:border-[#241d3a] md:shadow-[0_40px_80px_-30px_rgba(76,49,133,0.5)]">
        {children}
      </div>
    </div>
  );
}
