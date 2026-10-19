import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3, Bell, CalendarDays, ChevronRight, Cloud, Download, Flame, Goal, Palette,
  Settings, Sparkles, Trophy, Upload, Waves,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Sheet, StatTile, TopBar, Toggle } from '@/components/habits/ui';
import { bestStreakHistory, fmtHabitValue, toDay, unlockedAchievements } from '@/lib/trackers';
import { accountName } from '@/lib/accountName';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';

export function ProfileScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, activeHabits, updateHabit, setTheme, setNotifications, exportData, syncNow, syncBusy, syncMsg } = useRoutine();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const [sheet, setSheet] = useState<'goals' | 'reminders' | null>(null);
  const now = new Date();

  const name = accountName(user).fullName || 'Friend';
  const email = typeof user?.email === 'string' && user.email ? user.email : 'Guest workspace · saved on this device';
  const best = useMemo(() => bestStreakHistory(state.entries, activeHabits, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.entries, activeHabits]);
  const achCount = useMemo(() => unlockedAchievements({
    habits: activeHabits.map(h => ({ id: h.id, name: h.name, type: h.type, target: h.target, days: h.days })),
    entries: state.entries,
    focus: state.focus,
    today: toDay(now),
  }).length, [activeHabits, state.entries, state.focus]);

  const row = (icon: React.ReactNode, label: string, sub?: string, right?: React.ReactNode, onClick?: () => void, color = 'var(--nnh-violet)') => (
    <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--nnh-card-soft)' }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{icon}</span>
      <button type="button" onClick={onClick} disabled={!onClick} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <span className="block truncate text-[13px] font-bold">{label}</span>
        {sub && <span className="block truncate text-[10px] font-medium" style={{ color: 'var(--nnh-sub)' }}>{sub}</span>}
      </button>
      {right ?? (onClick ? <ChevronRight size={16} style={{ color: 'var(--nnh-sub)' }} /> : null)}
    </div>
  );

  return (
    <div className="pb-2">
      <TopBar title="Profile" icon={<span>👤</span>}
        right={<Link to="/" aria-label="Back to Niknote" className="grid h-11 w-11 place-items-center rounded-full nnh-card"><Settings size={17} /></Link>} />
      <div className="space-y-4 px-4">
        {/* identity */}
        <section className="nnh-card relative overflow-hidden p-5">
          <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full" aria-hidden="true"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }} />
          <div className="relative flex items-center gap-4">
            <div className="relative rounded-full p-[3px] nnh-gradient-btn">
              <div className="grid h-16 w-16 place-items-center rounded-full text-xl font-extrabold"
                style={{ background: 'var(--nnh-card)', color: 'var(--nnh-violet)' }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px]"
                style={{ background: 'var(--nnh-card)' }}>✏️</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="nnh-display truncate text-[19px] font-extrabold">{name}</h2>
              <p className="truncate text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>{email}</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold"
                style={{ background: 'var(--nnh-lavender)', color: 'var(--nnh-violet)' }}>
                <Sparkles size={9} /> Better habits, a brighter you
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <StatTile value={<CountUp value={activeHabits.length} />} label="Habits" accent="var(--nnh-violet)" icon={<Sparkles size={13} />} />
          <StatTile value={<CountUp value={best} />} label="Day Streak" accent="var(--nnh-orange)" icon={<Flame size={13} />} />
          <StatTile value={<CountUp value={achCount} />} label="Achievements" accent="var(--nnh-amber)" icon={<Trophy size={13} />} />
        </div>

        <section className="space-y-2">
          <h3 className="nnh-label px-1">Routine</h3>
          {row(<Goal size={17} />, 'My Goals', 'Set targets for each habit', undefined, () => { haptic('selection'); setSheet('goals'); }, '#7c3aed')}
          {row(<Bell size={17} />, 'Reminders', `${activeHabits.filter(h => h.reminderOn).length} active reminders`, undefined, () => { haptic('selection'); setSheet('reminders'); }, '#ec4899')}
          {row(<CalendarDays size={17} />, 'Calendar', 'Month view & habit history', undefined, () => go({ name: 'calendar' }), '#0ea5e9')}
          {row(<Trophy size={17} />, 'Streaks & Achievements', `${best} day best · ${achCount} unlocked`, undefined, () => go({ name: 'streaks' }), '#f59e0b')}
          {row(<Waves size={17} />, 'Focus Timer', `${state.focus[toDay(now)] ?? 0} sessions today`, undefined, () => go({ name: 'focus' }), '#6366f1')}
        </section>

        <section className="space-y-2">
          <h3 className="nnh-label px-1">Preferences</h3>
          {row(<Palette size={17} />, 'Theme', state.theme === 'light' ? 'Light' : 'Dark',
            <Toggle on={state.theme === 'dark'} onChange={v => setTheme(v ? 'dark' : 'light')} label="Toggle dark theme" />, undefined, '#f59e0b')}
          {row(<Bell size={17} />, 'Notifications', state.notifications ? 'On' : 'Muted',
            <Toggle on={state.notifications} onChange={setNotifications} label="Toggle notifications" />, undefined, '#ef4444')}
          {row(<Sparkles size={17} />, 'Motion', reduced ? 'Reduced motion respected' : 'Full motion', 
            <span className="rounded-full px-2 py-1 text-[9px] font-extrabold" style={{ background: 'var(--nnh-card)', color: 'var(--nnh-sub)' }}>
              {reduced ? 'SYSTEM' : 'ON'}
            </span>, undefined, '#8b5cf6')}
        </section>

        <section className="space-y-2">
          <h3 className="nnh-label px-1">Your data</h3>
          {row(<BarChart3 size={17} />, 'Statistics', 'Completion, streaks & trends', undefined, () => go({ name: 'tab', id: 'insights' }), '#0ea5e9')}
          {row(<Download size={17} />, 'Export Data', 'Download your data as JSON', undefined, exportData, '#16a34a')}
          {row(<Cloud size={17} />, 'Backup & Sync', syncBusy ? 'Syncing…' : syncMsg === 'synced' ? 'Up to date ☁️' : 'Mirror to the cloud',
            <motion.button whileTap={{ scale: 0.92 }} type="button" onClick={syncNow} disabled={syncBusy}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-extrabold text-white nnh-gradient-btn disabled:opacity-50">
              <Upload size={12} /> {syncBusy ? 'Syncing' : 'Sync now'}
            </motion.button>, undefined, '#6366f1')}
        </section>

        <Link to="/account" className="block rounded-2xl py-3 text-center text-[12px] font-bold nnh-chip" style={{ color: 'var(--nnh-violet)' }}>
          Account settings
        </Link>
        <Link to="/" className="block text-center text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
          ← Back to Niknote
        </Link>
        <p className="pb-2 text-center text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
          Niknote Habits · Small habits. Big changes. ✨
        </p>
      </div>

      {/* goals sheet */}
      <Sheet open={sheet === 'goals'} onClose={() => setSheet(null)} title="My Goals">
        <div className="space-y-2.5">
          {activeHabits.map(h => (
            <div key={h.id} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${h.color}22` }}>{h.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{h.name}</p>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{fmtHabitValue(h.target, h.type)} per day</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label={`Lower ${h.name} goal`}
                  onClick={() => { haptic('light'); updateHabit(h.id, { target: Math.max(h.type === 'sleep' ? 1 : 1, h.target - (h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1)) }); }}
                  className="grid h-7 w-7 place-items-center rounded-full text-[14px] font-bold" style={{ background: 'var(--nnh-card-soft)' }}>−</button>
                <span className="nnh-display w-12 text-center text-[14px] font-extrabold tabular-nums">{h.target}</span>
                <button type="button" aria-label={`Raise ${h.name} goal`}
                  onClick={() => { haptic('light'); updateHabit(h.id, { target: h.target + (h.type === 'sleep' ? 0.5 : h.type === 'minutes' ? 5 : 1) }); }}
                  className="grid h-7 w-7 place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: h.color }}>+</button>
              </div>
            </div>
          ))}
          {!activeHabits.length && <p className="py-4 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>No habits yet</p>}
        </div>
      </Sheet>

      {/* reminders sheet */}
      <Sheet open={sheet === 'reminders'} onClose={() => setSheet(null)} title="Reminders">
        <p className="mb-3 text-[10px] font-medium leading-relaxed" style={{ color: 'var(--nnh-sub)' }}>
          Reminders are stored with each habit. On the web build they appear in-app; native builds schedule local notifications.
        </p>
        <div className="space-y-2.5">
          {activeHabits.map(h => (
            <div key={h.id} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${h.color}22` }}>{h.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{h.name}</p>
                <p className="truncate text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                  {h.reminderOn ? (h.reminders.length ? h.reminders.join(' · ') : 'On — add a time in the habit') : 'Off'}
                </p>
              </div>
              <Toggle on={h.reminderOn} onChange={v => { haptic('selection'); updateHabit(h.id, { reminderOn: v }); }} label={`Reminders for ${h.name}`} />
            </div>
          ))}
          {!activeHabits.length && <p className="py-4 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>No habits yet</p>}
        </div>
      </Sheet>
    </div>
  );
}
