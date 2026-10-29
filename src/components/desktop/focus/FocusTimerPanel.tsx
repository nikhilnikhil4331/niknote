// ============================================================
// NikNote — FocusTimerPanel (Pomodoro / Countdown / Stopwatch)
//
// The desktop focus timer from the redesign mockup:
// • one shared duration state drives the draggable dial, the
//   preset chips and the custom input — they can never disagree;
// • countdowns are timestamp based (lib/focusClock) so background
//   tabs stay accurate; stopwatch uses lib/stopwatch;
// • runtime state persists to localStorage on transitions only
//   (never per tick) so a browser refresh resumes correctly;
// • completed sessions are recorded exactly once to the desktop
//   focus-session store — the analytics charts read that store,
//   so graphs always reflect real usage;
// • sound is optional (settings) and only plays after a gesture.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Flag, Settings2, Volume2, VolumeX, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { CircularDial } from './CircularDial';
import {
  useFocusSessions, useTimerSettings, useLocalStore, useLinkedTask,
  loadPersistedTimer, savePersistedTimer, FOCUS_CATEGORIES,
  type FocusKind, type NikTask,
} from '../store';
import { secondsLeft, endAtFor, formatClock, phaseComplete } from '@/lib/focusClock';
import {
  stopped, startSw, pauseSw, elapsedSw, isRunningSw,
  formatStopwatch, lapDuration, lapExtremes, type StopwatchState,
} from '@/lib/stopwatch';
import { DIAL_PRESETS, formatMinutesLabel, type DialRange } from '@/lib/dialMath';
import { playCompletionChime, playTick, primeAudio } from '@/lib/chime';
import { cn } from '@/lib/utils';

type CdownPhase = 'idle' | 'focus' | 'shortBreak' | 'longBreak';

const MODE_LABEL: Record<FocusKind, string> = { pomodoro: 'Pomodoro', timer: 'Timer', stopwatch: 'Stopwatch' };
// Countdown selection bounds (dial + presets + custom input share these)
const SELECT_MIN = 5;
const SELECT_MAX: DialRange = { min: SELECT_MIN, max: 120 };

const clampSel = (m: number) =>
  Math.min(SELECT_MAX.max, Math.max(SELECT_MIN, Math.round(m)));

interface FocusTimerPanelProps {
  /** Today's/open tasks so a session can be linked to a task. */
  tasks: NikTask[];
  compact?: boolean;
  /** Called when a session gets recorded (parent may refresh). */
  onSessionRecorded?: () => void;
}

