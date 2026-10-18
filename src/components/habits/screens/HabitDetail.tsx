import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Archive, Bell, Clock, Minus, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { BigWaterGlass } from '@/components/habits/BigWaterGlass';
import { CountUp, Ring, TopBar, WeekBars } from '@/components/habits/ui';
import { GLASS_ML, HABIT_CATEGORIES, fmtHabitValue, habitStreak, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

const QUICK_GLADES = [
  { label: '100ml', glasses: 100 / GLASS_ML, icon: '🥃' },
  { label: '250ml', glasses: 250 / GLASS_ML, icon: '🥛' },
  { label: '500ml', glasses: 500 / GLASS_ML, icon: '🥤' },
  { label: '1L', glasses: 1000 / GLASS_ML, icon: '🫙' },
];

export function HabitDetailScreen({ id, go }: { id: string; go: (s: { name: string; id?: string }) => void }) {
  const { state, today, updateHabit, deleteHabit, bump, setEntry } = useRoutine();
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [newTime, setNewTime] = useState(false);
  const h = state.habits.find(x => x.id === id);

  const week = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const day = toDay(d);
      const v = state.entries[`${id}|${day}`]?.v ?? 0;
      return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), value: h ? Math.min(1, v / h.target) : 0, today: i === 6 };
    });
  }, [state.entries, id, h]);

  if (!h) {
    return (
      <div className="pb-32">
        <TopBar title="Habit not found" onBack={() => go({ name: 'tab', id: 'habits' })} icon={<span>🔍</span>} />
        <div className="px-4">
          <div className="nnh-card p-8 text-center">
            <p className="text-4xl mb-2">🌵</p>
            <p className="font-bold text-[15px]">This habit is gone</p>
            <button type="button" onClick={() => go({ name: 'tab', id: 'habits' })} className="mt-3 nnh-chip px-4 py-2 text-[12px] font-bold" style={{ color: 'var(--nnh-purple)' }}>
              Back to habits
            </button>
          </div>
        </div>
      </div>
    );
  }

  const v = state.entries[`${id}|${today}`]?.v ?? 0;
  const pct = Math.min(1, v / h.target);
  const streak = habitStreak(state.entries, h, new Date());
  const cat = HABIT_CATEGORIES.find(c => c.id === h.category);
  const water = h.type === 'water';

  const addReminderTime = (t: string) => {
    if (!t) return;
    updateHabit(h.id, { reminders: [...h.reminders, t].sort() });
    setNewTime(false);
    haptic('success');
  };

  return (
    <div className="pb-10">
      <TopBar title={h.name} icon={<span>{h.icon}</span>} sub={`${cat?.icon} ${cat?.label} · ${streak > 0 ? `🔥 ${streak} day streak` : 'build your streak'}`}
        onBack={() => go({ name: 'tab', id: 'habits' })}
        right={
          <div className="relative">
            <button type="button" onClick={() => { haptic('selection'); setMenu(m => !m); }} aria-label="Habit options" className="w-10 h-10 rounded-full nnh-card grid place-items-center">
              <MoreHorizontal size={18} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute right-0 top-11 z-40 nnh-card p-1.5 w-44" style={{ background: 'var(--nnh-card)' }}>
                  <button type="button" onClick={() => { haptic('light'); updateHabit(h.id, { archived: !h.archived }); setMenu(false); go({ name: 'tab', id: 'habits' }); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-black/5">
                    <Archive size={15} /> {h.archived ? 'Restore habit' : 'Archive habit'}
                  </button>
                  {confirmDel ? (
                    <button type="button" onClick={() => { deleteHabit(h.id); go({ name: 'tab', id: 'habits' }); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold text-white" style={{ background: '#ef4444' }}>
                      <Trash2 size={15} /> Tap to confirm delete
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDel(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-rose-500">
                      <Trash2 size={15} /> Delete habit
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        } />

      <div className="px-4 space-y-4">
        {water ? (
          <section className="nnh-card p-4 pt-2">
            <div className="text-center mb-1">
              <p className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Stay hydrated, stay healthy 💙</p>
            </div>
            <BigWaterGlass
              glasses={v}
              goal={h.target}
              onAdd={() => bump(h, 1)}
              onRemove={() => bump(h, -1)}
            />
            <div className="text-center mt-2">
              <p className="text-[22px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <CountUp value={v} decimals={v % 1 ? 1 : 0} /> <span className="text-[14px] font-bold" style={{ color: 'var(--nnh-sub)' }}>/ {h.target} glasses</span>
              </p>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                {((v * GLASS_ML) / 1000).toFixed(2)} L / {((h.target * GLASS_ML) / 1000).toFixed(2)} L
              </p>
            </div>
            <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--nnh-line)' }}>
              <motion.div initial={false} animate={{ width: `${pct * 100}%` }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #38bdf8, #2563eb)' }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} />
            </div>

            {/* quick add */}
            <div className="mt-4">
              <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--nnh-sub)' }}>QUICK ADD</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_GLADES.map(q => (
                  <motion.button key={q.label} whileTap={reduced ? undefined : { scale: 0.9 }} type="button" onClick={() => { bump(h, q.glasses); }}
                    className="rounded-2xl py-2.5 flex flex-col items-center gap-1 border"
                    style={{ background: 'var(--nnh-card-soft)', borderColor: 'var(--nnh-line)' }}>
                    <span className="text-xl">{q.icon}</span>
                    <span className="text-[10px] font-bold">{q.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="nnh-card p-5">
            <div className="flex flex-col items-center">
              <Ring size={168} stroke={13} pct={pct} from={h.color} to={h.color === '#f59e0b' ? '#f97316' : '#ec4899'}>
                <div className="text-center">
                  <p className="text-4xl font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <CountUp value={v} decimals={h.type === 'sleep' ? 1 : 0} />
                  </p>
                  <p className="text-[12px] font-bold mt-0.5" style={{ color: 'var(--nnh-sub)' }}>
                    / {fmtHabitValue(h.target, h.type)} · {Math.round(pct * 100)}%
                  </p>
                </div>
              </Ring>
              <div className="flex items-center gap-3 mt-5">
                <motion.button whileTap={reduced ? undefined : { scale: 0.85 }} type="button" onClick={() => bump(h, -(h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1))}
                  disabled={v <= 0} aria-label="Decrease" className="w-12 h-12 rounded-full grid place-items-center disabled:opacity-40" style={{ background: 'var(--nnh-card-soft)' }}>
                  <Minus size={20} />
                </motion.button>
                <motion.button whileTap={reduced ? undefined : { scale: 0.94 }} whileHover={reduced ? undefined : { scale: 1.03 }} type="button"
                  onClick={() => bump(h, h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1)}
                  className="h-12 px-6 rounded-full text-white font-extrabold text-[14px] nnh-gradient-btn flex items-center gap-1.5" style={{ background: `linear-gradient(92deg, ${h.color}, #ec4899)` }}>
                  <Plus size={17} strokeWidth={2.8} />
                  {h.type === 'sleep' ? '30 min' : h.type === 'minutes' ? '5 min' : '1'} {h.type === 'times' ? '' : h.type === 'sleep' ? 'sleep' : 'more'}
                </motion.button>
                <motion.button whileTap={reduced ? undefined : { scale: 0.85 }} type="button" onClick={() => { haptic('light'); setEntry(h, today, 0); }}
                  aria-label="Reset to zero" className="w-12 h-12 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                  0
                </motion.button>
              </div>
              <p className="text-[11px] font-semibold mt-3" style={{ color: 'var(--nnh-sub)' }}>
                {pct >= 1 ? 'Goal reached — amazing! 🎉' : `${fmtHabitValue(Math.max(0, h.target - v), h.type)} to go`}
              </p>
            </div>
          </section>
        )}

        {/* reminders */}
        <section className="nnh-card p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[14px] font-bold"><Bell size={16} style={{ color: h.reminderOn ? h.color : 'var(--nnh-sub)' }} /> Reminders</p>
            <button type="button" role="switch" aria-checked={h.reminderOn} aria-label="Toggle reminders"
              onClick={() => { haptic('selection'); updateHabit(h.id, { reminderOn: !h.reminderOn }); }}
              className="rounded-full p-0.5 transition-colors" style={{ width: 46, height: 26, background: h.reminderOn ? h.color : 'var(--nnh-line)' }}>
              <motion.span layout className="block rounded-full bg-white shadow" style={{ width: 22, height: 22 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {h.reminderOn && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex flex-wrap gap-2 mt-3">
                  {h.reminders.map(t => (
                    <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold nnh-chip">
                      <Clock size={11} style={{ color: h.color }} /> {fmtTime(t)}
                      <button type="button" onClick={() => { haptic('light'); updateHabit(h.id, { reminders: h.reminders.filter(x => x !== t) }); }} aria-label={`Remove ${t} reminder`}>
                        <X size={11} style={{ color: 'var(--nnh-sub)' }} />
                      </button>
                    </span>
                  ))}
                  {newTime ? (
                    <label className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold nnh-chip">
                      <input type="time" defaultValue="09:00" onChange={e => addReminderTime(e.target.value)} autoFocus
                        className="bg-transparent outline-none text-[11px] font-bold" style={{ color: 'var(--nnh-ink)' }} />
                    </label>
                  ) : (
                    <button type="button" onClick={() => { haptic('light'); setNewTime(true); }}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold dashed border" style={{ color: h.color, borderColor: h.color, background: `${h.color}11` }}>
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-bold">Weekly Progress</p>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold text-white" style={{ background: h.color }}>
              {Math.round((v / h.target) * 100)}%
            </span>
          </div>
          <WeekBars data={week} colorFrom={h.color} colorTo={h.color} max={1} height={110} reduced={reduced} />
        </section>

        <p className="text-center text-[11px] font-medium pt-1" style={{ color: 'var(--nnh-sub)' }}>
          “{water ? 'Sip by sip, the glass fills up.' : streak > 0 ? `${streak} days in a row — keep the chain alive! 🔗` : 'One small step today counts.'}”
        </p>
      </div>
    </div>
  );
}

function fmtTime(t: string) {
  const [hH, m] = t.split(':').map(Number);
  const ap = hH >= 12 ? 'PM' : 'AM';
  const hh = hH % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
