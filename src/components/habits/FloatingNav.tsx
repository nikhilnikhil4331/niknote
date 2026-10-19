import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Check, Droplet, Dumbbell, Home, LayoutGrid, ListPlus, Plus, Sparkles, Target, Timer, User, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { habitSpring } from '@/lib/motion';
import { createActionGate, radialLayout } from '@/lib/navLayout';
import { haptic } from '@/hooks/useHaptics';
import { useRoutine } from '@/components/habits/RoutineProvider';
import type { TabId } from '@/components/habits/ui';

type QuickId = 'habit' | 'task' | 'activity' | 'focus' | 'water';
export type QuickDestination = 'add' | 'focus' | 'exercise' | 'habits' | 'calendar';

const NAV_ITEMS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'habits', label: 'Habits', icon: Sparkles },
  { id: 'insights', label: 'Insights', icon: LayoutGrid },
  { id: 'profile', label: 'Profile', icon: User },
];

const QUICK_ACTIONS: { id: QuickId; label: string; icon: typeof Home; tint: string }[] = [
  { id: 'habit', label: 'Add Habit', icon: ListPlus, tint: '#7c3aed' },
  { id: 'task', label: 'Add Task', icon: Target, tint: '#ec4899' },
  { id: 'activity', label: 'Log Activity', icon: Dumbbell, tint: '#34d399' },
  { id: 'focus', label: 'Focus Timer', icon: Timer, tint: '#f59e0b' },
  { id: 'water', label: 'Log Water', icon: Droplet, tint: '#0ea5e9' },
];

/** Keeps the floating nav from covering inputs when a soft keyboard is open. */
function useKeyboardVisible() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const measure = () => setOpen(window.innerHeight - vv.height > 140);
    measure();
    vv.addEventListener('resize', measure);
    return () => vv.removeEventListener('resize', measure);
  }, []);
  return open;
}

