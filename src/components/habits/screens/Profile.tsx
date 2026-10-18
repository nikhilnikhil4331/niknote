import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3, Bell, ChevronRight, Cloud, Download, Flame, Goal,
  Palette, Settings, Sparkles, Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Sheet, StatTile, TopBar, Toggle } from '@/components/habits/ui';
import { bestStreakAcross, fmtHabitValue, toDay, unlockedAchievements } from '@/lib/trackers';
import { accountName } from '@/lib/accountName';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';

export function ProfileScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, activeHabits, updateHabit, setTheme, setNotifications, exportData, syncNow, syncBusy, syncMsg } = useRoutine();
  const { user } = useAuth() as any;
  const reduced = useReducedMotion();
  const [sheet, setSheet] = useState<'goals' | 'reminders' | null>(null);
  const now = new Date();

  const name = accountName(user).fullName || 'Friend';
  const email = typeof user?.email === 'string' ? user.email : 'guest@niknote.app';
  const best = useMemo(() => bestStreakAcross(state.entries, activeHabits, now), [state.entries, activeHabits]);
  const achCount = useMemo(() => unlockedAchievements({
    habits: activeHabits.map(h => ({ id: h.id, name: h.name, type: h.type, target: h.target, days: h.days })),
    entries: state.entries,
    focus: state.focus,
    today: toDay(now),
  }).length, [activeHabits, state.entries, state.focus]);

  const row = (icon: React.ReactNode, label: string, sub?: string, right?: React.ReactNode, onClick?: () => void, color = 'var(--nnh-purple)') => (
    <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--nnh-card-soft)' }}>
      <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{icon}</span>
      <button type="button" onClick={onClick} disabled={!onClick} className="flex-1 min-w-0 text-left disabled:cursor-default">
        <span className="block text-[13px] font-bold truncate">{label}</span>
        {sub && <span className="block text-[10px] font-medium truncate" style={{ color: 'var(--nnh-sub)' }}>{sub}</span>}
      </button>
      {right ?? (onClick ? <ChevronRight size={16} style={{ color: 'var(--nnh-sub)' }} /> : null)}
    </div>
  );

  return (
    <div className="pb-32">
      <TopBar title="Profile" icon={<span>👤</span>}
        right={<Link to="/" aria-label="Back to Niknote" className="w-10 h-10 rounded-full nnh-card grid place-items-center"><Settings size={17} /></Link>} />
      <div className="px-4 space-y-4">
        {/* identity */}
        <section className="nnh-card p-5 flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full nnh-gradient-btn grid place-items-center text-white text-xl font-extrabold p-[3px]">
              <div className="w-full h-full rounded-full grid place-items-center text-lg font-extrabold" style={{ background: 'var(--nnh-card)' }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full grid place-items-center text-[10px]" style={{ background: 'var(--nnh-card)' }}>✏️</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{name}</h2>
            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--nnh-sub)' }}>{email}</p>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <StatTile value={<CountUp value={activeHabits.length} />} label="Habits" accent="#8b5cf6" icon={<Sparkles size={13} />} />
          <StatTile value={<CountUp value={best} />} label="Day Streak" accent="#f97316" icon={<Flame size={13} />} />
          <StatTile value={<CountUp value={achCount} />} label="Achievements" accent="#f59e0b" />
        </div>

        {/* menu */}
        <div className="space-y-2">
          {row(<Goal size={17} />, 'My Goals', 'Set targets for each habit', undefined, () => { haptic('selection'); setSheet('goals'); }, '#8b5cf6')}
          {row(<Bell size={17} />, 'Reminders', `${activeHabits.filter(h => h.reminderOn).length} active reminders`, undefined, () => { haptic('selection'); setSheet('reminders'); }, '#ec4899')}
          {row(<Palette size={17} />, 'Theme', state.theme === 'light' ? 'Light' : 'Dark',
            <Toggle on={state.theme === 'dark'} onChange={v => setTheme(v ? 'dark' : 'light')} label="Toggle dark theme" />, undefined, '#f59e0b')}
          {row(<BarChart3 size={17} />, 'Statistics', 'Completion, streaks & trends', undefined, () => go({ name: 'tab', id: 'insights' }), '#0ea5e9')}
          {row(<Download size={17} />, 'Export Data', 'Download your data as JSON', undefined, exportData, '#16a34a')}
          {row(<Cloud size={17} />, 'Backup & Sync', syncBusy ? 'Syncing…' : syncMsg === 'synced' ? 'Up to date ☁️' : 'Mirror to the cloud',
            <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={syncNow} disabled={syncBusy}
              className="px-3.5 py-2 rounded-full text-[11px] font-extrabold text-white nnh-gradient-btn disabled:opacity-50 flex items-center gap-1.5">
              <Upload size={12} /> {syncBusy ? 'Syncing' : 'Sync now'}
            </motion.button>, undefined, '#6366f1')}
          {row(<Bell size={17} />, 'Notifications', state.notifications ? 'On' : 'Off',
            <Toggle on={state.notifications} onChange={setNotifications} label="Toggle notifications" />, undefined, '#ef4444')}
        </div>

        <Link to="/" className="block nnh-chip py-3 text-center text-[13px] font-bold" style={{ color: 'var(--nnh-purple)' }}>
          ← Back to Niknote
        </Link>
        <p className="text-center text-[10px] font-semibold pb-2" style={{ color: 'var(--nnh-sub)' }}>
          Niknote Habits · Small habits. Big changes. ✨
        </p>
      </div>

      {/* goals sheet */}
      <Sheet open={sheet === 'goals'} onClose={() => setSheet(null)} title="My Goals">
        <div className="space-y-2.5">
          {activeHabits.map(h => (
            <div key={h.id} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center text-lg shrink-0" style={{ background: `${h.color}22` }}>{h.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{h.name}</p>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{fmtHabitValue(h.target, h.type)} per day</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label={`Lower ${h.name} goal`} onClick={() => { haptic('light'); updateHabit(h.id, { target: Math.max(h.type === 'sleep' ? 1 : 1, h.target - (h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1)) }); }}
                  className="w-7 h-7 rounded-full grid place-items-center text-[14px] font-bold" style={{ background: 'var(--nnh-card-soft)' }}>−</button>
                <span className="text-[14px] font-extrabold w-12 text-center tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{h.target}</span>
                <button type="button" aria-label={`Raise ${h.name} goal`} onClick={() => { haptic('light'); updateHabit(h.id, { target: h.target + (h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1) }); }}
                  className="w-7 h-7 rounded-full grid place-items-center text-[14px] font-bold text-white" style={{ background: h.color }}>+</button>
              </div>
            </div>
          ))}
          {!activeHabits.length && <p className="text-center text-[12px] py-4" style={{ color: 'var(--nnh-sub)' }}>No habits yet</p>}
        </div>
      </Sheet>

      {/* reminders sheet */}
      <Sheet open={sheet === 'reminders'} onClose={() => setSheet(null)} title="Reminders">
        <div className="space-y-2.5">
          {activeHabits.map(h => (
            <div key={h.id} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center text-lg shrink-0" style={{ background: `${h.color}22` }}>{h.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{h.name}</p>
                <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--nnh-sub)' }}>
                  {h.reminderOn ? (h.reminders.length ? h.reminders.map(t => t.replace(':', ':')).join(' · ') : 'On — add a time in the habit') : 'Off'}
                </p>
              </div>
              <Toggle on={h.reminderOn} onChange={v => { haptic('selection'); updateHabit(h.id, { reminderOn: v }); }} label={`Reminders for ${h.name}`} />
            </div>
          ))}
          {!activeHabits.length && <p className="text-center text-[12px] py-4" style={{ color: 'var(--nnh-sub)' }}>No habits yet</p>}
        </div>
      </Sheet>
    </div>
  );
}
