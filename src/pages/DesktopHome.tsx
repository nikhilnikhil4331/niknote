// ============================================================
// NikNote Desktop — Home (design-mockup layout)
// Greeting + banner, quick actions, Recently Opened,
// Today tasks, Habit rings and real Stats. Desktop only.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PenLine, LayoutTemplate, FileUp, Sparkles, ScanLine, Plus, Check,
  Flame, Clock3, FileText, NotebookPen, PartyPopper,
} from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { NoteCard, Ring, SectionHeader } from '@/components/desktop/widgets';
import { useDesktopNotes, SAMPLE_NOTES, type DNote } from '@/components/desktop/notes';
import {
  useTasks, useNoteMeta, useDesktopHabits, habitWeekTotal,
  greeting, todayKey, type NikTask,
} from '@/components/desktop/store';
import { useAccountName } from '@/hooks/useAccountName';
import { useStreak } from '@/hooks/useStreak';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const QUICK = [
  { label: 'New Note', sub: 'Start writing', icon: PenLine, bg: '#FFF3CF', fg: '#D9930D', action: 'new' },
  { label: 'From Template', sub: 'Use a template', icon: LayoutTemplate, bg: '#DFF7E8', fg: '#149A66', action: '/templates' },
  { label: 'Upload PDF', sub: 'Convert to notes', icon: FileUp, bg: '#E1EEFF', fg: '#2F6FED', action: '/pdf-editor' },
  { label: 'AI Generate', sub: 'Create with AI', icon: Sparkles, bg: '#ECE7FF', fg: '#6C5CE7', action: '/ai' },
  { label: 'Scan Handwriting', sub: 'Create font', icon: ScanLine, bg: '#FFE9D6', fg: '#E8740C', action: '/scan-notes' },
] as const;

