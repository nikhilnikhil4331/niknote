import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { Segmented, TopBar } from '@/components/habits/ui';
import { FOCUS_QUOTES, focusDurations, toDay, type FocusModeId } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

const MODE_LABEL = { pomodoro: 'Pomodoro', deep: 'Deep Work', custom: 'Custom' } as const;
const DURATION = { pomodoro: '25 / 5 min', deep: '50 / 10 min', custom: 'You decide' } as const;

export function FocusTimerScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, addFocusSession, setFocusMode, setCustom } = useRoutine();
  const reduced = useReducedMotion();
  const mode = state.focusMode;
  const { focus, break: brk } = focusDurations(mode, state.customFocus, state.customBreak);
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [secs, setSecs] = useState(focus);
  const [running, setRunning] = useState(false);
  const [sessionNo, setSessionNo] = useState(0);
  const doneToday = state.focus[today] ?? 0;
  const total = phase === 'focus' ? focus : brk;
  const pct = 1 - secs / total;
  const R = 45;
  const C = 2 * Math.PI * R;
  const quote = FOCUS_QUOTES[(doneToday + sessionNo) % FOCUS_QUOTES.length];

  // Wall-clock deadline keeps the timer accurate after throttling or backgrounding.
  const deadline = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    if (deadline.current === null) deadline.current = Date.now() + secs * 1000;
    const tick = () => setSecs(Math.max(0, Math.ceil(((deadline.current ?? Date.now()) - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [running]);

  useEffect(() => {
    if (secs > 0) return;
    setRunning(false);
    deadline.current = null;
    if (phase === 'focus') {
      addFocusSession();
      setSessionNo(n => n + 1);
      const n = (state.focus[today] ?? 0) + 1;
      haptic('success');
      if (!reduced) confetti({ particleCount: 110, spread: 80, origin: { y: 0.65 }, colors: ['#8b5cf6', '#ec4899', '#f97316', '#ffffff'] });
      if (n === 4) toast.success('4 focus sessions — a legendary day! 🏆');
      else toast.success('Focus session done — break time ☕');
      setPhase('break');
      setSecs(brk);
    } else {
      haptic('medium');
      toast('Break over — back to focus 💪');
      setPhase('focus');
      setSecs(focus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs]);

  // mode / custom duration change resets the clock when not running
  const modeRef = useRef(mode);
  const customRef = useRef({ f: state.customFocus, b: state.customBreak });
  useEffect(() => {
    const changedMode = modeRef.current !== mode;
    const changedCustom = customRef.current.f !== state.customFocus || customRef.current.b !== state.customBreak;
    if (changedMode || changedCustom) {
      modeRef.current = mode;
      customRef.current = { f: state.customFocus, b: state.customBreak };
      setRunning(false);
      setPhase('focus');
      setSecs(focusDurations(mode, state.customFocus, state.customBreak).focus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, state.customFocus, state.customBreak]);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const isFocus = phase === 'focus';

  return (
    <div className="pb-10">
      <TopBar title="Focus Timer" onBack={() => go({ name: 'tab', id: 'home' })}
        right={
          <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
            <span className="nnh-anim-flicker">🍅</span> {doneToday} today
          </div>
        } />
      <div className="px-4 space-y-4">
        <Segmented
          options={(['pomodoro', 'deep', 'custom'] as FocusModeId[]).map(m => ({ id: m, label: MODE_LABEL[m] }))}
          value={mode}
          onChange={m => setFocusMode(m)}
        />

        {/* timer */}
        <section className="nnh-card p-5 flex flex-col items-center relative overflow-hidden">
          <span className="absolute -top-10 -right-10 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%)' }} aria-hidden="true" />
          <div className="relative w-[240px] h-[240px]">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <defs>
                <linearGradient id="nnh-focus-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" /><stop offset="55%" stopColor="#ec4899" /><stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--nnh-line)" strokeWidth="6.5" />
              <motion.circle cx="50" cy="50" r={R} fill="none" stroke="url(#nnh-focus-grad)" strokeWidth="6.5" strokeLinecap="round"
                strokeDasharray={C}
                animate={{ strokeDashoffset: C * (1 - pct) }}
                transition={reduced ? { duration: 0 } : { ease: 'linear', duration: 0.9 }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <motion.p key={mm + ss} initial={false} className="text-[52px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {mm}:{ss}
                </motion.p>
                <p className="text-[13px] font-bold mt-1" style={{ color: isFocus ? 'var(--nnh-purple)' : '#16a34a' }}>
                  {isFocus ? 'Focus' : 'Break'}
                </p>
              </div>
            </div>
            {running && !reduced && (
              <motion.span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--nnh-pink)' }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.9, 0.3, 0.9] }} transition={{ duration: 1.2, repeat: Infinity }} />
            )}
          </div>

          <div className="flex items-center gap-5 mt-4">
            <motion.button whileTap={{ scale: 0.85 }} type="button" aria-label="Reset"
              onClick={() => { haptic('light'); setRunning(false); deadline.current = null; setPhase('focus'); setSecs(focus); }}
              className="w-13 h-13 rounded-full grid place-items-center" style={{ width: 52, height: 52, background: 'var(--nnh-card-soft)' }}>
              <RotateCcw size={19} />
            </motion.button>
            <motion.button whileTap={reduced ? undefined : { scale: 0.9 }} whileHover={reduced ? undefined : { scale: 1.06 }} type="button"
              onClick={() => { haptic('success'); if (running) { const remaining = Math.max(0, Math.ceil(((deadline.current ?? Date.now()) - Date.now()) / 1000)); setSecs(remaining); deadline.current = null; setRunning(false); } else { deadline.current = Date.now() + secs * 1000; setRunning(true); } }} aria-label={running ? 'Pause' : 'Start'}
              className="w-18 h-18 rounded-full nnh-gradient-btn grid place-items-center text-white relative" style={{ width: 72, height: 72 }}>
              {running && !reduced && <motion.span className="absolute inset-0 rounded-full nnh-gradient-btn" animate={{ scale: [1, 1.35], opacity: [0.45, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
              {running ? <Pause size={28} className="relative" fill="currentColor" /> : <Play size={28} className="relative translate-x-0.5" fill="currentColor" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} type="button" aria-label="Skip to next phase"
              onClick={() => { haptic('light'); setSecs(0); }}
              className="grid place-items-center" style={{ width: 52, height: 52 }}>
              <span className="w-13 h-13 rounded-full grid place-items-center" style={{ width: 52, height: 52, background: 'var(--nnh-card-soft)' }}>
                <SkipForward size={19} />
              </span>
            </motion.button>
          </div>
          <p className="text-[11px] font-semibold mt-3" style={{ color: 'var(--nnh-sub)' }}>{DURATION[mode]}</p>
        </section>

        {/* custom lengths */}
        {mode === 'custom' && (
          <section className="nnh-card p-4 grid grid-cols-2 gap-3">
            {([['Focus', 'customFocus', state.customFocus, 1, 180], ['Break', 'customBreak', state.customBreak, 1, 60]] as const).map(([label, key, val, lo, hi]) => (
              <div key={key} className="nnh-chip px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{label} (min)</span>
                <span className="flex items-center gap-1.5">
                  <button type="button" aria-label={`Decrease ${label.toLowerCase()} minutes`} onClick={() => { haptic('light'); if (key === 'customFocus') setCustom(Math.max(lo, val - 5), state.customBreak); else setCustom(state.customFocus, Math.max(lo, val - 5)); }}
                    className="w-6 h-6 rounded-full grid place-items-center text-[13px] font-bold" style={{ background: 'var(--nnh-card-soft)' }}>−</button>
                  <span className="text-[14px] font-extrabold w-6 text-center tabular-nums">{val}</span>
                  <button type="button" aria-label={`Increase ${label.toLowerCase()} minutes`} onClick={() => { haptic('light'); if (key === 'customFocus') setCustom(Math.min(hi, val + 5), state.customBreak); else setCustom(state.customFocus, Math.min(hi, val + 5)); }}
                    className="w-6 h-6 rounded-full grid place-items-center text-[13px] font-bold text-white nnh-gradient-btn">+</button>
                </span>
              </div>
            ))}
          </section>
        )}

        {/* current session */}
        <section className="nnh-card p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl grid place-items-center text-2xl" style={{ background: '#fee2e2' }}>🍅</span>
          <div className="flex-1">
            <p className="text-[14px] font-bold">Current Session</p>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Focus ({Math.min(doneToday, 4)}/4)</p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <motion.span key={i} initial={false}
                animate={i < doneToday && !reduced ? { scale: [1, 1.4, 1] } : {}}
                transition={{ delay: i * 0.06 }}
                className="rounded-full" style={{ width: 9, height: 9, background: i < doneToday ? 'var(--nnh-pink)' : 'var(--nnh-line)' }} />
            ))}
          </div>
        </section>

        {/* quote */}
        <motion.blockquote key={quote} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="text-center text-[13px] font-medium italic px-6 py-3" style={{ color: 'var(--nnh-sub)' }}>
          “{quote}”
        </motion.blockquote>
      </div>
    </div>
  );
}
