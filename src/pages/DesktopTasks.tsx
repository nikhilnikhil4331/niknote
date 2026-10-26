// ============================================================
// NikNote Desktop — Tasks (Kanban board)
// Same task store as the Home "Today" widget, so checking a
// task anywhere updates everywhere instantly. Desktop only.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Plus, Check, Trash2, CalendarDays, ListChecks } from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { useDesktopNotes } from '@/components/desktop/notes';
import { useTasks, TASK_COLUMNS, todayKey, type TaskStatus, type NikTask } from '@/components/desktop/store';
import { cn } from '@/lib/utils';

const DesktopTasks: React.FC = () => {
  const { tasks, addTask, updateTask, removeTask, toggleDone } = useTasks();
  const { active, trashed } = useDesktopNotes();

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const today = todayKey();
  const openCount = tasks.filter((t) => t.status !== 'done').length;
  const doneToday = tasks.filter((t) => t.status === 'done' && (t.doneAt || '').slice(0, 10) === today).length;

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  const submitAdd = (status: TaskStatus) => {
    if (!draft.trim()) return;
    addTask(draft, status, status === 'todo' ? today : undefined);
    setDraft('');
    setAddingIn(null);
  };

  const submitEdit = (task: NikTask) => {
    if (editDraft.trim()) updateTask(task.id, { title: editDraft.trim() });
    setEditingId(null);
  };

  const dueLabel = (t: NikTask) => {
    if (!t.due) return null;
    if (t.due === today) return { text: 'Today', hot: t.status !== 'done' };
    const d = new Date(`${t.due}T00:00:00`);
    return { text: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), hot: t.due < today && t.status !== 'done' };
  };

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[1160px] px-8 py-7">
        <div className="flex items-center gap-3 nd-anim">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>Tasks</h1>
            <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
              {openCount} open · {doneToday} completed today
            </p>
          </div>
          <span className="ml-auto nd-chip" style={{ background: '#ECE7FF', color: '#6C5CE7' }}>
            <ListChecks size={12} /> Drag cards between columns
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 items-start nd-anim nd-anim-1 pb-10">
          {TASK_COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className={cn('nd-kanban-col', dropCol === col.id && 'nd-drop')}
                style={{ background: col.bg }}
                onDragOver={(e) => { e.preventDefault(); setDropCol(col.id); }}
                onDragLeave={() => setDropCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) updateTask(dragId, { status: col.id });
                  setDragId(null);
                  setDropCol(null);
                }}
              >
                <div className="flex items-center gap-2 px-1 pb-2.5">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: col.dot }} />
                  <span className="text-[13px] font-bold" style={{ color: 'var(--nd-text)' }}>
                    {col.label} <span style={{ color: 'var(--nd-text-3)', fontWeight: 600 }}>({colTasks.length})</span>
                  </span>
                </div>

                {colTasks.map((t) => {
                  const due = dueLabel(t);
                  const done = t.status === 'done';
                  return (
                    <div
                      key={t.id}
                      className={cn('nd-kanban-card group', dragId === t.id && 'nd-dragging')}
                      draggable={editingId !== t.id}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setDropCol(null); }}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          className={cn('nd-check mt-[1px]', done && 'nd-done')}
                          onClick={() => toggleDone(t)}
                          title={done ? 'Reopen' : 'Mark done'}
                        >
                          <Check size={12} strokeWidth={3.2} />
                        </button>
                        {editingId === t.id ? (
                          <input
                            className="nd-input !py-1 !px-2 flex-1 !text-[13px]"
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitEdit(t);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onBlur={() => submitEdit(t)}
                          />
                        ) : (
                          <span
                            className="flex-1 text-[13.5px] font-medium cursor-text"
                            style={{ color: done ? 'var(--nd-text-3)' : 'var(--nd-text)', textDecoration: done ? 'line-through' : 'none' }}
                            title="Double-click to edit"
                            onDoubleClick={() => { setEditingId(t.id); setEditDraft(t.title); }}
                          >
                            {t.title}
                          </span>
                        )}
                        <button
                          className="nd-icon-btn !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeTask(t.id)}
                          title="Delete task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 ml-[29px]">
                        <label
                          className="relative inline-flex items-center gap-1 cursor-pointer text-[11px] font-semibold rounded-full px-2 py-[2px] transition-colors"
                          style={
                            due
                              ? { background: due.hot ? '#FFE1E6' : '#F1EFFF', color: due.hot ? '#D93A5C' : '#6C5CE7' }
                              : { background: '#F4F3FA', color: 'var(--nd-text-3)' }
                          }
                          title="Set due date"
                        >
                          <CalendarDays size={11} />
                          {due ? due.text : 'Add date'}
                          <input
                            type="date"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={t.due || ''}
                            onChange={(e) => updateTask(t.id, { due: e.target.value || undefined })}
                          />
                        </label>
                        {t.due && (
                          <button className="text-[10.5px] font-semibold" style={{ color: 'var(--nd-text-3)' }} onClick={() => updateTask(t.id, { due: undefined })}>
                            clear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {addingIn === col.id ? (
                  <div className="nd-kanban-card">
                    <input
                      className="nd-input !py-1.5 !text-[13px]"
                      autoFocus
                      placeholder="Task name…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitAdd(col.id);
                        if (e.key === 'Escape') setAddingIn(null);
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                      <button className="nd-btn-primary !py-1.5 !px-3 !text-[12px]" onClick={() => submitAdd(col.id)}>Add</button>
                      <button className="nd-btn-ghost !py-1.5 !px-3 !text-[12px]" onClick={() => setAddingIn(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="nd-kanban-new" onClick={() => { setAddingIn(col.id); setDraft(''); }}>
                    <Plus size={14} /> New
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DesktopShell>
  );
};

export default DesktopTasks;
