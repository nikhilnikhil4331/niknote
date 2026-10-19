import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, Check, Clock, Minus, Plus, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { TopBar } from '@/components/habits/ui';
import { HABIT_CATEGORIES, HABIT_COLORS, HABIT_ICONS, habitUnit, type HabitType } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TYPE_LABEL: Record<HabitType, string> = { times: 'Times', water: 'Glasses', sleep: 'Hours', minutes: 'Minutes' };
const QUICK: { name: string; icon: string; category: (typeof HABIT_CATEGORIES)[number]['id']; type: HabitType; target: number; color: string }[] = [
  { name: 'Drink Water', icon: '💧', category: 'health', type: 'water', target: 8, color: '#0ea5e9' },
  { name: 'Sleep 8h', icon: '🌙', category: 'health', type: 'sleep', target: 8, color: '#8b5cf6' },
  { name: 'Workout 30m', icon: '💪', category: 'health', type: 'minutes', target: 30, color: '#22c55e' },
  { name: 'Read 20m', icon: '📖', category: 'study', type: 'minutes', target: 20, color: '#6366f1' },
  { name: 'Meditate 10m', icon: '🧘', category: 'mind', type: 'minutes', target: 10, color: '#ec4899' },
  { name: 'Journal', icon: '✍️', category: 'mind', type: 'times', target: 1, color: '#f59e0b' },
];

