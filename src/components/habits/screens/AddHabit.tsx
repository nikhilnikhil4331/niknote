import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Minus, Plus, Wand2 } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { TopBar } from '@/components/habits/ui';
import { HABIT_CATEGORIES, HABIT_COLORS, HABIT_ICONS, habitUnit, type HabitType } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const QUICK: { name: string; icon: string; category: (typeof HABIT_CATEGORIES)[number]['id']; type: HabitType; target: number; color: string; note: string }[] = [
  { name: 'Drink Water', icon: '💧', category: 'health', type: 'water', target: 8, color: '#0ea5e9', note: 'Small sips, steady energy' },
  { name: 'Sleep 8h', icon: '🌙', category: 'health', type: 'sleep', target: 8, color: '#6366f1', note: 'Build a calmer bedtime' },
  { name: 'Workout 30m', icon: '💪', category: 'health', type: 'minutes', target: 30, color: '#f97316', note: 'Move your body today' },
  { name: 'Read 20m', icon: '📖', category: 'study', type: 'minutes', target: 20, color: '#8b5cf6', note: 'A few pages add up' },
  { name: 'Meditate 10m', icon: '🧘', category: 'mind', type: 'minutes', target: 10, color: '#22c55e', note: 'Make space to reset' },
  { name: 'Journal', icon: '✍️', category: 'mind', type: 'times', target: 1, color: '#ec4899', note: 'Capture one thought' },
  { name: 'Morning Stretch', icon: '🤸', category: 'health', type: 'minutes', target: 5, color: '#f59e0b', note: 'Start gently, feel ready' },
  { name: 'Daily Walk', icon: '🚶', category: 'health', type: 'minutes', target: 20, color: '#14b8a6', note: 'Get outside and recharge' },
  { name: 'Study Session', icon: '🎓', category: 'study', type: 'minutes', target: 45, color: '#6366f1', note: 'One focused study block' },
  { name: 'Plan My Day', icon: '🗓️', category: 'productivity', type: 'times', target: 1, color: '#8b5cf6', note: 'Choose your top priority' },
  { name: 'Practice a Language', icon: '🗣️', category: 'study', type: 'minutes', target: 15, color: '#ec4899', note: 'Practice a little every day' },
  { name: 'Screen-free Break', icon: '🌿', category: 'mind', type: 'minutes', target: 10, color: '#22c55e', note: 'Give your eyes a pause' },
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
  const [shake, setShake] = useState(0);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const toggleDay = (i: number) => {
    haptic('selection');
    setDays(d => (d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort((a, b) => a - b)));
  };
  const preset = (q: (typeof QUICK)[number]) => {
    haptic('success');
    setName(q.name); setIcon(q.icon); setCategory(q.category); setType(q.type); setTarget(q.target); setColor(q.color);
  };
  const applyType = (t: HabitType) => {
    setType(t);
    setTarget(t === 'water' ? 8 : t === 'sleep' ? 8 : t === 'minutes' ? 30 : 1);
  };
  const stepTarget = (d: number) => {
    haptic('light');
    const max = type === 'water' ? 12 : type === 'sleep' ? 12 : type === 'minutes' ? 240 : 20;
    const min = type === 'sleep' ? 1 : 1;
    setTarget(t => Math.min(max, Math.max(min, t + d * (type === 'sleep' ? 0.5 : type === 'minutes' ? 5 : 1))));
  };

  const create = () => {
    if (!name.trim() || !days.length) {
      haptic('warning');
      setShake(s => s + 1);
      return;
    }
    const habit = addHabit({
      name: name.trim(), category, icon, color, type,
      target, days, reminderOn: false, reminders: ['08:00'],
    });
    go({ name: 'detail', id: habit.id });
  };

  return (
    <div className="pb-36">
      <TopBar title="Add New Habit" onBack={() => go({ name: 'tab', id: 'habits' })}
        icon={<span className="nnh-gradient-text">✦</span>} />
      <div className="px-4 space-y-5">
        {/* one-tap habit templates */}
        <section aria-label="Habit templates" className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] nnh-gradient-text">A good place to start</p>
              <h2 className="text-[15px] font-extrabold mt-0.5">Choose a habit template</h2>
            </div>
            <span className="text-[10px] font-semibold pb-0.5" style={{ color: 'var(--nnh-sub)' }}>Tap to customize</span>
          </div>
          <motion.div layout className="grid grid-cols-2 gap-2">
            {(showAllTemplates ? QUICK : QUICK.slice(0, 4)).map((q, i) => (
              <motion.button key={q.name} layout whileTap={reduced ? undefined : { scale: 0.96 }}
                initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : i * 0.035, duration: 0.22 }}
                type="button" onClick={() => preset(q)} aria-label={`Use ${q.name} template`} aria-pressed={name === q.name}
                className="nnh-card text-left p-2.5 flex items-center gap-2 min-h-[66px] border transition-shadow"
                style={name === q.name
                  ? { borderColor: q.color, boxShadow: `0 8px 22px -12px ${q.color}99, var(--nnh-shadow)` }
                  : { borderColor: 'transparent' }}>
                <motion.span animate={name === q.name && !reduced ? { rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="w-10 h-10 rounded-2xl shrink-0 grid place-items-center text-[20px]"
                  style={{ background: `linear-gradient(145deg, ${q.color}24, ${q.color}10)`, boxShadow: `inset 0 0 0 1px ${q.color}22` }}>
                  {q.icon}
                </motion.span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-extrabold leading-tight truncate">{q.name}</span>
                  <span className="block text-[9px] font-medium leading-tight mt-1 truncate" style={{ color: 'var(--nnh-sub)' }}>{q.note}</span>
                </span>
                {name === q.name && <Check size={13} style={{ color: q.color }} aria-hidden="true" />}
              </motion.button>
            ))}
          </motion.div>
          <button type="button" onClick={() => setShowAllTemplates(v => !v)} aria-expanded={showAllTemplates}
            className="w-full py-2 text-[11px] font-bold rounded-xl transition-colors"
            style={{ color: 'var(--nnh-purple)', background: 'var(--nnh-card-soft)' }}>
            {showAllTemplates ? 'Show fewer templates' : `Browse ${QUICK.length - 4} more ideas`}
          </button>
        </section>

        {/* name */}
        <AnimatePresence>
          <motion.div key={shake} initial={false} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
            <label className="flex items-center gap-2.5 h-13 rounded-2xl nnh-chip px-4" style={{ height: 52, borderColor: name ? color : undefined }}>
              <Wand2 size={17} style={{ color: name ? color : 'var(--nnh-sub)' }} />
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Habit name…" aria-label="Habit name"
                className="flex-1 bg-transparent outline-none text-[14px] font-medium" style={{ color: 'var(--nnh-ink)' }} />
            </label>
            {!name.trim() && shake > 0 && <p className="text-[11px] font-semibold text-rose-500 mt-1 ml-1">Give your habit a name ✨</p>}
          </motion.div>
        </AnimatePresence>

        {/* category */}
        <section>
          <h3 className="text-[13px] font-bold mb-2">Category</h3>
          <div className="grid grid-cols-3 gap-2">
            {HABIT_CATEGORIES.map(c => {
              const on = c.id === category;
              return (
                <button key={c.id} type="button" onClick={() => { haptic('selection'); setCategory(c.id); }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold border-2 transition-all ${on ? 'text-white' : 'nnh-chip'}`}
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
          <h3 className="text-[13px] font-bold mb-2">Choose an icon</h3>
          <div className="grid grid-cols-8 gap-1.5">
            {HABIT_ICONS.map(ic => {
              const on = ic === icon;
              return (
                <motion.button key={ic} whileTap={reduced ? undefined : { scale: 0.82 }} type="button" onClick={() => { haptic('selection'); setIcon(ic); }}
                  className="aspect-square rounded-xl grid place-items-center text-[18px] border-2"
                  style={on ? { background: `${color}22`, borderColor: color } : { background: 'var(--nnh-card-soft)', borderColor: 'transparent' }}
                  aria-label={`Icon ${ic}`} aria-pressed={on}>
                  {ic}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* color */}
        <section>
          <h3 className="text-[13px] font-bold mb-2">Choose a color</h3>
          <div className="flex justify-between">
            {HABIT_COLORS.map(c => {
              const on = c === color;
              return (
                <motion.button key={c} whileTap={reduced ? undefined : { scale: 0.85 }} type="button" onClick={() => { haptic('selection'); setColor(c); }}
                  className="rounded-full grid place-items-center" style={{ width: on ? 34 : 28, height: on ? 34 : 28, background: c, boxShadow: on ? `0 0 0 3px var(--nnh-card), 0 0 0 5.5px ${c}` : undefined }}
                  aria-label={`Color ${c}`} aria-pressed={on}>
                  {on && <Check size={15} className="text-white" strokeWidth={3.2} />}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* schedule + goal */}
        <section className="nnh-card p-4 space-y-4">
          <div>
            <h3 className="text-[13px] font-bold mb-2">Repeat</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((l, i) => {
                const on = days.includes(i);
                return (
                  <button key={i} type="button" aria-label={DAY_NAMES[i]} aria-pressed={on} onClick={() => toggleDay(i)}
                    className="aspect-square rounded-full grid place-items-center text-[11px] font-extrabold border-2"
                    style={on ? { background: color, borderColor: color, color: '#fff' } : { borderColor: 'var(--nnh-line)', color: 'var(--nnh-sub)' }}>
                    {l}
                  </button>
                );
              })}
            </div>
            {!days.length && shake > 0 && <p className="text-[11px] font-semibold text-rose-500 mt-2">Pick at least one day ✨</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-bold">Set goal</h3>
              <div className="flex gap-1">
                {(['times', 'water', 'sleep', 'minutes'] as HabitType[]).map(t => (
                  <button key={t} type="button" onClick={() => applyType(t)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize ${type === t ? 'text-white' : ''}`}
                    style={type === t ? { background: color } : { background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between nnh-chip px-3 py-2">
              <span className="text-[12px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Every day</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => stepTarget(-1)} aria-label="Decrease goal" className="w-8 h-8 rounded-full grid place-items-center" style={{ background: 'var(--nnh-card-soft)' }}><Minus size={14} /></button>
                <span className="text-[17px] font-extrabold w-14 text-center tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {target} <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{habitUnit(type)}</span>
                </span>
                <button type="button" onClick={() => stepTarget(1)} aria-label="Increase goal" className="w-8 h-8 rounded-full grid place-items-center nnh-gradient-btn text-white"><Plus size={14} /></button>
              </div>
            </div>
          </div>
        </section>

        <motion.button whileTap={reduced ? undefined : { scale: 0.96 }} whileHover={reduced ? undefined : { scale: 1.02 }} type="button" onClick={create}
          className="w-full h-13 rounded-2xl text-white text-[15px] font-extrabold nnh-gradient-btn relative overflow-hidden" style={{ height: 52 }}>
          <span className="nnh-shimmer absolute inset-0" aria-hidden="true" />
          <span className="relative">Create Habit ✨</span>
        </motion.button>
      </div>
    </div>
  );
}
