import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Archive, Bell, Check, Clock, Minus, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { BigWaterGlass } from '@/components/habits/BigWaterGlass';
import { CountUp, Ring, Sheet, TopBar, WeekBars } from '@/components/habits/ui';
import {
  GLASS_ML, HABIT_CATEGORIES, HABIT_COLORS, HABIT_ICONS, fmtHabitValue, habitStreak,
  toDay, waterProgress,
} from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';
import { readableInk } from '@/lib/readableInk';

const QUICK_GLASSES = [
  { label: '100ml', glasses: 100 / GLASS_ML, icon: '🥃' },
  { label: '250ml', glasses: 250 / GLASS_ML, icon: '🥛' },
  { label: '500ml', glasses: 500 / GLASS_ML, icon: '🥤' },
  { label: '1L', glasses: 1000 / GLASS_ML, icon: '🫙' },
];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function HabitDetailScreen({ id, go }: { id: string; go: (s: { name: string; id?: string }) => void }) {
  const { state, today, activeHabits, updateHabit, deleteHabit, bump, setEntry, toggleHabitDone } = useRoutine();
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [newTime, setNewTime] = useState(false);
  const [editing, setEditing] = useState(false);
  const h = state.habits.find(x => x.id === id);
  const now = new Date();

  const history = useMemo(() => {
    if (!h) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i));
      const day = toDay(d);
      const v = state.entries[`${h.id}|${day}`]?.v ?? 0;
      return {
        day, v,
        date: d,
        done: v >= h.target,
        partial: v > 0 && v < h.target,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entries, h?.id, h?.target]);

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const day = toDay(d);
      const v = state.entries[`${id}|${day}`]?.v ?? 0;
      return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), value: h ? Math.min(100, Math.round((v / h.target) * 100)) : 0, today: i === 6 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entries, id, h?.target]);

  if (!h) {
    return (
      <div className="pb-2">
        <TopBar title="Habit not found" onBack={() => go({ name: 'tab', id: 'habits' })} icon={<span>🔍</span>} />
        <div className="px-4">
          <div className="nnh-card p-8 text-center">
            <p className="mb-2 text-4xl">🌵</p>
            <p className="text-[15px] font-bold">This habit is gone</p>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--nnh-sub)' }}>It may have been deleted on another device.</p>
            <button type="button" onClick={() => go({ name: 'tab', id: 'habits' })}
              className="mt-3 rounded-full px-4 py-2 text-[12px] font-bold nnh-chip" style={{ color: 'var(--nnh-violet)' }}>
              Back to habits
            </button>
          </div>
        </div>
      </div>
    );
  }

  const v = state.entries[`${id}|${today}`]?.v ?? 0;
  const pct = Math.min(1, v / h.target);
  const streak = habitStreak(state.entries, h, now);
  const cat = HABIT_CATEGORIES.find(c => c.id === h.category);
  const water = h.type === 'water';
  const waterStats = waterProgress(v, h.target);

  const addReminderTime = (t: string) => {
    if (!t) return;
    updateHabit(h.id, { reminders: [...new Set([...h.reminders, t])].sort() });
    setNewTime(false);
    haptic('success');
  };

  return (
    <div className="pb-2">
      <TopBar title={h.name} icon={<span>{h.icon}</span>}
        sub={`${cat?.icon} ${cat?.label} · ${streak > 0 ? `🔥 ${streak} day streak` : 'build your streak'}`}
        onBack={() => go({ name: 'tab', id: 'habits' })}
        right={
          <div className="relative">
            <button type="button" onClick={() => { haptic('selection'); setMenu(m => !m); }} aria-label="Habit options"
              className="grid h-10 w-10 place-items-center rounded-full nnh-card">
              <MoreHorizontal size={18} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-0 top-11 z-40 w-48 rounded-2xl p-1.5"
                  style={{ background: 'var(--nnh-card)', boxShadow: 'var(--nnh-shadow-lg)', border: '1px solid var(--nnh-line)' }}>
                  <button type="button" onClick={() => { haptic('selection'); setEditing(true); setMenu(false); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold">
                    <Pencil size={15} /> Edit habit
                  </button>
                  <button type="button" onClick={() => { haptic('light'); updateHabit(h.id, { archived: !h.archived }); setMenu(false); go({ name: 'tab', id: 'habits' }); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold">
                    <Archive size={15} /> {h.archived ? 'Restore habit' : 'Archive habit'}
                  </button>
                  {confirmDel ? (
                    <button type="button" onClick={() => { deleteHabit(h.id); go({ name: 'tab', id: 'habits' }); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold text-white" style={{ background: '#A62B36' }}>
                      <Trash2 size={15} /> Tap to confirm delete
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDel(true)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-accent-rose">
                      <Trash2 size={15} /> Delete habit
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        } />

      <div className="space-y-4 px-4">
        {water ? (
          <section className="nnh-card p-4 pt-3">
            <div className="mb-1 text-center">
              <p className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Stay hydrated, stay sharp</p>
              <p className="nnh-display mt-0.5 text-[20px] font-extrabold">
                <CountUp value={v} decimals={v % 1 ? 1 : 0} />
                <span className="text-[13px] font-bold" style={{ color: 'var(--nnh-sub)' }}> / {h.target} glasses</span>
              </p>
            </div>
            <BigWaterGlass glasses={v} goal={h.target} onAdd={() => bump(h, 1)} onRemove={() => bump(h, -1)} />
            <div className="mt-1 text-center">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                {(waterStats.drunkMl / 1000).toFixed(2)} L / {(waterStats.goalMl / 1000).toFixed(2)} L ·{' '}
                {waterStats.done ? 'goal reached' : `${waterStats.left} glass${waterStats.left === 1 ? '' : 'es'} left`}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full nnh-track">
              <motion.div initial={false} animate={{ width: `${pct * 100}%` }} className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #A688C9, #5C3A6E)' }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 16 }} />
            </div>

            <div className="mt-4">
              <p className="nnh-label mb-2">Quick add</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_GLASSES.map(q => (
                  <motion.button key={q.label} whileTap={reduced ? undefined : { scale: 0.9 }} type="button"
                    onClick={() => bump(h, q.glasses)} aria-label={`Add ${q.label} of water`}
                    className="flex flex-col items-center gap-1 rounded-2xl border py-2.5"
                    style={{ background: 'var(--nnh-card-soft)', borderColor: 'var(--nnh-line)' }}>
                    <span className="text-xl" aria-hidden="true">{q.icon}</span>
                    <span className="text-[10px] font-bold">{q.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="nnh-card p-5">
            <div className="flex flex-col items-center">
              <Ring size={176} stroke={13} pct={pct} from={h.color} to={h.color === '#C4762F' ? '#D9822F' : '#A34054'}>
                <div className="text-center">
                  <p className="nnh-display text-[38px] font-extrabold leading-none">
                    <CountUp value={v} decimals={h.type === 'sleep' ? 1 : 0} />
                  </p>
                  <p className="mt-1 text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
                    / {fmtHabitValue(h.target, h.type)} · {Math.round(pct * 100)}%
                  </p>
                </div>
              </Ring>
              <div className="mt-5 flex items-center gap-3">
                <motion.button whileTap={reduced ? undefined : { scale: 0.85 }} type="button"
                  onClick={() => bump(h, -(h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1))}
                  disabled={v <= 0} aria-label="Decrease"
                  className="grid h-12 w-12 place-items-center rounded-full disabled:opacity-40" style={{ background: 'var(--nnh-card-soft)' }}>
                  <Minus size={20} />
                </motion.button>
                <motion.button whileTap={reduced ? undefined : { scale: 0.94 }} type="button"
                  onClick={() => bump(h, h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1)}
                  className="flex h-12 items-center gap-1.5 rounded-full px-6 text-[14px] font-extrabold text-white"
                  style={{ background: `linear-gradient(92deg, ${h.color}, #A34054)`, boxShadow: `0 12px 24px -12px ${h.color}` }}>
                  <Plus size={17} strokeWidth={2.8} />
                  {h.type === 'sleep' ? '30 min sleep' : h.type === 'minutes' ? '5 min more' : '1 more'}
                </motion.button>
                <motion.button whileTap={reduced ? undefined : { scale: 0.85 }} type="button"
                  onClick={() => { haptic('light'); setEntry(h, today, 0); }} aria-label="Reset to zero"
                  className="grid h-12 w-12 place-items-center rounded-full text-[11px] font-bold"
                  style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                  Reset
                </motion.button>
              </div>
              <button type="button" onClick={() => toggleHabitDone(h)}
                className="mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-extrabold"
                style={{ background: pct >= 1 ? `color-mix(in srgb, ${h.color} 18%, transparent)` : 'var(--nnh-card-soft)', color: pct >= 1 ? h.color : 'var(--nnh-violet)' }}>
                <Check size={13} strokeWidth={3} /> {pct >= 1 ? 'Completed — tap to reopen' : 'Mark complete'}
              </button>
              <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                {pct >= 1 ? 'Goal reached — amazing! 🎉' : `${fmtHabitValue(Math.max(0, h.target - v), h.type)} to go`}
              </p>
            </div>
          </section>
        )}

        {/* trailing history */}
        <section className="nnh-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">Last 14 days</p>
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--nnh-orange)' }}>
              <Sparkles size={12} /> {history.filter(d => d.done).length} completed
            </span>
          </div>
          <div className="flex justify-between gap-1" role="img"
            aria-label={`History: ${history.filter(d => d.done).length} of the last 14 days complete`}>
            {history.map(d => (
              <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.label}: ${fmtHabitValue(d.v, h.type)}`}>
                <span className="flex h-6 w-full items-center justify-center rounded-md"
                  style={{
                    background: d.done ? h.color : d.partial ? `color-mix(in srgb, ${h.color} 32%, transparent)` : 'var(--nnh-line)',
                    opacity: d.done ? 1 : 0.9,
                  }}>
                  {d.done && <Check size={11} className="text-white" strokeWidth={3.4} />}
                </span>
                <span className="text-[8px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{d.date.getDate()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* reminders */}
        <section className="nnh-card p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: `${h.color}1f`, color: h.color }}>
              <Bell size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold">Reminders</p>
              <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                {h.reminderOn ? (h.reminders.length ? h.reminders.map(fmtTime).join(' · ') : 'On — no time set') : 'Off'}
              </p>
            </div>
            <button type="button" role="switch" aria-checked={h.reminderOn} aria-label={`Reminders for ${h.name}`}
              onClick={() => { haptic('selection'); updateHabit(h.id, { reminderOn: !h.reminderOn }); }}
              className="flex rounded-full p-0.5 transition-colors"
              style={{ width: 46, height: 26, background: h.reminderOn ? h.color : 'var(--nnh-line)', justifyContent: h.reminderOn ? 'flex-end' : 'flex-start' }}>
              <motion.span layout className="block rounded-full bg-surface shadow" style={{ width: 22, height: 22 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }} />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {h.reminderOn && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 flex flex-wrap gap-2">
                  {h.reminders.map(t => (
                    <span key={t} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold nnh-chip">
                      <Clock size={11} style={{ color: h.color }} /> {fmtTime(t)}
                      <button type="button" onClick={() => { haptic('light'); updateHabit(h.id, { reminders: h.reminders.filter(x => x !== t) }); }}
                        aria-label={`Remove ${t} reminder`}>
                        <X size={11} style={{ color: 'var(--nnh-sub)' }} />
                      </button>
                    </span>
                  ))}
                  {newTime ? (
                    <label className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold nnh-chip">
                      <input type="time" defaultValue="09:00" onChange={e => addReminderTime(e.target.value)} autoFocus
                        aria-label="New reminder time"
                        className="bg-transparent text-[11px] font-bold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]" style={{ color: 'var(--nnh-ink)' }} />
                    </label>
                  ) : (
                    <button type="button" onClick={() => { haptic('light'); setNewTime(true); }}
                      className="rounded-full border border-dashed px-3 py-1.5 text-[11px] font-bold"
                      style={{ color: h.color, borderColor: h.color, background: `${h.color}11` }}>
                      + Add time
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* weekly progress */}
        <section className="nnh-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">Weekly Progress</p>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: h.color }}>
              {Math.round(pct * 100)}%
            </span>
          </div>
          <WeekBars data={week} colorFrom={h.color} colorTo={h.color} max={100} height={110} suffix="%" reduced={reduced} />
        </section>

        <button type="button" onClick={() => { haptic('selection'); setEditing(true); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-[12px] font-bold nnh-chip"
          style={{ color: 'var(--nnh-violet)' }}>
          <Pencil size={13} /> Edit name, icon, colour or goal
        </button>

        <p className="pt-1 text-center text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>
          {water ? '"Sip by sip, the glass fills up."' : streak > 0 ? `"${streak} days in a row — keep the chain alive!"` : '"One small step today counts."'}
        </p>
      </div>

      <EditHabitSheet
        open={editing}
        habit={h}
        onClose={() => setEditing(false)}
        onSave={patch => { updateHabit(h.id, patch); setEditing(false); haptic('success'); }}
        siblings={activeHabits.length}
      />
    </div>
  );
}

function EditHabitSheet({ open, habit, onClose, onSave, siblings }: {
  open: boolean;
  habit: { name: string; icon: string; color: string; target: number; days: number[]; type: string };
  onClose: () => void;
  onSave: (patch: { name: string; icon: string; color: string; target: number; days: number[] }) => void;
  siblings: number;
}) {
  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState(habit.icon);
  const [color, setColor] = useState(habit.color);
  const [target, setTarget] = useState(habit.target);
  const [days, setDays] = useState<number[]>(habit.days);
  const step = habit.type === 'sleep' ? 0.5 : habit.type === 'minutes' ? 5 : 1;

  // Re-sync the draft whenever the sheet is opened so edits never show stale values.
  useEffect(() => {
    if (!open) return;
    setName(habit.name);
    setIcon(habit.icon);
    setColor(habit.color);
    setTarget(habit.target);
    setDays(habit.days);
  }, [open, habit.name, habit.icon, habit.color, habit.target, habit.days]);

  return (
    <Sheet open={open} onClose={onClose} title="Edit habit">
      <div className="space-y-4">
        <label className="flex items-center gap-2 rounded-2xl px-3 py-2.5 nnh-chip">
          <input value={name} onChange={e => setName(e.target.value)} aria-label="Edit habit name"
            className="flex-1 bg-transparent text-[14px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]" style={{ color: 'var(--nnh-ink)' }} />
        </label>
        <div>
          <p className="nnh-label mb-2">Icon</p>
          <div className="grid grid-cols-8 gap-1.5">
            {HABIT_ICONS.slice(0, 24).map(ic => (
              <button key={ic} type="button" onClick={() => { haptic('selection'); setIcon(ic); }} aria-label={`Icon ${ic}`}
                aria-pressed={icon === ic}
                className="grid aspect-square place-items-center rounded-xl border-2 text-[17px]"
                style={icon === ic
                  ? { background: `color-mix(in srgb, ${color} 18%, transparent)`, borderColor: color }
                  : { background: 'var(--nnh-card-soft)', borderColor: 'transparent' }}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="nnh-label mb-2">Colour</p>
          <div className="flex justify-between">
            {HABIT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => { haptic('selection'); setColor(c); }} aria-label={`Color ${c}`}
                aria-pressed={color === c} className="grid h-7 w-7 place-items-center rounded-full"
                style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--nnh-card), 0 0 0 5px ${c}` : undefined }}>
                {color === c && <Check size={13} className="text-white" strokeWidth={3.2} />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="nnh-label">Daily target</p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Decrease target" onClick={() => setTarget(t => Math.max(step, Math.round((t - step) * 10) / 10))}
                className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}><Minus size={13} /></button>
              <span className="nnh-display w-10 text-center text-[15px] font-extrabold tabular-nums">{target}</span>
              <button type="button" aria-label="Increase target" onClick={() => setTarget(t => Math.min(240, Math.round((t + step) * 10) / 10))}
                className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: color }}><Plus size={13} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_LETTERS.map((l, i) => {
              const on = days.includes(i);
              return (
                <button key={i} type="button" aria-label={DAY_NAMES[i]} aria-pressed={on}
                  onClick={() => { haptic('selection'); setDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort((a, b) => a - b)); }}
                  className="grid aspect-square place-items-center rounded-full border-2 text-[11px] font-extrabold"
                  style={on ? { background: color, borderColor: color, color: readableInk(color) } : { borderColor: 'var(--nnh-line)', color: 'var(--nnh-sub)' }}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" disabled={!name.trim() || !days.length}
          onClick={() => onSave({ name: name.trim(), icon, color, target, days })}
          className="h-12 w-full rounded-2xl text-[14px] font-extrabold text-white nnh-gradient-btn disabled:opacity-40">
          Save changes
        </button>
        <p className="text-center text-[10px] font-medium" style={{ color: 'var(--nnh-sub)' }}>
          {siblings} active habit{siblings === 1 ? '' : 's'} in this routine
        </p>
      </div>
    </Sheet>
  );
}

function fmtTime(t: string) {
  const [hH, m] = t.split(':').map(Number);
  const ap = hH >= 12 ? 'PM' : 'AM';
  return `${hH % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}