export function AddHabitScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { addHabit } = useRoutine();
  const reduced = useReducedMotion();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof HABIT_CATEGORIES)[number]['id']>('health');
  const [icon, setIcon] = useState('💧');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [target, setTarget] = useState(1);
  const [type, setType] = useState<HabitType>('times');
  const [reminderOn, setReminderOn] = useState(true);
  const [reminder, setReminder] = useState('08:00');
  const [shake, setShake] = useState(0);
  const [attempted, setAttempted] = useState(false);

  const nameError = attempted && !name.trim();
  const daysError = attempted && !days.length;
  const canSubmit = Boolean(name.trim()) && days.length > 0;

  const preset = (q: (typeof QUICK)[number]) => {
    haptic('success');
    setName(q.name); setIcon(q.icon); setCategory(q.category); setType(q.type); setTarget(q.target); setColor(q.color);
  };
  const toggleDay = (i: number) => {
    haptic('selection');
    setDays(d => (d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort((a, b) => a - b)));
  };
  const applyType = (t: HabitType) => {
    haptic('selection');
    setType(t);
    setTarget(t === 'water' ? 8 : t === 'sleep' ? 8 : t === 'minutes' ? 30 : 1);
  };
  const stepTarget = (d: number) => {
    haptic('light');
    const max = type === 'water' ? 16 : type === 'sleep' ? 14 : type === 'minutes' ? 240 : 20;
    const step = type === 'sleep' ? 0.5 : type === 'minutes' ? 5 : 1;
    setTarget(t => Math.min(max, Math.max(1, Math.round((t + d * step) * 10) / 10)));
  };

  const create = () => {
    setAttempted(true);
    if (!name.trim() || !days.length) {
      haptic('warning');
      setShake(s => s + 1);
      return;
    }
    const habit = addHabit({
      name: name.trim(), category, icon, color, type, target, days,
      reminderOn, reminders: reminderOn ? [reminder] : [],
    });
    haptic('success');
    toast.success(`${icon} ${habit.name} created`);
    go({ name: 'detail', id: habit.id });
  };

  return (
    <div className="pb-2">
      <TopBar title="Add New Habit" onBack={() => go({ name: 'tab', id: 'habits' })}
        icon={<Sparkles size={15} className="nnh-gradient-text" />} sub="Design a habit you can keep" />
      <div className="space-y-5 px-4 pt-1">
        {/* live preview */}
        <motion.div layout initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="nnh-card relative overflow-hidden p-4">
          <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full"
            style={{ background: color, opacity: 0.12 }} aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl"
              style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold">{name.trim() || 'Your new habit'}</p>
              <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                {HABIT_CATEGORIES.find(c => c.id === category)?.label} · {days.length === 7 ? 'Every day' : days.length ? `${days.length} days a week` : 'No days yet'} · {target} {habitUnit(type)}
              </p>
            </div>
            <div className="text-right">
              <p className="nnh-display text-[18px] font-extrabold" style={{ color }}>{target}</p>
              <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{habitUnit(type)} / day</p>
            </div>
          </div>
        </motion.div>

        {/* quick presets */}
        <section>
          <h3 className="nnh-label mb-2">Start from a template</h3>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 nnh-no-scrollbar">
            {QUICK.map(q => (
              <button key={q.name} type="button" onClick={() => preset(q)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold nnh-chip"
                style={name === q.name ? { borderColor: color, color } : { color: 'var(--nnh-ink)' }}>
                <span>{q.icon}</span>{q.name}
              </button>
            ))}
          </div>
        </section>

        {/* name */}
        <motion.div key={shake} initial={false} animate={shake ? { x: [0, -9, 9, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
          <label className="flex h-13 items-center gap-2.5 rounded-2xl px-4 nnh-chip"
            style={{ height: 52, borderColor: nameError ? '#f43f5e' : name ? color : undefined }}>
            <Wand2 size={17} style={{ color: name ? color : 'var(--nnh-sub)' }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Habit name…" aria-label="Habit name"
              maxLength={40}
              className="flex-1 bg-transparent text-[14px] font-medium outline-none"
              style={{ color: 'var(--nnh-ink)' }} />
            <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--nnh-sub)' }}>{name.length}/40</span>
          </label>
          {nameError && <p className="ml-1 mt-1 text-[11px] font-semibold text-rose-500">Give your habit a name ✨</p>}
        </motion.div>

        {/* category */}
        <section>
          <h3 className="mb-2 text-[13px] font-extrabold">Category</h3>
          <div className="grid grid-cols-3 gap-2">
            {HABIT_CATEGORIES.map(c => {
              const on = c.id === category;
              return (
                <button key={c.id} type="button" onClick={() => { haptic('selection'); setCategory(c.id); }}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-[12px] font-bold transition-all ${on ? 'text-white' : 'nnh-chip'}`}
                  style={on ? { background: color, borderColor: color, boxShadow: `0 8px 18px -8px ${color}` } : { color: 'var(--nnh-ink)' }}>
                  <span>{c.icon}</span><span className="truncate">{c.label}</span>
                  {on && <Check size={12} className="ml-auto" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* icon */}
        <section>
          <h3 className="mb-2 text-[13px] font-extrabold">Choose an icon</h3>
          <div className="grid grid-cols-8 gap-1.5">
            {HABIT_ICONS.map(ic => {
              const on = ic === icon;
              return (
                <motion.button key={ic} whileTap={reduced ? undefined : { scale: 0.82 }} type="button"
                  onClick={() => { haptic('selection'); setIcon(ic); }}
                  className="grid aspect-square place-items-center rounded-xl border-2 text-[18px]"
                  style={on ? { background: `color-mix(in srgb, ${color} 18%, transparent)`, borderColor: color } : { background: 'var(--nnh-card-soft)', borderColor: 'transparent' }}
                  aria-label={`Icon ${ic}`} aria-pressed={on}>
                  {ic}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* color */}
        <section>
          <h3 className="mb-2 text-[13px] font-extrabold">Choose a color</h3>
          <div className="flex justify-between">
            {HABIT_COLORS.map(c => {
              const on = c === color;
              return (
                <motion.button key={c} whileTap={reduced ? undefined : { scale: 0.85 }} type="button"
                  onClick={() => { haptic('selection'); setColor(c); }}
                  className="grid place-items-center rounded-full"
                  style={{ width: on ? 34 : 28, height: on ? 34 : 28, background: c, boxShadow: on ? `0 0 0 3px var(--nnh-card), 0 0 0 5.5px ${c}` : undefined }}
                  aria-label={`Color ${c}`} aria-pressed={on}>
                  {on && <Check size={15} className="text-white" strokeWidth={3.2} />}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* schedule */}
        <section className="nnh-card space-y-4 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-extrabold">Repeat</h3>
              <div className="flex gap-1">
                {[{ label: 'Every day', value: [0, 1, 2, 3, 4, 5, 6] }, { label: 'Weekdays', value: [1, 2, 3, 4, 5] }, { label: 'Weekend', value: [0, 6] }].map(p => (
                  <button key={p.label} type="button" onClick={() => { haptic('selection'); setDays(p.value); }}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold"
                    style={days.join() === p.value.join() ? { background: 'var(--nnh-lavender)', color: 'var(--nnh-violet)' } : { background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((l, i) => {
                const on = days.includes(i);
                return (
                  <button key={i} type="button" aria-label={DAY_NAMES[i]} aria-pressed={on} onClick={() => toggleDay(i)}
                    className="grid aspect-square place-items-center rounded-full border-2 text-[11px] font-extrabold"
                    style={on ? { background: color, borderColor: color, color: '#fff' } : { borderColor: 'var(--nnh-line)', color: 'var(--nnh-sub)' }}>
                    {l}
                  </button>
                );
              })}
            </div>
            {daysError && <p className="mt-2 text-[11px] font-semibold text-rose-500">Pick at least one day ✨</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-extrabold">Daily goal</h3>
              <div className="flex gap-1">
                {(['times', 'water', 'sleep', 'minutes'] as HabitType[]).map(t => (
                  <button key={t} type="button" onClick={() => applyType(t)} aria-pressed={type === t}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold"
                    style={type === t ? { background: color, color: '#fff' } : { background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl px-3 py-2 nnh-chip">
              <span className="text-[12px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Target each day</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => stepTarget(-1)} aria-label="Decrease goal"
                  className="grid h-8 w-8 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}><Minus size={14} /></button>
                <span className="nnh-display w-16 text-center text-[17px] font-extrabold tabular-nums">
                  {target} <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{habitUnit(type)}</span>
                </span>
                <button type="button" onClick={() => stepTarget(1)} aria-label="Increase goal"
                  className="grid h-8 w-8 place-items-center rounded-full text-white nnh-gradient-btn"><Plus size={14} /></button>
              </div>
            </div>
          </div>

          {/* reminder */}
          <div className="flex items-center gap-3 border-t pt-3 nnh-hairline">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--nnh-card-soft)', color }}><Bell size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold">Remind me</p>
              <p className="text-[10px] font-medium" style={{ color: 'var(--nnh-sub)' }}>Daily nudge at your chosen time</p>
            </div>
            <AnimatePresence initial={false}>
              {reminderOn && (
                <motion.label initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
                  className="flex items-center gap-1 overflow-hidden text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
                  <Clock size={12} />
                  <input type="time" value={reminder} onChange={e => setReminder(e.target.value)} aria-label="Reminder time"
                    className="w-[68px] bg-transparent text-[11px] font-bold outline-none" style={{ color: 'var(--nnh-ink)' }} />
                </motion.label>
              )}
            </AnimatePresence>
            <button type="button" role="switch" aria-checked={reminderOn} aria-label="Enable reminder"
              onClick={() => { haptic('selection'); setReminderOn(v => !v); }}
              className="flex w-[46px] items-center rounded-full p-0.5 transition-colors"
              style={{ height: 26, background: reminderOn ? color : 'var(--nnh-line)', justifyContent: reminderOn ? 'flex-end' : 'flex-start' }}>
              <motion.span layout className="block rounded-full bg-white shadow" style={{ width: 22, height: 22 }} />
            </button>
          </div>
        </section>

        <motion.button whileTap={reduced ? undefined : { scale: 0.97 }} type="button" onClick={create}
          className="relative h-[52px] w-full overflow-hidden rounded-2xl text-[15px] font-extrabold text-white nnh-gradient-btn"
          style={{ opacity: canSubmit ? 1 : 0.92 }}>
          <span className="nnh-shimmer absolute inset-0" aria-hidden="true" />
          <span className="relative">Create Habit ✨</span>
        </motion.button>
        <p className="pb-2 text-center text-[10px] font-medium" style={{ color: 'var(--nnh-sub)' }}>
          You can edit or archive this habit any time.
        </p>
      </div>
    </div>
  );
}