/** Small screens get a tighter fan so bubbles never leave the frame. */
function useQuickRadius() {
  const measure = () => {
    const w = typeof window === 'undefined' ? 390 : window.innerWidth;
    return w < 360 ? 96 : w < 400 ? 106 : 116;
  };
  const [radius, setRadius] = useState(measure);
  useEffect(() => {
    const onResize = () => setRadius(measure());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return radius;
}

export function FloatingNav({ active, onTab, onNavigate }: {
  /** Active tab; pushed screens pass their parent tab so the nav keeps its context. */
  active: TabId;
  onTab: (t: TabId) => void;
  /** Navigate to a pushed screen (`add`, `focus`, `exercise`, ...). */
  onNavigate: (name: QuickDestination) => void;
}) {
  const reduced = !!useReducedMotion();
  const keyboardOpen = useKeyboardVisible();
  const radius = useQuickRadius();
  const { state, activeHabits, bump, addTodo, today } = useRoutine();
  const stateRef = useRef(state);
  stateRef.current = state;

  const [menuOpen, setMenuOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [task, setTask] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [waterLogged, setWaterLogged] = useState(false);

  const fabRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const savingRef = useRef(false);

  const water = activeHabits.find(h => h.type === 'water');
  const actions = useMemo(
    () => QUICK_ACTIONS.filter(a => a.id !== 'water' || !!water),
    [water],
  );
  const points = useMemo(() => radialLayout(actions.length, radius), [actions.length, radius]);

  /** Same action twice in quick succession = one action. */
  const gate = useRef(createActionGate(320)).current;

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) window.setTimeout(() => fabRef.current?.focus(), 0);
  }, []);

  // Leaving the current destination always dismisses the quick actions.
  useEffect(() => { setMenuOpen(false); }, [active]);

  // A resize/orientation change invalidates the fan geometry — close it.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('orientationchange', close);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('orientationchange', close);
    };
  }, [menuOpen]);

  // Focus the first action as soon as the menu mounts so keyboard users can act.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const first = actions[0];
    if (first) itemRefs.current[first.id]?.focus({ preventScroll: true });
  }, [menuOpen, actions]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, closeMenu]);

  const runAction = (id: QuickId) => {
    if (!gate(id)) return;
    haptic('light');

    if (id === 'water') {
      if (!water) return;
      const next = (stateRef.current.entries[`${water.id}|${today}`]?.v ?? 0) + 1;
      bump(water, 1);
      setWaterLogged(true);
      window.setTimeout(() => setWaterLogged(false), 1400);
      toast.success(`💧 ${Math.min(next, water.target)} / ${water.target} glasses today`);
      closeMenu();
      return;
    }
    closeMenu();
    if (id === 'habit') { onNavigate('add'); return; }
    if (id === 'focus') { onNavigate('focus'); return; }
    if (id === 'activity') { onNavigate('exercise'); return; }
    setTaskOpen(true);
  };

  const saveTask = () => {
    if (savingRef.current || !task.trim()) return;
    savingRef.current = true;
    addTodo(task, priority);
    setTask('');
    setTaskOpen(false);
    haptic('success');
    toast.success('Task added to today');
    // release after the sheet has unmounted so a double click can never add twice
    window.setTimeout(() => { savingRef.current = false; }, 350);
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ids = actions.map(a => a.id);
    if (!ids.length) return;
    const current = ids.findIndex(id => itemRefs.current[id] === document.activeElement);
    const move = (next: number) => {
      e.preventDefault();
      itemRefs.current[ids[(next + ids.length) % ids.length]]?.focus({ preventScroll: true });
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(current + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(current - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(ids.length - 1);
    else if (e.key === 'Tab') closeMenu(false); // let focus continue naturally
  };

  /** Left/right arrows move between destinations without changing the tab. */
  const onNavKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const buttons = Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>('.nnh-nav-item') ?? []);
    if (!buttons.length) return;
    e.preventDefault();
    const current = buttons.findIndex(b => b === document.activeElement);
    let next = current;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1 + buttons.length) % buttons.length;
    else next = (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
  };

  return (
    <>
      {/* dismiss layer — deliberately out of the tab order, the menu owns focus */}
      {menuOpen && (
        <motion.button
          type="button"
          tabIndex={-1}
          aria-label="Close quick actions"
          className="absolute inset-0 z-20 cursor-default"
          style={{ background: 'var(--nnh-scrim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.16 }}
          onClick={() => closeMenu(true)}
        />
      )}

      <motion.div
        className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3"
        style={{ paddingBottom: 'calc(10px + var(--nnh-safe-bottom))' }}
        initial={reduced ? false : { y: 80, opacity: 0 }}
        animate={keyboardOpen ? { y: 140, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={reduced ? { duration: 0 } : habitSpring.soft}
        aria-hidden={keyboardOpen || undefined}
      >
        <div className="relative w-full max-w-[352px]">
          {/* soft emphasis behind the FAB while the fan is open */}
          {menuOpen && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[58px] left-1/2 h-[230px] w-[230px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(147,51,234,0.20), rgba(236,72,153,0.10) 45%, transparent 72%)',
                x: '-50%',
                y: '50%',
              }}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduced ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            />
          )}

          {/* radial quick actions — anchored to the FAB centre, unmounted on close */}
          {menuOpen && (
            <div
              id="nnh-quick-actions"
              role="menu"
              aria-label="Quick actions"
              onKeyDown={onMenuKeyDown}
              className="absolute bottom-[58px] left-1/2 z-40 h-0 w-0"
            >
              {actions.map((a, i) => {
                const p = points[i] ?? { x: 0, y: -radius, angle: 0 };
                const Icon = a.id === 'water' && waterLogged ? Check : a.icon;
                return (
                  <motion.button
                    key={a.id}
                    ref={el => { itemRefs.current[a.id] = el; }}
                    type="button"
                    role="menuitem"
                    aria-label={a.label}
                    onClick={() => runAction(a.id)}
                    className="nnh-quick-item absolute grid h-12 w-12 place-items-center rounded-full focus-visible:outline-none"
                    style={{
                      left: 0,
                      top: 0,
                      marginLeft: -24,
                      marginTop: -24,
                      color: a.tint,
                      borderColor: `color-mix(in srgb, ${a.tint} 32%, transparent)`,
                      boxShadow: `0 12px 22px -12px color-mix(in srgb, ${a.tint} 70%, transparent)`,
                    }}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.35, x: 0, y: 0 }}
                    animate={{ opacity: 1, scale: 1, x: p.x, y: p.y }}
                    transition={reduced
                      ? { duration: 0.12 }
                      : { ...habitSpring.pop, delay: 0.028 * i }}
                    whileTap={reduced ? undefined : { scale: 0.9 }}
                    whileHover={reduced ? undefined : { scale: 1.06 }}
                  >
                    <Icon size={21} strokeWidth={2.4} aria-hidden="true" />
                    <span
                      aria-hidden="true"
                      className="nnh-quick-label pointer-events-none absolute left-1/2 top-full w-[60px] -translate-x-1/2 rounded-[7px] px-1 py-[3px] text-center text-[9.5px] font-extrabold leading-[1.15]"
                      style={{ marginTop: Math.abs(p.angle) < 12 ? 14 : 6 }}
                    >
                      {a.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* capsule */}
          <nav
            ref={navRef}
            aria-label="Primary"
            data-menu-open={menuOpen || undefined}
            onKeyDown={onNavKeyDown}
            className="nnh-nav relative flex h-[68px] items-center px-2"
          >
            {NAV_ITEMS.slice(0, 2).map(item => (
              <NavItem key={item.id} item={item} active={active === item.id} reduced={reduced}
                onClick={() => { haptic('selection'); closeMenu(); onTab(item.id); }} />
            ))}
            <span className="w-[70px] shrink-0" aria-hidden="true" />
            {NAV_ITEMS.slice(2).map(item => (
              <NavItem key={item.id} item={item} active={active === item.id} reduced={reduced}
                onClick={() => { haptic('selection'); closeMenu(); onTab(item.id); }} />
            ))}
          </nav>

          {/* central action */}
          <motion.button
            ref={fabRef}
            type="button"
            aria-label="Quick actions"
            aria-expanded={menuOpen}
            aria-controls="nnh-quick-actions"
            aria-haspopup="menu"
            onClick={() => { haptic(menuOpen ? 'light' : 'medium'); setMenuOpen(v => !v); }}
            className="nnh-fab absolute left-1/2 top-0 z-40 grid h-16 w-16 -translate-x-1/2 -translate-y-[22px] place-items-center rounded-full border-[3px]"
            style={{ borderColor: 'var(--nnh-card)' }}
            whileTap={reduced ? undefined : { scale: 0.88 }}
            whileHover={reduced ? undefined : { scale: 1.04 }}
            transition={habitSpring.nav}
          >
            <motion.span
              className="grid place-items-center"
              aria-hidden="true"
              animate={{ rotate: menuOpen ? 135 : 0 }}
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }}
            >
              <Plus size={28} strokeWidth={2.7} />
            </motion.span>
            <span className="sr-only">Quick actions</span>
          </motion.button>
        </div>
      </motion.div>

      <QuickTaskSheet
        open={taskOpen}
        task={task}
        priority={priority}
        onTask={setTask}
        onPriority={setPriority}
        onClose={() => setTaskOpen(false)}
        onSave={saveTask}
      />
    </>
  );
}

function NavItem({ item, active, onClick, reduced }: {
  item: { id: TabId; label: string; icon: typeof Home };
  active: boolean;
  onClick: () => void;
  reduced: boolean;
}) {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      whileTap={reduced ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.12 }}
      className="nnh-nav-item relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5"
      style={{ color: active ? 'var(--nnh-violet)' : 'var(--nnh-sub)' }}
    >
      <span className="relative grid h-9 w-9 place-items-center">
        {active && (
          <motion.span
            layoutId="nnh-nav-active"
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(147,51,234,0.16), rgba(236,72,153,0.14))',
              border: '1px solid rgba(147,51,234,0.14)',
            }}
            transition={reduced ? { duration: 0 } : habitSpring.nav}
          />
        )}
        <motion.span
          className="relative grid place-items-center"
          initial={false}
          animate={{ scale: active ? 1.04 : 1, y: active ? -0.5 : 0 }}
          transition={reduced ? { duration: 0 } : habitSpring.nav}
        >
          <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
        </motion.span>
      </span>
      <span
        className="text-[10px] font-bold leading-none tracking-tight"
        style={{ color: active ? 'var(--nnh-violet)' : 'var(--nnh-sub)', opacity: active ? 1 : 0.8 }}
      >
        {item.label}
      </span>
    </motion.button>
  );
}