export const FocusTimerPanel: React.FC<FocusTimerPanelProps> = ({ tasks, compact = false, onSessionRecorded }) => {
  const { settings, update } = useTimerSettings();
  const { recordSession } = useFocusSessions();
  const [mode, setMode] = useLocalStore<FocusKind>('niknote.desktop.timerMode.v1', 'pomodoro');

  // ---------- countdown state (pomodoro + timer) ----------
  const [phase, setPhase] = useState<CdownPhase>('idle');
  const [timerMinutes, setTimerMinutes] = useState(25);       // timer-mode configured duration
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(settings.pomodoroFocus * 60);
  const [roundsDone, setRoundsDone] = useState(0);
  const [category, setCategory] = useState(FOCUS_CATEGORIES[0].name);
  const { taskId, setTaskId } = useLinkedTask(); // shared with task widgets (live sync)
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // ---------- stopwatch state ----------
  const [sw, setSw] = useState<StopwatchState>(stopped());
  const [swElapsed, setSwElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  const running = endAt != null;
  const cdownActive = phase !== 'idle'; // any pomodoro/timer session in progress (running OR paused)
  const stopwatchActive = isRunningSw(sw) || swElapsed > 0;
  const anyActive = cdownActive || stopwatchActive;

  /** Configured focus minutes for the CURRENT countdown mode. */
  const configuredMin = mode === 'pomodoro' ? settings.pomodoroFocus : timerMinutes;

  const breakSec = useMemo(() => {
    const next = roundsDone + 1;
    const isLong = next % Math.max(1, settings.pomodoroRounds) === 0;
    return (phase === 'shortBreak' ? settings.pomodoroShortBreak : phase === 'longBreak' ? settings.pomodoroLongBreak : isLong ? settings.pomodoroLongBreak : settings.pomodoroShortBreak) * 60;
  }, [phase, roundsDone, settings]);

  const focusSec = configuredMin * 60;
  const totalSec = phase === 'idle' || phase === 'focus' ? focusSec : breakSec;

  /** Marker so a completed phase is handled exactly once. */
  const completedTokenRef = useRef<string | null>(null);
  const persistTimer = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const setConfiguredMinutes = useCallback(
    (m: number) => {
      const v = clampSel(m);
      if (mode === 'pomodoro') update({ pomodoroFocus: v });
      else setTimerMinutes(v);
    },
    [mode, update],
  );

  // ---------- hydrate from persisted runtime state (refresh-safe) ----------
  useEffect(() => {
    const saved = loadPersistedTimer();
    if (!saved) {
      setHydrated(true);
      return;
    }
    if (!saved) return;
    try {
      setMode(saved.mode);
      setCategory(saved.category || FOCUS_CATEGORIES[0].name);
      setTaskId(saved.taskId || '');
      if (saved.mode === 'stopwatch') {
        setSw({ baseMs: saved.baseMs ?? 0, startedAt: saved.startedAt ?? null });
        setSwElapsed(elapsedSw({ baseMs: saved.baseMs ?? 0, startedAt: saved.startedAt ?? null }, Date.now()));
        setLaps(Array.isArray(saved.laps) ? saved.laps : []);
        setHydrated(true);
        return;
      }
      if (saved.configuredMin) {
        if (saved.mode === 'pomodoro') update({ pomodoroFocus: clampSel(saved.configuredMin) });
        else setTimerMinutes(clampSel(saved.configuredMin));
      }
      setPhase(saved.phase || 'idle');
      setRoundsDone(saved.roundsDone ?? 0);
      setSessionStartedAt(saved.sessionStartedAt ?? null);
      if (saved.endAt != null) {
        setEndAt(saved.endAt);
        setRemainingSec(secondsLeft(saved.endAt, Date.now())); // handles "completed while away": → 0 → completion flow
      } else if (typeof saved.remainingSec === 'number') {
        setRemainingSec(saved.remainingSec);
      } else {
        setRemainingSec((saved.configuredMin ?? 25) * 60);
      }
    } catch {
      /* corrupt state → start clean */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- persist on TRANSITIONS only, debounced (never per tick) ----------
  // remainingSec / swElapsed update continuously while ticking, so they are
  // deliberately NOT dependencies: endAt/startedAt fully determine them.
  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      if (mode === 'stopwatch') {
        savePersistedTimer({
          mode, baseMs: sw.baseMs, startedAt: sw.startedAt, laps, savedAt: Date.now(),
        });
      } else {
        savePersistedTimer({
          mode, phase, remainingSec, endAt,
          configuredMin, roundsDone, category, taskId, sessionStartedAt,
          savedAt: Date.now(),
        });
      }
    }, 60);
    return () => { if (persistTimer.current) window.clearTimeout(persistTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, mode, phase, endAt, configuredMin, roundsDone, category, taskId, sessionStartedAt, sw, laps, remainingSec === 0]);

  // ---------- countdown ticking (timestamp derived) ----------
  useEffect(() => {
    if (endAt == null) return;
    const tick = () => setRemainingSec(secondsLeft(endAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    const onFocus = () => tick();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [endAt]);

  // ---------- stopwatch ticking ----------
  useEffect(() => {
    if (sw.startedAt == null) return;
    const tick = () => setSwElapsed(elapsedSw(sw, Date.now()));
    tick();
    const id = window.setInterval(tick, 50);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [sw]);

  // ---------- completion handling (exactly once per phase) ----------
  const recordFocusSession = useCallback(
    (nowIso: string) => {
      recordSession({
        kind: mode === 'pomodoro' ? 'pomodoro' : 'timer',
        startedAt: sessionStartedAt ?? nowIso,
        endedAt: nowIso,
        durationSec: totalSec,
        category,
        taskId: taskId || undefined,
        taskTitle: tasks.find((t) => t.id === taskId)?.title,
        phase: 'focus',
      });
      onSessionRecorded?.();
    },
    [recordSession, mode, sessionStartedAt, totalSec, category, taskId, tasks, onSessionRecorded],
  );

  useEffect(() => {
    if (phase === 'idle' || !phaseComplete(remainingSec)) return;
    const token = `${phase}|${sessionStartedAt}|${roundsDone}|${totalSec}`;
    if (completedTokenRef.current === token) return;
    completedTokenRef.current = token;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    setEndAt(null);

    if (phase === 'focus') {
      recordFocusSession(nowIso);
      playCompletionChime(settings.sound);
      setJustCompleted(true);
      window.setTimeout(() => setJustCompleted(false), 700);
      if (mode === 'pomodoro') {
        const done = roundsDone + 1;
        setRoundsDone(done);
        const long = done % Math.max(1, settings.pomodoroRounds) === 0;
        const nextPhase: CdownPhase = long ? 'longBreak' : 'shortBreak';
        const secs = (long ? settings.pomodoroLongBreak : settings.pomodoroShortBreak) * 60;
        const linked = taskId ? ` for “${tasks.find((t) => t.id === taskId)?.title ?? 'task'}”` : '';
        toast.success(`Focus session complete${linked} — ${long ? 'long' : 'short'} break time ☕`);
        setPhase(nextPhase);
        setSessionStartedAt(null);
        setRemainingSec(secs);
        if (settings.autoStartBreak) setEndAt(endAtFor(secs, now));
      } else {
        toast.success(`Timer complete — ${formatMinutesLabel(configuredMin)} of focused ${category.toLowerCase()} logged 🎉`);
        setPhase('idle');
        setSessionStartedAt(null);
        setRemainingSec(focusSec); // phase below re-derives; keep for consistency
      }
    } else {
      // break finished
      playCompletionChime(settings.sound);
      toast('Break over — ready for the next round 💪');
      setPhase('focus');
      setRemainingSec(focusSec);
      if (settings.autoStartNextFocus) {
        setSessionStartedAt(nowIso);
        setEndAt(endAtFor(focusSec, now));
      } else {
        // paused-at-start: stay in focus phase idle state? → keep phase 'focus' but not running
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, phase]);

  // Focus phase but not running and no endAt → effectively paused; keeps UI correct.
  const focusPaused = (phase === 'focus' || phase === 'shortBreak' || phase === 'longBreak') && endAt == null;

  // ---------- countdown controls ----------
  const startFocus = useCallback(() => {
    primeAudio();
    playTick(settings.sound);
    const now = Date.now();
    if (phase === 'idle' || (phase === 'focus' && !sessionStartedAt && remainingSec >= focusSec)) {
      setPhase('focus');
      setSessionStartedAt(new Date(now).toISOString());
      setRemainingSec(focusSec);
      setEndAt(endAtFor(focusSec, now));
    } else if (focusPaused) {
      setEndAt(endAtFor(remainingSec, now));
    }
  }, [phase, sessionStartedAt, remainingSec, focusSec, focusPaused, settings.sound]);

  const pauseCountdown = useCallback(() => {
    if (endAt == null) return;
    playTick(settings.sound);
    setRemainingSec(secondsLeft(endAt, Date.now()));
    setEndAt(null);
  }, [endAt, settings.sound]);

  const resetCountdown = useCallback(() => {
    playTick(settings.sound);
    completedTokenRef.current = null;
    setEndAt(null);
    setPhase('idle');
    setRoundsDone(0);
    setSessionStartedAt(null);
    setRemainingSec(focusSec);
  }, [focusSec, settings.sound]);

  const skipPhase = useCallback(() => {
    playTick(settings.sound);
    const secs = focusSec;
    completedTokenRef.current = null;
    setEndAt(null);
    setSessionStartedAt(null);
    if (phase === 'shortBreak' || phase === 'longBreak') {
      setPhase('focus');
      setRemainingSec(secs);
    } else {
      // skipping a focus phase discards it (not recorded as focus time)
      setPhase('idle');
      setRemainingSec(focusSec);
    }
  }, [phase, focusSec, settings.sound]);

  // ---------- stopwatch controls ----------
  const swStart = () => { primeAudio(); playTick(settings.sound); setSw((s) => startSw(s, Date.now())); };
  const swPause = () => {
    playTick(settings.sound);
    setSw((s) => { const p = pauseSw(s, Date.now()); setSwElapsed(p.baseMs); return p; });
  };
  const swLap = () => {
    if (!isRunningSw(sw)) return;
    playTick(settings.sound);
    setLaps((l) => [...l, elapsedSw(sw, Date.now())]);
  };
  const swResetAll = useCallback(() => {
    playTick(settings.sound);
    setSw(stopped());
    setSwElapsed(0);
    setLaps([]);
  }, [settings.sound]);
  const swSaveAndReset = () => {
    if (swElapsed >= 1000) {
      const nowIso = new Date().toISOString();
      recordSession({
        kind: 'stopwatch',
        startedAt: new Date(Date.now() - swElapsed).toISOString(),
        endedAt: nowIso,
        durationSec: Math.round(swElapsed / 1000),
        category,
        taskId: taskId || undefined,
        taskTitle: tasks.find((t) => t.id === taskId)?.title,
      });
      toast.success(`Stopwatch session saved — ${formatMinutesLabel(swElapsed / 60000)} logged`);
    }
    swResetAll();
    onSessionRecorded?.();
  };

  // ---------- mode switching (never destroys a live session) ----------
  const switchMode = (m: FocusKind) => {
    if (m === mode) return;
    if (anyActive) {
      toast.info('Finish or reset the active session before switching modes');
      return;
    }
    playTick(settings.sound);
    setMode(m);
    if (m !== 'stopwatch') {
      const mins = m === 'pomodoro' ? settings.pomodoroFocus : timerMinutes;
      setRemainingSec(mins * 60);
      setPhase('idle');
    }
  };

  // ---------- display ----------
  const adjustedIdle = !cdownActive && mode !== 'stopwatch';
  const dialMinutes = mode === 'stopwatch' ? 0 : configuredMin;
  const remainingFrac = mode === 'stopwatch' ? undefined : phase === 'idle' ? undefined : remainingSec / Math.max(1, totalSec);

  const centerMain = mode === 'stopwatch'
    ? formatStopwatch(swElapsed)
    : phase === 'idle'
      ? `${String(clampSel(configuredMin)).padStart(2, '0')}:00`
      : formatClock(remainingSec);

  const centerLabel = mode === 'stopwatch'
    ? isRunningSw(sw) ? 'Running' : swElapsed > 0 ? 'Paused' : 'Stopwatch'
    : phase === 'idle'
      ? 'Focus Time'
      : phase === 'focus'
        ? running ? 'Focusing…' : 'Paused'
        : phase === 'shortBreak' ? 'Short Break' : 'Long Break';

  const extremes = lapExtremes(laps);
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'done').slice(0, 12), [tasks]);
  const linkedTask = taskId ? tasks.find((t) => t.id === taskId) : undefined;

  const submitCustom = () => {
    const v = parseInt(customText, 10);
    if (Number.isFinite(v) && v >= SELECT_MIN && v <= SELECT_MAX.max) {
      setConfiguredMinutes(v);
      setCustomOpen(false);
      setCustomText('');
    } else {
      toast.error(`Enter a duration between ${SELECT_MIN} and ${SELECT_MAX.max} minutes`);
    }
  };

  const dialSize = compact ? 216 : 264;

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {/* mode tabs + settings */}
      <div className="flex items-center gap-2">
        <div className="nd-seg flex-1" role="tablist" aria-label="Timer mode">
          {(['pomodoro', 'timer', 'stopwatch'] as FocusKind[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={cn(mode === m && 'nd-on')}
              onClick={() => switchMode(m)}
              title={anyActive && mode !== m ? 'Reset the active session to switch' : MODE_LABEL[m]}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="relative flex-none">
          <button
            className="nd-icon-btn"
            title="Timer settings"
            aria-label="Timer settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <Settings2 size={15} />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
              <div className="nd-menu !p-3" style={{ right: 0, left: 'auto', top: 34, minWidth: 232, position: 'absolute', zIndex: 50 }}>
                <label className="flex items-center gap-2.5 text-[12.5px] font-semibold py-1.5 cursor-pointer" style={{ color: 'var(--nd-ink)' }}>
                  <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} />
                  {settings.sound ? <Volume2 size={14} /> : <VolumeX size={14} />} Completion sound
                </label>
                <label className="flex items-center gap-2.5 text-[12.5px] font-semibold py-1.5 cursor-pointer" style={{ color: 'var(--nd-ink)' }}>
                  <input type="checkbox" checked={settings.autoStartBreak} onChange={(e) => update({ autoStartBreak: e.target.checked })} />
                  Auto-start breaks
                </label>
                <label className="flex items-center gap-2.5 text-[12.5px] font-semibold py-1.5 cursor-pointer" style={{ color: 'var(--nd-ink)' }}>
                  <input type="checkbox" checked={settings.autoStartNextFocus} onChange={(e) => update({ autoStartNextFocus: e.target.checked })} />
                  Auto-start next focus
                </label>
                <div className="pt-1.5 mt-1 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--nd-border-soft)' }}>
                  {([
                    ['Short break', 'pomodoroShortBreak', 1, 30],
                    ['Long break', 'pomodoroLongBreak', 5, 60],
                  ] as const).map(([lbl, key, lo, hi]) => (
                    <label key={key} className="text-[11px] font-bold" style={{ color: 'var(--nd-ink-2)' }}>
                      {lbl} (min)
                      <input
                        className="nd-input !py-1 !px-2 !text-[12px] mt-1"
                        type="number" min={lo} max={hi}
                        value={settings[key]}
                        onChange={(e) => update({ [key]: Math.min(hi, Math.max(lo, parseInt(e.target.value, 10) || lo)) })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* dial */}
      <div className={cn('flex justify-center', justCompleted && 'nd-complete-pop')}>
        <CircularDial
          size={dialSize}
          minutes={dialMinutes}
          onChangeMinutes={(m) => {
            if (mode === 'stopwatch') return;
            setConfiguredMinutes(m);
            if (phase === 'idle') setRemainingSec(clampSel(m) * 60);
          }}
          remainingFrac={remainingFrac}
          running={running}
          disabled={mode === 'stopwatch'}
          label="Timer duration dial"
        >
          <div className="text-center pointer-events-none select-none px-4">
            <div
              className="tabular-nums font-extrabold tracking-[-0.02em]"
              style={{
                fontSize: mode === 'stopwatch' ? (compact ? 27 : 32) : compact ? 34 : 42,
                color: 'var(--nd-ink)', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
              }}
              role="timer"
              aria-live="off"
              aria-label={`${centerLabel}: ${centerMain}`}
            >
              {centerMain}
            </div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.13em]" style={{ color: phase === 'shortBreak' || phase === 'longBreak' ? 'var(--nd-success)' : 'var(--nd-brand-magenta)' }}>
              {centerLabel}
            </div>
            {adjustedIdle && (
              <div className="mt-1 text-[10px] font-semibold" style={{ color: 'var(--nd-text-3)' }}>
                Drag the ring to set time
              </div>
            )}
            {linkedTask && phase !== 'idle' && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--nd-lavender)', color: 'var(--nd-brand)' }}>
                <Link2 size={9} /> <span className="max-w-[150px] truncate">{linkedTask.title}</span>
              </div>
            )}
          </div>
        </CircularDial>
      </div>

      {/* pomodoro rounds */}
      {mode === 'pomodoro' && (
        <div className="flex items-center justify-center gap-1.5" role="img" aria-label={`${roundsDone % Math.max(1, settings.pomodoroRounds)} of ${settings.pomodoroRounds} rounds before a long break`}>
          {Array.from({ length: Math.max(1, settings.pomodoroRounds) }, (_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: 8, height: 8,
                background: i < roundsDone % Math.max(1, settings.pomodoroRounds) || (roundsDone > 0 && roundsDone % Math.max(1, settings.pomodoroRounds) === 0) ? 'var(--nd-brand-magenta)' : '#eadff6',
              }}
            />
          ))}
          <span className="ml-1.5 text-[10.5px] font-bold" style={{ color: 'var(--nd-text-3)' }}>
            {roundsDone} session{roundsDone === 1 ? '' : 's'} this run
          </span>
        </div>
      )}

      {/* presets (idle countdown modes) */}
      {mode !== 'stopwatch' && adjustedIdle && (
        <div>
          <div className="grid grid-cols-4 gap-1.5">
            {DIAL_PRESETS.map((p) => (
              <button
                key={p}
                className={cn('nd-preset', configuredMin === p && 'nd-on')}
                aria-pressed={configuredMin === p}
                onClick={() => { playTick(settings.sound); setConfiguredMinutes(p); setRemainingSec(p * 60); }}
              >
                {p < 60 ? `${p} min` : '1h'}
              </button>
            ))}
            <button
              className={cn('nd-preset', customOpen && 'nd-on')}
              onClick={() => setCustomOpen((v) => !v)}
              aria-expanded={customOpen}
            >
              Custom
            </button>
          </div>
          {customOpen && (
            <div className="flex items-center gap-2 mt-2">
              <input
                className="nd-input !py-1.5"
                type="number" min={SELECT_MIN} max={SELECT_MAX.max}
                placeholder={`${SELECT_MIN}–${SELECT_MAX.max} min`}
                value={customText}
                autoFocus
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
                aria-label="Custom duration in minutes"
              />
              <button className="nd-btn-cta !py-1.5 !px-3.5 !text-[12.5px]" onClick={submitCustom}>Set</button>
            </div>
          )}
        </div>
      )}

      {/* main controls */}
      <div className="flex items-center justify-center gap-4">
        {mode !== 'stopwatch' ? (
          <>
            <button
              className="nd-icon-btn !w-11 !h-11"
              style={{ background: '#f4effc' }}
              onClick={resetCountdown}
              title="Reset"
              aria-label="Reset timer"
              disabled={!cdownActive && remainingSec === focusSec}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="nd-btn-cta !rounded-full !p-0 grid place-items-center"
              style={{ width: compact ? 58 : 68, height: compact ? 58 : 68 }}
              onClick={running ? pauseCountdown : startFocus}
              aria-label={running ? 'Pause' : 'Start'}
              title={running ? 'Pause' : phase === 'shortBreak' || phase === 'longBreak' ? 'Start break' : 'Start focus'}
            >
              {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="translate-x-0.5" />}
            </button>
            <button
              className="nd-icon-btn !w-11 !h-11"
              style={{ background: '#f4effc' }}
              onClick={skipPhase}
              title={phase === 'shortBreak' || phase === 'longBreak' ? 'Skip break' : 'Discard this phase'}
              aria-label="Skip phase"
              disabled={phase === 'idle'}
            >
              <SkipForward size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              className="nd-icon-btn !w-11 !h-11"
              style={{ background: '#f4effc' }}
              onClick={laps.length || swElapsed ? swResetAll : undefined}
              title="Reset stopwatch"
              aria-label="Reset stopwatch"
              disabled={!laps.length && !swElapsed}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="nd-btn-cta !rounded-full !p-0 grid place-items-center"
              style={{ width: compact ? 58 : 68, height: compact ? 58 : 68 }}
              onClick={isRunningSw(sw) ? swPause : swStart}
              aria-label={isRunningSw(sw) ? 'Pause stopwatch' : 'Start stopwatch'}
            >
              {isRunningSw(sw) ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="translate-x-0.5" />}
            </button>
            <button
              className="nd-icon-btn !w-11 !h-11"
              style={{ background: '#f4effc' }}
              onClick={swLap}
              title="Record lap"
              aria-label="Record lap"
              disabled={!isRunningSw(sw)}
            >
              <Flag size={16} />
            </button>
          </>
        )}
      </div>

      {/* stopwatch: save + laps */}
      {mode === 'stopwatch' && !isRunningSw(sw) && swElapsed > 0 && (
        <button className="nd-btn-cta w-full justify-center !py-2 !text-[12.5px]" onClick={swSaveAndReset}>
          Save session ({formatStopwatch(swElapsed).slice(0, 5)}) &amp; reset
        </button>
      )}
      {mode === 'stopwatch' && laps.length > 0 && (
        <div className="nd-card !rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--nd-border-soft)' }}>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>Laps ({laps.length})</span>
            <button className="text-[11px] font-bold" style={{ color: 'var(--nd-brand-magenta)' }} onClick={() => setLaps([])}>
              Clear
            </button>
          </div>
          <div className="max-h-[132px] overflow-y-auto py-1 px-1">
            {[...laps].reverse().map((lap, revIdx) => {
              const i = laps.length - 1 - revIdx;
              return (
                <div key={i} className="nd-lap-row">
                  <span className="font-bold w-10" style={{ color: 'var(--nd-text-3)' }}>#{i + 1}</span>
                  <span className="tabular-nums font-semibold flex-1" style={{ color: 'var(--nd-ink)' }}>
                    +{formatStopwatch(lapDuration(laps, i))}
                  </span>
                  {extremes.fastest === i && <span className="nd-tag" style={{ background: '#dcf5e7', color: 'var(--nd-success)' }}>fastest</span>}
                  {extremes.slowest === i && laps.length > 1 && <span className="nd-tag" style={{ background: '#fde7ec', color: 'var(--nd-error)' }}>slowest</span>}
                  <span className="tabular-nums font-bold" style={{ color: 'var(--nd-ink-2)' }}>{formatStopwatch(lap)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* category + task linking */}
      <div>
        <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Session category">
          {FOCUS_CATEGORIES.map((c) => (
            <button
              key={c.name}
              role="radio"
              aria-checked={category === c.name}
              className="nd-chip-btn !py-1 !px-2.5 !text-[11px]"
              style={category === c.name ? { background: c.color, borderColor: c.color, color: '#fff' } : undefined}
              onClick={() => setCategory(c.name)}
            >
              {c.name}
            </button>
          ))}
        </div>
        {openTasks.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5">
            <Link2 size={13} className="flex-none" style={{ color: 'var(--nd-text-3)' }} />
            <select
              className="nd-input !py-1.5 !text-[12px]"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              aria-label="Link session to a task"
            >
              <option value="">Link to a task (optional)</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusTimerPanel;