const DesktopHome: React.FC = () => {
  const navigate = useNavigate();
  const account = useAccountName();
  const { user, guest, active, trashed, loading, openNote, openNew } = useDesktopNotes();
  const { tasks, addTask, toggleDone } = useTasks();
  const { isFav } = useNoteMeta();
  const { habits, logToday } = useDesktopHabits();
  const { streak } = useStreak();

  const [newTask, setNewTask] = useState('');
  const [pagesCount, setPagesCount] = useState<number | null>(null);

  const greet = greeting();
  const today = todayKey();
  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Real pages count (cloud) / local notes count (guest)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!guest && user) {
        const { count } = await supabase
          .from('pages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (!cancelled) setPagesCount(count ?? active.length);
      } else if (!cancelled) {
        setPagesCount(active.length);
      }
    })();
    return () => { cancelled = true; };
  }, [guest, user, active.length]);

  const todayTasks = useMemo(() => {
    const relevant = tasks.filter((t) => t.due === today || (!t.due && t.status !== 'done'));
    return [...relevant.filter((t) => t.status !== 'done'), ...relevant.filter((t) => t.status === 'done')].slice(0, 5);
  }, [tasks, today]);

  const editedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return active.filter((n) => new Date(n.updatedAt).getTime() >= weekAgo).length;
  }, [active]);

  // Guest streak: consecutive days (ending today/yesterday) with note activity
  const localStreak = useMemo(() => {
    const days = new Set(active.map((n) => (n.updatedAt || '').slice(0, 10)));
    habits.forEach((h) => Object.keys(h.days).forEach((d) => (h.days[d] > 0 ? days.add(d) : null)));
    let count = 0;
    const d = new Date();
    const key = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (!days.has(key(d))) d.setDate(d.getDate() - 1);
    while (days.has(key(d))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [active, habits]);

  const streakDays = guest ? localStreak : Math.max(streak.currentStreak, localStreak);
  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  const recent = active.slice(0, 6);
  const showSamples = !loading && recent.length === 0;

  const submitTask = () => {
    if (!newTask.trim()) return;
    addTask(newTask, 'todo', today);
    setNewTask('');
  };

  const sampleAsNote = (s: (typeof SAMPLE_NOTES)[number]): DNote => ({
    id: s.id, title: s.title, folder: null, tags: [s.tag], cover: s.cover, style: 'ruled',
    updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    isLocal: true, trashed: false, preview: s.text, raw: null,
  });

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[1120px] px-8 py-7">
        {/* ---------- Greeting + Banner ---------- */}
        <div className="flex gap-6 items-stretch nd-anim">
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h1 className="text-[27px] leading-tight font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>
              {greet.text}{guest ? '' : `, ${account.fullName}`}! {greet.emoji}
            </h1>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--nd-text-2)' }}>
              Let’s make today productive.
            </p>
            <p className="mt-2 text-[12px] font-medium" style={{ color: 'var(--nd-text-3)' }}>{dateLine}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="nd-chip" style={{ background: '#FFF3CF', color: '#B87908' }}>
                <Flame size={12} /> {streakDays} day streak
              </span>
              <span className="nd-chip" style={{ background: '#ECE7FF', color: '#6C5CE7' }}>
                <NotebookPen size={12} /> {active.length} notes
              </span>
              <span className="nd-chip" style={{ background: '#DCF5E7', color: '#149A66' }}>
                <Check size={12} /> {tasks.filter((t) => t.status === 'done').length} tasks done
              </span>
            </div>
          </div>
          <div className="nd-banner flex-none" style={{ width: 400 }}>
            <img src="/images/home-banner.jpg" alt="" />
            <div className="nd-banner-quote">“A small step everyday<br />leads to big results.”</div>
          </div>
        </div>

        {/* ---------- Quick actions ---------- */}
        <div className="grid grid-cols-5 gap-3.5 mt-6 nd-anim nd-anim-1">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                className="nd-quick"
                onClick={() => (q.action === 'new' ? openNew() : navigate(q.action))}
              >
                <span className="nd-quick-ic" style={{ background: q.bg, color: q.fg }}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold truncate" style={{ color: 'var(--nd-text)' }}>{q.label}</span>
                  <span className="block text-[11.5px] truncate" style={{ color: 'var(--nd-text-3)' }}>{q.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ---------- Recently opened ---------- */}
        <div className="mt-8 nd-anim nd-anim-2">
          <SectionHeader
            title={showSamples ? 'Get started with NikNote' : 'Recently Opened'}
            actionLabel="See all"
            onAction={() => navigate('/notebooks')}
          />
          {loading && recent.length === 0 ? (
            <div className="grid grid-cols-6 gap-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="nd-card animate-pulse" style={{ height: 186 }} />
              ))}
            </div>
          ) : showSamples ? (
            <>
              <div className="grid grid-cols-6 gap-3.5">
                {SAMPLE_NOTES.map((s) => (
                  <NoteCard
                    key={s.id}
                    note={sampleAsNote(s)}
                    onOpen={() => openNew({ title: s.title, text: s.text, style: 'ruled' })}
                    footerMeta={<>Sample · {s.tag}</>}
                  />
                ))}
              </div>
              <p className="mt-3 text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--nd-text-3)' }}>
                <PartyPopper size={13} /> These are starter samples — click any card to open it in the editor, or press
                <button className="font-semibold text-[#6C5CE7] hover:underline" onClick={() => openNew()}>New Note</button>
                to write your own.
              </p>
            </>
          ) : (
            <div className="grid grid-cols-6 gap-3.5">
              {recent.map((n) => (
                <NoteCard key={n.id} note={n} fav={isFav(n.id)} onOpen={openNote} />
              ))}
            </div>
          )}
        </div>

        {/* ---------- Today / Habits / Stats ---------- */}
        <div className="grid grid-cols-12 gap-4 mt-8 pb-8">
          {/* Today */}
          <div className="col-span-4 nd-anim nd-anim-3">
            <SectionHeader title="Today" actionLabel="All tasks" onAction={() => navigate('/tasks')} />
            <div className="nd-card p-4">
              {todayTasks.length === 0 && (
                <p className="text-[13px] py-1" style={{ color: 'var(--nd-text-3)' }}>Nothing scheduled. Add your first task below ✨</p>
              )}
              <div className="flex flex-col gap-2.5">
                {todayTasks.map((t: NikTask) => {
                  const done = t.status === 'done';
                  return (
                    <div key={t.id} className="flex items-center gap-2.5">
                      <button
                        className={cn('nd-check', done && 'nd-done')}
                        onClick={() => toggleDone(t)}
                        title={done ? 'Mark as not done' : 'Mark done'}
                      >
                        <Check size={12} strokeWidth={3.2} />
                      </button>
                      <span
                        className="text-[13.5px] font-medium truncate"
                        style={{
                          color: done ? 'var(--nd-text-3)' : 'var(--nd-text)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {t.title}
                      </span>
                      {t.status === 'doing' && (
                        <span className="nd-chip ml-auto" style={{ background: '#E3EDFF', color: '#2F6FED' }}>Doing</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3.5 pt-3" style={{ borderTop: '1px solid var(--nd-border-soft)' }}>
                <Plus size={14} style={{ color: 'var(--nd-text-3)' }} />
                <input
                  className="flex-1 text-[13px] outline-none bg-transparent placeholder:text-[#A19EBA]"
                  placeholder="Add task…"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitTask()}
                />
                {newTask.trim() && (
                  <button className="text-[12px] font-bold text-[#6C5CE7]" onClick={submitTask}>Add</button>
                )}
              </div>
            </div>
          </div>

          {/* Habit tracker */}
          <div className="col-span-5 nd-anim nd-anim-4">
            <SectionHeader title="Habit Tracker" actionLabel="View all" onAction={() => navigate('/habit')} />
            <div className="nd-card p-4">
              <div className="flex items-start justify-between px-1">
                {habits.map((h) => (
                  <Ring
                    key={h.id}
                    label={h.name}
                    value={Math.min(habitWeekTotal(h), h.target)}
                    target={h.target}
                    color={h.color}
                    onClick={() => logToday(h.id)}
                    title={`${h.name}: ${habitWeekTotal(h)}/${h.target} ${h.unit} this week — click to log today`}
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-[11.5px]" style={{ color: 'var(--nd-text-3)' }}>
                Tap a ring to log today’s {habits[0]?.name.toLowerCase() ?? 'habit'} · progress resets weekly
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="col-span-3 nd-anim nd-anim-5">
            <SectionHeader title="Stats" />
            <div className="nd-card p-4">
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>
                    <NotebookPen size={11} /> Notes
                  </div>
                  <div className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--nd-text)' }}>{active.length}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>
                    <FileText size={11} /> Pages
                  </div>
                  <div className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--nd-text)' }}>
                    {pagesCount ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>
                    <Clock3 size={11} /> This week
                  </div>
                  <div className="text-[15px] font-extrabold leading-snug" style={{ color: 'var(--nd-text)' }}>
                    {editedThisWeek} notes edited
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>
                    <Flame size={11} /> Streak
                  </div>
                  <div className="text-[15px] font-extrabold leading-snug" style={{ color: 'var(--nd-text)' }}>
                    {streakDays} days
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DesktopShell>
  );
};

export default DesktopHome;