function QuickTaskSheet({ open, task, priority, onTask, onPriority, onClose, onSave }: {
  open: boolean;
  task: string;
  priority: 'high' | 'medium' | 'low';
  onTask: (v: string) => void;
  onPriority: (p: 'high' | 'medium' | 'low') => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const reduced = !!useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return open ? (
    <>
      <motion.div className="absolute inset-0 z-40" style={{ background: 'var(--nnh-scrim)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.16 }}
        onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="New task"
        className="absolute inset-x-3 z-50 rounded-[1.6rem] p-4"
        style={{
          background: 'var(--nnh-card)',
          boxShadow: 'var(--nnh-shadow-lg)',
          bottom: 'calc(12px + var(--nnh-safe-bottom))',
        }}
        initial={reduced ? { opacity: 0 } : { y: '110%' }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-extrabold">New task</p>
            <p className="text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>Added to today’s list</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close task composer"
            className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}>
            <X size={16} />
          </button>
        </div>
        <input
          value={task}
          onChange={e => onTask(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
          placeholder="What needs doing?"
          aria-label="Task title"
          autoFocus
          className="h-12 w-full rounded-2xl border px-4 text-[14px] font-medium outline-none"
          style={{ background: 'var(--nnh-card-soft)', borderColor: 'var(--nnh-line)', color: 'var(--nnh-ink)' }}
        />
        <div className="mt-3 flex gap-2">
          {(['high', 'medium', 'low'] as const).map(p => (
            <button key={p} type="button" aria-pressed={priority === p} onClick={() => { haptic('selection'); onPriority(p); }}
              className="min-h-[40px] flex-1 rounded-full px-3 py-2 text-[11px] font-extrabold capitalize"
              style={priority === p
                ? { background: 'var(--nnh-purple)', color: '#fff' }
                : { background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
              {p}
            </button>
          ))}
        </div>
        <button type="button" onClick={onSave} disabled={!task.trim()}
          className="mt-3 h-12 w-full rounded-2xl text-[14px] font-extrabold text-white nnh-gradient-btn disabled:opacity-40">
          Add task
        </button>
      </motion.div>
    </>
  ) : null;
}
