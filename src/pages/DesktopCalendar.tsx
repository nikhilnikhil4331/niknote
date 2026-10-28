// ============================================================
// NikNote Desktop — Calendar
// Notes (by last-edited date) + tasks (by due date) on one
// month grid, with a day agenda. Desktop only.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckSquare, Plus, ArrowRight, Timer } from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { MonthCalendar, dayKey, type CalItem } from '@/components/desktop/MonthCalendar';
import { useDesktopNotes } from '@/components/desktop/notes';
import { useTasks, useFocusSessions, FOCUS_CATEGORIES } from '@/components/desktop/store';
import { formatMinutesAsHours } from '@/lib/productivity';

const DesktopCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { active, trashed, openNote, openNew } = useDesktopNotes();
  const { tasks } = useTasks();
  const { sessions } = useFocusSessions();
  const [day, setDay] = useState(dayKey(new Date()));

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  const items: CalItem[] = useMemo(
    () => [
      ...active.map((n): CalItem => ({ id: n.id, title: n.title, date: n.updatedAt, color: n.cover, kind: 'note' })),
      ...tasks.filter((t) => t.due).map((t): CalItem => ({ id: t.id, title: t.title, date: t.due!, color: t.status === 'done' ? '#1FA97A' : '#F26D8D', kind: 'task' })),
      ...sessions.map((fs): CalItem => ({
        id: fs.id,
        title: `${formatMinutesAsHours(fs.durationSec / 60)} ${fs.category}`,
        date: fs.startedAt,
        color: FOCUS_CATEGORIES.find((c) => c.name === fs.category)?.color ?? '#7028D9',
        kind: 'focus',
      })),
    ],
    [active, tasks, sessions],
  );

  const dayNotes = active.filter((n) => (n.updatedAt || '').slice(0, 10) === day);
  const dayTasks = tasks.filter((t) => t.due === day);
  const daySessions = sessions.filter((fs) => (fs.startedAt || '').slice(0, 10) === day);
  const prettyDay = new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleItem = (it: CalItem) => {
    if (it.kind === 'note') {
      const note = active.find((n) => n.id === it.id);
      if (note) void openNote(note);
    } else if (it.kind === 'focus') {
      navigate('/focus');
    } else {
      navigate('/tasks');
    }
  };

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[1160px] px-8 py-7">
        <div className="flex items-center gap-3 nd-anim">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>Calendar</h1>
            <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
              Notes you edited and tasks that are due, all in one place.
            </p>
          </div>
          <button className="nd-btn-primary ml-auto" onClick={() => openNew()}>
            <Plus size={15} /> New note
          </button>
        </div>

        <div className="grid grid-cols-12 gap-4 mt-6 items-start nd-anim nd-anim-1 pb-10">
          <div className="col-span-8">
            <MonthCalendar items={items} selected={day} onSelectDay={setDay} onItemClick={handleItem} />
            <div className="flex items-center gap-4 mt-3 text-[11.5px] font-medium" style={{ color: 'var(--nd-text-2)' }}>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 3, background: '#7C6CF0' }} /> Note edited</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 3, background: '#F26D8D' }} /> Task due</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 3, background: '#1FA97A' }} /> Task done</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 3, background: '#7028D9' }} /> Focus session</span>
            </div>
          </div>

          <div className="col-span-4 nd-card p-4">
            <div className="text-[14px] font-bold" style={{ color: 'var(--nd-text)' }}>{prettyDay}</div>
            <div className="text-[12px] mt-0.5 mb-3" style={{ color: 'var(--nd-text-3)' }}>
              {dayNotes.length + dayTasks.length + daySessions.length === 0 ? 'Nothing here yet — a clean slate ✨' : `${dayNotes.length} note(s) · ${dayTasks.length} task(s) · ${formatMinutesAsHours(daySessions.reduce((a, fs) => a + fs.durationSec, 0) / 60)} focused`}
            </div>

            {dayTasks.length > 0 && (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--nd-text-3)' }}>Tasks due</div>
                <div className="flex flex-col gap-1.5 mb-3">
                  {dayTasks.map((t) => (
                    <button
                      key={t.id}
                      className="flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 hover:bg-[#F8F7FF] transition-colors"
                      style={{ border: '1px solid var(--nd-border-soft)' }}
                      onClick={() => navigate('/tasks')}
                    >
                      <CheckSquare size={14} color={t.status === 'done' ? '#1FA97A' : '#F26D8D'} className="flex-none" />
                      <span
                        className="text-[13px] font-semibold truncate"
                        style={{ color: 'var(--nd-text)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}
                      >
                        {t.title}
                      </span>
                      <ArrowRight size={12} className="ml-auto flex-none" style={{ color: 'var(--nd-text-3)' }} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {daySessions.length > 0 && (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--nd-text-3)' }}>Focus sessions</div>
                <div className="flex flex-col gap-1.5 mb-3">
                  {daySessions.map((fs) => (
                    <button
                      key={fs.id}
                      className="flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 hover:bg-[#F8F7FF] transition-colors"
                      style={{ border: '1px solid var(--nd-border-soft)' }}
                      onClick={() => navigate('/focus')}
                    >
                      <Timer size={14} style={{ color: FOCUS_CATEGORIES.find((c) => c.name === fs.category)?.color ?? '#7028D9' }} className="flex-none" />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--nd-text)' }}>
                        {fs.taskTitle || fs.category} · {formatMinutesAsHours(fs.durationSec / 60)}
                      </span>
                      <ArrowRight size={12} className="ml-auto flex-none" style={{ color: 'var(--nd-text-3)' }} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {dayNotes.length > 0 && (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--nd-text-3)' }}>Notes edited</div>
                <div className="flex flex-col gap-1.5">
                  {dayNotes.map((n) => (
                    <button
                      key={n.id}
                      className="flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 hover:bg-[#F8F7FF] transition-colors"
                      style={{ border: '1px solid var(--nd-border-soft)' }}
                      onClick={() => void openNote(n)}
                    >
                      <FileText size={14} color={n.cover} className="flex-none" />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--nd-text)' }}>{n.title}</span>
                      <ArrowRight size={12} className="ml-auto flex-none" style={{ color: 'var(--nd-text-3)' }} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DesktopShell>
  );
};

export default DesktopCalendar;
