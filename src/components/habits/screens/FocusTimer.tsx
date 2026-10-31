import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Minus, Pause, Play, Plus, RotateCcw, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { Segmented, TopBar } from '@/components/habits/ui';
import { FOCUS_QUOTES, focusDurations, toDay, type FocusModeId } from '@/lib/trackers';
import { endAtFor, formatClock, phaseComplete, secondsLeft, type FocusPhase } from '@/lib/focusClock';
import { haptic } from '@/hooks/useHaptics';

const MODE_LABEL = { pomodoro: 'Pomodoro', deep: 'Deep Work', custom: 'Custom' } as const;
const MODE_HINT = { pomodoro: '25 min focus · 5 min break', deep: '50 min focus · 10 min break', custom: 'You decide the rhythm' } as const;

export function FocusTimerScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, addFocusSession, setFocusMode, setCustom } = useRoutine();
  const reduced = useReducedMotion();
  const mode = state.focusMode;
  const { focus, break: brk } = focusDurations(mode, state.customFocus, state.customBreak);

  const [phase, setPhase] = useState<FocusPhase>('focus');
  const [remaining, setRemaining] = useState(focus);
  /** Absolute end timestamp while running; null when paused/idle. */
  const [endAt, setEndAt] = useState<number | null>(null);
  const running = endAt !== null;
  const total = phase === 'focus' ? focus : brk;
  const pct = total ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  const R = 45;
  const C = 2 * Math.PI * R;
  const doneToday = state.focus[today] ?? 0;
  const quote = FOCUS_QUOTES[(doneToday + (phase === 'focus' ? 0 : 1)) % FOCUS_QUOTES.length];

  // Wall-clock driven: the displayed value is derived from timestamps, so a
  // throttled or suspended tab resumes with the correct time remaining.
  useEffect(() => {
    if (endAt == null) return;
    const tick = () => setRemaining(secondsLeft(endAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [endAt]);

  // Phase transitions are driven only by the clock reaching zero.
  useEffect(() => {
    if (!phaseComplete(remaining)) return;
    setEndAt(null);
    if (phase === 'focus') {
      addFocusSession();
      const n = (state.focus[toDay(new Date())] ?? 0) + 1;
      haptic('success');
      if (!reduced) confetti({ particleCount: 90, spread: 74, origin: { y: 0.65 }, colors: ['#7C5F9E', '#A34054', '#D9822F', '#ffffff'] });
      toast.success(n === 4 ? '4 focus sessions — a legendary day! 🏆' : 'Focus session done — break time ☕');
      setPhase('break');
      setRemaining(brk);
    } else {
      haptic('medium');
      toast('Break over — back to focus 💪');
      setPhase('focus');
      setRemaining(focus);
    }
    // Only react to the clock hitting zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Mode or custom-length changes reset the clock (and stop it) so durations never drift.
  const prevDurations = useRef({ focus, brk });
  useEffect(() => {
    if (prevDurations.current.focus === focus && prevDurations.current.brk === brk) return;
    prevDurations.current = { focus, brk };
    setEndAt(null);
    setPhase('focus');
    setRemaining(focus);
  }, [focus, brk]);

  const startOrPause = () => {
    if (running) {
      haptic('light');
      setRemaining(secondsLeft(endAt!, Date.now()));
      setEndAt(null);
      return;
    }
    haptic('success');
    if (remaining <= 0) setRemaining(total);
    setEndAt(endAtFor(remaining > 0 ? remaining : total, Date.now()));
  };

  const reset = () => {
    haptic('light');
    setEndAt(null);
    setPhase('focus');
    setRemaining(focus);
  };

  const isFocus = phase === 'focus';
  const clock = formatClock(remaining);

  return (
    <div className="pb-2">
      <TopBar title="Focus Timer" onBack={() => go({ name: 'tab', id: 'home' })}
        right={
          <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
            <span className="nnh-anim-flicker">🍅</span> {doneToday} today
          </div>
        } />
      <div className="space-y-4 px-4">
        <Segmented
          options={(['pomodoro', 'deep', 'custom'] as FocusModeId[]).map(m => ({ id: m, label: MODE_LABEL[m] }))}
          value={mode}
          onChange={m => setFocusMode(m)}
        />

        <section className="nnh-card relative flex flex-col items-center overflow-hidden p-5">
          <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full" aria-hidden="true"
            style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.16), transparent 70%)' }} />
          <span className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full" aria-hidden="true"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }} />

          <div className="relative h-[244px] w-[244px]">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <defs>
                <linearGradient id="nnh-focus-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7C5F9E" /><stop offset="55%" stopColor="#A34054" /><stop offset="100%" stopColor="#ff7a8a" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--nnh-line)" strokeWidth="6" />
              <motion.circle cx="50" cy="50" r={R} fill="none" stroke="url(#nnh-focus-grad)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={C}
                animate={{ strokeDashoffset: C * (1 - pct) }}
                transition={reduced ? { duration: 0 } : { ease: 'linear', duration: 0.28 }}
              />
              {isFocus && (
                <circle cx="50" cy="50" r={R - 8} fill="none" stroke="var(--nnh-pink)" strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="1 5" />
              )}
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div
                  role="timer"
                  aria-live={running ? 'off' : 'polite'}
                  aria-label={`${clock} ${isFocus ? 'focus' : 'break'} remaining`}
                  className="nnh-display text-[54px] font-extrabold leading-none tabular-nums"
                >
                  {clock}
                </div>
                <p className="mt-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em]" style={{ color: isFocus ? 'var(--nnh-violet)' : '#16a34a' }}>
                  {isFocus ? 'Focus' : 'Break'}
                </p>
                <p className="mt-1 text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                  {Math.round(pct * 100)}% of {Math.round(total / 60)} min
                </p>
              </div>
            </div>
            {running && !reduced && (
              <motion.span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--nnh-pink)' }}
                animate={{ scale: [1, 1.55, 1], opacity: [0.9, 0.35, 0.9] }} transition={{ duration: 1.6, repeat: Infinity }} aria-hidden="true" />
            )}
          </div>

          <div className="mt-4 flex items-center gap-5">
            <motion.button whileTap={{ scale: 0.86 }} type="button" aria-label="Reset" onClick={reset}
              className="grid place-items-center rounded-full" style={{ width: 52, height: 52, background: 'var(--nnh-card-soft)' }}>
              <RotateCcw size={19} />
            </motion.button>
            <motion.button whileTap={reduced ? undefined : { scale: 0.92 }} whileHover={reduced ? undefined : { scale: 1.04 }} type="button"
              onClick={startOrPause} aria-label={running ? 'Pause' : 'Start'}
              className="nnh-gradient-btn relative grid place-items-center rounded-full text-white"
              style={{ width: 74, height: 74 }}>
              {running && !reduced && (
                <motion.span className="nnh-gradient-btn absolute inset-0 rounded-full" aria-hidden="true"
                  animate={{ scale: [1, 1.3], opacity: [0.4, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
              )}
              {running ? <Pause size={28} className="relative" fill="currentColor" /> : <Play size={28} className="relative translate-x-0.5" fill="currentColor" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.86 }} type="button" aria-label="Skip to next phase"
              onClick={() => { haptic('light'); setEndAt(null); setRemaining(0); }}
              className="grid h-[52px] w-[52px] place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}>
              <SkipForward size={19} />
            </motion.button>
          </div>
          <p className="mt-3 text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{MODE_HINT[mode]}</p>
        </section>

        {mode === 'custom' && (
          <section className="nnh-card grid grid-cols-2 gap-3 p-4">
            {([['Focus', 'customFocus', state.customFocus, 1, 180], ['Break', 'customBreak', state.customBreak, 1, 60]] as const).map(([label, key, val, lo, hi]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl px-3 py-2 nnh-chip">
                <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{label} (min)</span>
                <span className="flex items-center gap-1.5">
                  <button type="button" aria-label={`Decrease ${label.toLowerCase()} minutes`}
                    onClick={() => { haptic('light'); if (key === 'customFocus') setCustom(Math.max(lo, val - 5), state.customBreak); else setCustom(state.customFocus, Math.max(lo, val - 5)); }}
                    className="grid h-6 w-6 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}><Minus size={12} /></button>
                  <span className="w-6 text-center text-[14px] font-extrabold tabular-nums">{val}</span>
                  <button type="button" aria-label={`Increase ${label.toLowerCase()} minutes`}
                    onClick={() => { haptic('light'); if (key === 'customFocus') setCustom(Math.min(hi, val + 5), state.customBreak); else setCustom(state.customFocus, Math.min(hi, val + 5)); }}
                    className="grid h-6 w-6 place-items-center rounded-full text-white nnh-gradient-btn"><Plus size={12} /></button>
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="nnh-card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-2xl" style={{ background: 'var(--nnh-pale-pink)' }}>🍅</span>
          <div className="flex-1">
            <p className="text-[14px] font-extrabold">Current Session</p>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Focus ({Math.min(doneToday, 4)}/4)</p>
          </div>
          <div className="flex gap-1.5" role="img" aria-label={`${doneToday} focus sessions completed today`}>
            {Array.from({ length: 4 }, (_, i) => (
              <motion.span key={i} initial={false}
                animate={i < doneToday && !reduced ? { scale: [1, 1.35, 1] } : {}}
                transition={{ delay: i * 0.06 }}
                className="rounded-full" style={{ width: 9, height: 9, background: i < doneToday ? 'var(--nnh-pink)' : 'var(--nnh-line)' }} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <div className="nnh-card px-2 py-3 text-center">
            <p className="nnh-display text-[18px] font-extrabold" style={{ color: 'var(--nnh-violet)' }}>{doneToday}</p>
            <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Sessions today</p>
          </div>
          <div className="nnh-card px-2 py-3 text-center">
            <p className="nnh-display text-[18px] font-extrabold" style={{ color: 'var(--nnh-pink)' }}>
              {Object.values(state.focus).reduce((a, b) => a + b, 0)}
            </p>
            <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>All sessions</p>
          </div>
          <div className="nnh-card px-2 py-3 text-center">
            <p className="nnh-display text-[18px] font-extrabold" style={{ color: 'var(--nnh-orange)' }}>
              {Math.round((Object.values(state.focus).reduce((a, b) => a + b, 0) * 25) / 60 * 10) / 10}h
            </p>
            <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Focused time</p>
          </div>
        </div>

        <motion.blockquote key={quote} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="px-6 py-3 text-center text-[13px] font-medium italic" style={{ color: 'var(--nnh-sub)' }}>
          "{quote}"
        </motion.blockquote>
      </div>
    </div>
  );
}
