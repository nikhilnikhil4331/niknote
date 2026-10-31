// ============================================================
// NikNote Desktop — Focus Timer page (large dial + stats + history)
// Same stores as the home right rail, so both surfaces always
// show the same live session.
// ============================================================

import React, { useMemo } from 'react';
import { Timer, Flame, History, BarChart3 } from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { FocusTimerPanel } from '@/components/desktop/focus/FocusTimerPanel';
import { SessionHistory } from '@/components/desktop/focus/SessionHistory';
import { useDesktopNotes } from '@/components/desktop/notes';
import { useTasks, useFocusSessions } from '@/components/desktop/store';
import { lastNDays, focusMinutesByDay, formatMinutesAsHours, sum, doneTodayCount } from '@/lib/productivity';

const DesktopFocus: React.FC = () => {
  const { active, trashed } = useDesktopNotes();
  const { tasks } = useTasks();
  const { sessions } = useFocusSessions();

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  const stats = useMemo(() => {
    const days = lastNDays(7);
    const mins = focusMinutesByDay(sessions, days);
    const weekMin = sum(mins);
    const totalSessions = sessions.length;
    const allMin = Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / 60);
    return { weekMin, totalSessions, allMin };
  }, [sessions]);

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[1060px] px-6 py-7">
        <div className="nd-anim">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] flex items-center gap-2.5" style={{ color: 'var(--nd-ink)' }}>
            <span className="grid place-items-center rounded-xl w-10 h-10" style={{ background: 'linear-gradient(135deg,#f5f0ff,#ffeaf4)', color: 'var(--nd-brand)' }}>
              <Timer size={19} />
            </span>
            Focus Timer
          </h1>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--nd-text-3)' }}>
            Drag the dial to set your session — {doneTodayCount(tasks)} tasks completed today · sessions count towards your analytics automatically
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-5 mt-6">
          {/* timer card */}
          <div className="nd-card p-6 nd-anim nd-anim-1">
            <FocusTimerPanel tasks={tasks} compact={false} />
          </div>

          {/* side column */}
          <div className="flex flex-col gap-4 nd-anim nd-anim-2">
            <div className="nd-card p-5">
              <h3 className="text-[13.5px] font-bold flex items-center gap-2 mb-3.5" style={{ color: 'var(--nd-ink)' }}>
                <BarChart3 size={15} style={{ color: 'var(--nd-brand)' }} /> Focus Stats
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--nd-lavender)' }}>
                  <div className="text-[19px] font-extrabold tabular-nums" style={{ color: 'var(--nd-brand-deep)' }}>
                    {formatMinutesAsHours(stats.weekMin)}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>This week</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--nd-pink-bg)' }}>
                  <div className="text-[19px] font-extrabold tabular-nums" style={{ color: 'var(--nd-brand-magenta)' }}>
                    {stats.totalSessions}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>Sessions</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(var(--accent-primary-hsl) / 0.18)' }}>
                  <div className="text-[19px] font-extrabold tabular-nums" style={{ color: '#d98a0b' }}>
                    {formatMinutesAsHours(stats.allMin)}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>All time</div>
                </div>
              </div>
              <p className="mt-3 text-[11.5px] flex items-center gap-1.5" style={{ color: 'var(--nd-text-3)' }}>
                <Flame size={12} style={{ color: 'var(--nd-brand-orange)' }} />
                Only completed timer sessions are counted — paused or skipped ones never inflate your stats.
              </p>
            </div>

            <div className="nd-card p-5 flex-1">
              <h3 className="text-[13.5px] font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--nd-ink)' }}>
                <History size={15} style={{ color: 'var(--nd-brand-pink)' }} /> Recent Sessions
              </h3>
              <SessionHistory limit={10} />
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
};

export default DesktopFocus;
