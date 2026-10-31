// ============================================================
// NikNote Desktop — Home (2026 redesign)
// Hero banner + greeting with live badges, 7 quick actions,
// My Notes (tabs/search/views/folders), Productivity Overview,
// Focus Insights and the right utility rail (focus timer,
// today's tasks, habits, calendar). All data is real: notes,
// tasks, habits and focus sessions come from the shared stores.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PenLine, Zap, CheckSquare, LayoutTemplate, FileUp, Sparkles, ScanLine,
  Plus, Check, Flame, NotebookPen, Search, LayoutGrid, List, Star, Pin,
  Bell, Crown, FolderOpen, X,
} from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { NoteCard, SectionHeader } from '@/components/desktop/widgets';
import { RightRail } from '@/components/desktop/RightRail';
import { NKEmptyState } from '@/components/nk';
import { ProductivityOverview } from '@/components/desktop/analytics/ProductivityOverview';
import { FocusInsights } from '@/components/desktop/analytics/FocusInsights';
import { useDesktopNotes, SAMPLE_NOTES, type DNote } from '@/components/desktop/notes';
import {
  useTasks, useNoteMeta, useDesktopHabits, todayKey,
  greeting, openCommandPalette, TASK_TAGS,
} from '@/components/desktop/store';
import { doneTodayCount, overdueCount } from '@/lib/productivity';
import { useAccountName } from '@/hooks/useAccountName';
import { useStreak } from '@/hooks/useStreak';
import { usePremiumContext } from '@/contexts/PremiumContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { readableInk } from '@/lib/readableInk';

type NotesTab = 'all' | 'quick' | 'pinned' | 'recent' | 'favorites';

const NOTES_TABS: { id: NotesTab; label: string }[] = [
  { id: 'all', label: 'All Notes' },
  { id: 'quick', label: 'Quick Notes' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'recent', label: 'Recent' },
  { id: 'favorites', label: 'Favorites' },
];

const HERO_QUOTES = [
  'A small step everyday leads to big results.',
  'Better notes, better you.',
  'Stay focused, keep growing.',
  'Consistency today creates a better you tomorrow.',
];

const FOLDER_COLORS = ['#662249', '#5C3A6E', '#C4762F', '#A34054', '#157F52', '#7C5F9E', '#A34054', '#7C5F9E'];

const DesktopHome: React.FC = () => {
  const navigate = useNavigate();
  const account = useAccountName();
  const { isPremium } = usePremiumContext();
  const { user, guest, active, trashed, loading, openNote, openNew, trashNote } = useDesktopNotes();
  const { tasks, addTask } = useTasks();
  const { isFav, toggleFav, isPinned, togglePinned } = useNoteMeta();
  const { habits } = useDesktopHabits();
  const { streak } = useStreak();
  
  // ---------- greeting + hero ----------
  const greet = greeting();
  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setQuoteIdx((i) => (i + 1) % HERO_QUOTES.length), 9000);
    return () => window.clearInterval(id);
  }, []);

  // ---------- heroic badges (all real) ----------
  const localStreak = useMemo(() => {
    const days = new Set(active.map((n) => (n.updatedAt || '').slice(0, 10)));
    habits.forEach((h) => Object.entries(h.days).forEach(([d, c]) => { if (c > 0) days.add(d); }));
    let count = 0;
    const d = new Date();
    const key = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (!days.has(key(d))) d.setDate(d.getDate() - 1);
    while (days.has(key(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }, [active, habits]);
  const streakDays = guest ? localStreak : Math.max(streak.currentStreak, localStreak);
  const today = todayKey();
  const doneToday = doneTodayCount(tasks);
  const overdue = overdueCount(tasks);
  const todayOpenTasks = tasks.filter((t) => t.status !== 'done' && t.due === today);

  // ---------- notes section state ----------
  const [tab, setTab] = useState<NotesTab>('all');
  const [noteQuery, setNoteQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() =>
    localStorage.getItem('niknote.desktop.homeNotesView') === 'list' ? 'list' : 'grid',
  );

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of active) if (n.folder) map.set(n.folder, (map.get(n.folder) ?? 0) + 1);
    return map;
  }, [active]);

  const filteredNotes = useMemo(() => {
    let list = active;
    switch (tab) {
      case 'quick':
        list = list.filter((n) => n.title.toLowerCase().startsWith('quick note'));
        break;
      case 'pinned':
        list = list.filter((n) => isPinned(n.id));
        break;
      case 'recent': {
        const cutoff = Date.now() - 14 * 86400000;
        list = list.filter((n) => new Date(n.updatedAt).getTime() >= cutoff);
        break;
      }
      case 'favorites':
        list = list.filter((n) => isFav(n.id));
        break;
      default:
        break;
    }
    const q = noteQuery.trim().toLowerCase();
    if (q) list = list.filter((n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)));
    // pinned notes always float to the top of All Notes
    if (tab === 'all') list = [...list.filter((n) => isPinned(n.id)), ...list.filter((n) => !isPinned(n.id))];
    return list;
  }, [active, tab, noteQuery, isPinned, isFav]);

  const shownNotes = filteredNotes.slice(0, view === 'grid' ? 7 : 6);
  const showSamples = !loading && active.length === 0;

  // ---------- new task modal ----------
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTag, setTaskTag] = useState<string>(TASK_TAGS[0].name);
  const [taskTime, setTaskTime] = useState('');
  const taskTitleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (taskModalOpen) window.setTimeout(() => taskTitleRef.current?.focus(), 60);
  }, [taskModalOpen]);

  const submitNewTask = () => {
    const title = taskTitle.trim();
    if (!title) return;
    addTask(title, 'todo', today, { tag: taskTag, time: taskTime || undefined });
    toast.success(`Task added to today: “${title}”`);
    setTaskTitle('');
    setTaskTime('');
    setTaskModalOpen(false);
  };

  // ---------- quick actions (all open real workflows) ----------
  const quickNote = () =>
    openNew({ title: `Quick Note · ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });

  const QUICK: {
    label: string; sub: string; icon: React.ElementType; bg: string; fg: string;
    onClick: () => void; cta?: boolean;
  }[] = [
    { label: 'New Note', sub: 'Start writing', icon: PenLine, bg: '', fg: '', onClick: () => openNew(), cta: true },
    { label: 'Quick Note', sub: 'Instant capture', icon: Zap, bg: 'hsl(var(--accent-primary-hsl) / 0.18)', fg: 'hsl(var(--accent-warm-hsl))', onClick: quickNote },
    { label: 'New Task', sub: 'Add to today', icon: CheckSquare, bg: 'hsl(var(--success) / 0.16)', fg: 'hsl(var(--success))', onClick: () => setTaskModalOpen(true) },
    { label: 'Template', sub: 'From library', icon: LayoutTemplate, bg: 'hsl(var(--accent-cool-hsl) / 0.16)', fg: 'hsl(var(--accent-cool-hsl))', onClick: () => navigate('/templates') },
    { label: 'Upload PDF', sub: 'Convert to notes', icon: FileUp, bg: 'hsl(var(--primary) / 0.14)', fg: 'hsl(var(--accent-cool-hsl))', onClick: () => navigate('/pdf-editor') },
    { label: 'AI Generate', sub: 'Create with AI', icon: Sparkles, bg: 'hsl(var(--accent-rose-hsl) / 0.16)', fg: 'hsl(var(--accent-rose-hsl))', onClick: () => navigate('/ai') },
    { label: 'Scan Notes', sub: 'Digitise pages', icon: ScanLine, bg: 'hsl(var(--accent-primary-hsl) / 0.18)', fg: 'hsl(var(--accent-warm-hsl))', onClick: () => navigate('/scan-notes') },
  ];

  // ---------- notifications (derived from real data) ----------
  const [bellOpen, setBellOpen] = useState(false);
  const bellCount = overdue + todayOpenTasks.length;

  const sampleAsNote = (s: (typeof SAMPLE_NOTES)[number]): DNote => ({
    id: s.id, title: s.title, folder: null, tags: [s.tag], cover: s.cover, style: 'ruled',
    updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    isLocal: true, trashed: false, preview: s.text, raw: null,
  });

  const displayName = guest ? 'Guest' : account.fullName || user?.email?.split('@')[0] || 'there';

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="w-full max-w-[1520px] mx-auto px-5 xl:px-7 py-5">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_318px] 2xl:grid-cols-[minmax(0,1fr)_348px] gap-6 items-start">

          {/* ================= MAIN COLUMN ================= */}
          <div className="min-w-0">
            {/* ---------- top bar: search / bell / profile ---------- */}
            <div className="flex items-center gap-3 nd-anim">
              <button
                className="nd-search !m-0 flex-1 max-w-[520px] !bg-surface !border-[1px] !border-[var(--nd-border)]"
                style={{ boxShadow: 'var(--nd-shadow)' }}
                onClick={openCommandPalette}
                aria-label="Search notes, tasks and more (Ctrl K)"
              >
                <Search size={14} />
                <span className="truncate">Search notes, tasks, files, templates…</span>
                <kbd>Ctrl K</kbd>
              </button>
              <span className="hidden md:block text-[12px] font-semibold ml-auto whitespace-nowrap" style={{ color: 'var(--nd-text-3)' }}>
                {dateLine}
              </span>
              {!isPremium && (
                <button
                  className="nd-icon-btn !w-9 !h-9 !bg-surface border border-[var(--nd-border)]"
                  style={{ boxShadow: 'var(--nd-shadow)' }}
                  title="NikNote Premium"
                  onClick={() => navigate('/upgrade')}
                >
                  <Crown size={15} style={{ color: 'var(--nd-brand-orange)' }} />
                </button>
              )}
              <div className="relative">
                <button
                  className="nd-icon-btn !w-9 !h-9 !bg-surface border border-[var(--nd-border)]"
                  style={{ boxShadow: 'var(--nd-shadow)' }}
                  title="Today's reminders"
                  aria-label={`Reminders: ${bellCount} pending`}
                  aria-expanded={bellOpen}
                  onClick={() => setBellOpen((v) => !v)}
                >
                  <Bell size={15} />
                  {bellCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 grid place-items-center text-[9.5px] font-extrabold text-white rounded-full"
                      style={{ width: 15, height: 15, background: 'var(--nd-brand-magenta)' }}
                    >
                      {bellCount > 9 ? '9+' : bellCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                    <div className="nd-menu !p-3" style={{ right: 0, left: 'auto', top: 42, minWidth: 260, position: 'absolute', zIndex: 50 }}>
                      <div className="text-[12px] font-extrabold mb-1.5" style={{ color: 'var(--nd-ink)' }}>Today</div>
                      {overdue > 0 && (
                        <button onClick={() => { setBellOpen(false); navigate('/tasks'); }} className="!items-start">
                          <Flame size={14} style={{ color: 'var(--nd-error)', marginTop: 2 }} />
                          <span>{overdue} overdue task{overdue === 1 ? '' : 's'} — review them</span>
                        </button>
                      )}
                      {todayOpenTasks.slice(0, 4).map((t) => (
                        <button key={t.id} onClick={() => { setBellOpen(false); navigate('/tasks'); }} className="!items-start">
                          <Check size={14} style={{ color: 'var(--nd-brand)', marginTop: 2 }} />
                          <span className="truncate">{t.title}{t.time ? ` · ${t.time}` : ''}</span>
                        </button>
                      ))}
                      {bellCount === 0 && (
                        <p className="text-[12px] py-2 px-1" style={{ color: 'var(--nd-text-3)' }}>
                          All caught up — nothing due right now 🎉
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                className="flex-none grid place-items-center rounded-full text-white text-[13px] font-bold w-9 h-9 border-2 border-white"
                style={{ background: 'linear-gradient(135deg,#ED9E59,#A34054 55%,#662249)', boxShadow: 'var(--nd-shadow)' }}
                title="Account"
                onClick={() => navigate('/account-details')}
              >
                {(displayName || 'N').charAt(0).toUpperCase()}
              </button>
            </div>

            {/* ---------- hero ---------- */}
            <div className="nd-hero mt-4 nd-anim nd-anim-1">
              <img src="/images/home-banner.jpg" alt="" className="nd-kenburns" />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(100deg, rgba(233,188,185,0.85) 0%, rgba(233,188,185,0.5) 34%, rgba(233,188,185,0.06) 62%, rgba(68,23,78,0.18) 100%)',
                }}
              />
              <div className="relative z-10 h-full flex flex-col justify-between p-6 md:p-7 min-h-[210px]">
                <div className="max-w-[520px]">
                  <h1 className="text-[26px] md:text-[30px] leading-[1.12] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-art-ink)' }}>
                    {greet.text},<br />
                    <span style={{ color: 'var(--nd-art-brand)' }}>{displayName}</span>{' '}
                    <span aria-hidden>{greet.emoji}</span>
                  </h1>
                  <p className="mt-2 text-[13.5px] font-semibold italic transition-opacity duration-500" style={{ color: 'var(--nd-art-ink-2)' }} key={quoteIdx}>
                    “{HERO_QUOTES[quoteIdx]}”
                  </p>
                  <p className="mt-1.5 text-[11.5px] font-semibold md:hidden" style={{ color: 'var(--nd-text-3)' }}>{dateLine}</p>
                  <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                    <span className="nd-chip nd-chip-on-art" style={{ color: '#9A4E14' }} title="Consecutive active days">
                      <Flame size={12} /> {streakDays} day streak
                    </span>
                    <span className="nd-chip nd-chip-on-art" style={{ color: 'var(--nd-art-brand)' }}>
                      <NotebookPen size={12} /> {active.length} note{active.length === 1 ? '' : 's'}
                    </span>
                    <span className="nd-chip nd-chip-on-art" style={{ color: '#2E6A45' }}>
                      <Check size={12} /> {doneToday} task{doneToday === 1 ? '' : 's'} done today
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block absolute right-7 top-7 text-right select-none" aria-hidden>
                  <div className="nd-hero-script text-[30px] md:text-[36px] leading-[1.05]">
                    Stay Focused ✦<br />Keep Growing
                  </div>
                </div>
                <div
                  className="hidden sm:block absolute right-6 bottom-5 px-3.5 py-2 rounded-xl text-[12px] font-bold italic"
                  style={{
                    background: 'rgba(255,255,255,0.68)', backdropFilter: 'blur(6px)',
                    color: 'var(--nd-brand-deep)', border: '1px solid rgba(255,255,255,0.8)',
                  }}
                >
                  “Better Notes. Better You.”
                </div>
              </div>
            </div>

            {/* ---------- quick actions ---------- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-4 nd-anim nd-anim-2">
              {QUICK.map((q) => {
                const Icon = q.icon;
                if (q.cta) {
                  return (
                    <button key={q.label} className="nd-btn-cta !flex-col !items-start !gap-2 !p-3.5 !rounded-2xl text-left col-span-2 sm:col-span-1"
                      onClick={q.onClick} title={`${q.label} — ${q.sub}`}>
                      <span className="grid place-items-center rounded-xl w-9 h-9" style={{ background: 'rgba(255,255,255,0.22)' }}>
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[13px] font-extrabold truncate">
                          {q.label} <ChevronIc />
                        </span>
                        <span className="block text-[10.5px] font-medium opacity-90 truncate">{q.sub}</span>
                      </span>
                    </button>
                  );
                }
                return (
                  <button key={q.label} className="nd-quick nd-quick-tile !p-3" onClick={q.onClick} title={`${q.label} — ${q.sub}`}>
                    <span className="nd-quick-ic" style={{ background: q.bg, color: q.fg }}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 w-full">
                      <span className="text-[12px] font-bold leading-[1.2] line-clamp-2" style={{ color: 'var(--nd-ink)' }}>{q.label}</span>
                      <span className="hidden sm:block lg:hidden 2xl:block text-[10.5px] truncate mt-0.5" style={{ color: 'var(--nd-text-3)' }}>{q.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ---------- folder strip ---------- */}
            {folders.length > 0 && (
              <div className="flex gap-2.5 mt-5 overflow-x-auto pb-1 nd-anim nd-anim-3" role="list">
                {folders.map((f, i) => (
                  <button
                    key={f}
                    role="listitem"
                    className="nd-folder flex-none min-w-[132px]"
                    onClick={() => navigate(`/notebooks?space=${encodeURIComponent(f)}`)}
                    title={`Open ${f} space`}
                  >
                    <FolderOpen size={17} style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length], fill: `${FOLDER_COLORS[i % FOLDER_COLORS.length]}30` }} />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-bold truncate" style={{ color: 'var(--nd-ink)' }}>{f}</span>
                      <span className="block text-[10.5px]" style={{ color: 'var(--nd-text-3)' }}>
                        {folderCounts.get(f) ?? 0} note{(folderCounts.get(f) ?? 0) === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ---------- My Notes ---------- */}
            <div className="mt-6 nd-anim nd-anim-3">
              <div className="flex items-center gap-3 flex-wrap mb-3.5">
                <h2 className="text-[16px] font-extrabold tracking-[-0.01em] flex items-center gap-2" style={{ color: 'var(--nd-ink)' }}>
                  <NotebookPen size={17} style={{ color: 'var(--nd-brand-magenta)' }} /> My Notes
                </h2>
                <div className="nd-utabs" role="tablist" aria-label="Filter notes">
                  {NOTES_TABS.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={tab === t.id}
                      className={cn(tab === t.id && 'nd-on')}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--nd-text-3)' }} />
                    <input
                      className="nd-input !py-1.5 !pl-8 !w-[170px] !text-[12.5px]"
                      placeholder="Search in notes…"
                      value={noteQuery}
                      onChange={(e) => setNoteQuery(e.target.value)}
                      aria-label="Search within notes"
                    />
                    {noteQuery && (
                      <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setNoteQuery('')} aria-label="Clear search">
                        <X size={12} style={{ color: 'var(--nd-text-3)' }} />
                      </button>
                    )}
                  </div>
                  <div className="nd-vtabs !p-[2.5px]">
                    <button className={cn('!px-2', view === 'grid' && 'nd-on')} onClick={() => { setView('grid'); localStorage.setItem('niknote.desktop.homeNotesView', 'grid'); }} aria-label="Grid view" title="Grid view">
                      <LayoutGrid size={13} />
                    </button>
                    <button className={cn('!px-2', view === 'list' && 'nd-on')} onClick={() => { setView('list'); localStorage.setItem('niknote.desktop.homeNotesView', 'list'); }} aria-label="List view" title="List view">
                      <List size={13} />
                    </button>
                  </div>
                  <button className="nd-btn-cta !py-1.5 !px-3 !text-[12px]" onClick={() => openNew()}>
                    <Plus size={13} /> New Note
                  </button>
                </div>
              </div>

              {loading && active.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="nd-card animate-pulse" style={{ height: 200 }} />
                  ))}
                </div>
              ) : showSamples ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    <CreateTile onClick={() => openNew()} />
                    {SAMPLE_NOTES.slice(0, 5).map((s) => (
                      <NoteCard
                        key={s.id}
                        note={sampleAsNote(s)}
                        onOpen={() => openNew({ title: s.title, text: s.text, style: 'ruled' })}
                        footerMeta={<>Sample · {s.tag}</>}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
                    ✨ These are starter samples — click any card to turn it into a real, editable note.
                  </p>
                </>
              ) : filteredNotes.length === 0 ? (
                <NKEmptyState
                  className="nd-card !border-dashed !py-8"
                  icon={<span aria-hidden>🗂️</span>}
                  title={noteQuery ? `No notes match “${noteQuery}”` : `Nothing in ${NOTES_TABS.find((t) => t.id === tab)?.label} yet`}
                  description={
                    tab === 'pinned' ? 'Pin a note from its ⋯ menu to keep it on top.' :
                    tab === 'favorites' ? 'Star notes to find them here instantly.' :
                    tab === 'quick' ? 'Use the Quick Note action for instant captures.' : 'Try another tab or create a note.'
                  }
                  action={<button type="button" onClick={() => openNew()} className="nd-btn">New note</button>}
                />
              ) : (
                <div className={cn(view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5' : 'flex flex-col gap-2.5')}>
                  <CreateTile onClick={() => openNew()} compact={view === 'list'} />
                  {shownNotes.map((n) => (
                    <HomeNoteCard
                      key={n.id}
                      note={n}
                      list={view === 'list'}
                      fav={isFav(n.id)}
                      pinned={isPinned(n.id)}
                      onOpen={() => openNote(n)}
                      onTogglePin={() => togglePinned(n.id)}
                      onToggleFav={() => toggleFav(n.id)}
                      onTrash={() => trashNote(n)}
                    />
                  ))}
                  {filteredNotes.length > shownNotes.length && (
                    <button className="nd-btn-ghost justify-center" onClick={() => navigate(tab === 'favorites' ? '/notebooks' : `/notebooks`)}>
                      View all {filteredNotes.length} notes
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ---------- analytics ---------- */}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-4 mt-7 nd-anim nd-anim-4">
              <div>
                <SectionHeader title="Productivity Overview" />
                <ProductivityOverview notes={active} />
              </div>
              <div>
                <SectionHeader title="Focus Insights" />
                <FocusInsights />
              </div>
            </div>

          </div>

          {/* ================= RIGHT RAIL ================= */}
          <aside className="xl:sticky xl:top-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 pb-8">
            <RightRail notes={active} />
          </aside>
        </div>
      </div>

      {/* ---------- New Task modal ---------- */}
      {taskModalOpen && (
        <div className="nd-modal-back" onClick={() => setTaskModalOpen(false)}>
          <div className="nd-modal" role="dialog" aria-modal="true" aria-label="New task" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-extrabold mb-1" style={{ color: 'var(--nd-ink)' }}>New Task</h3>
            <p className="text-[12px] mb-4" style={{ color: 'var(--nd-text-3)' }}>Added to today&apos;s list — appears on Home, Tasks and the calendar.</p>
            <input
              ref={taskTitleRef}
              className="nd-input"
              placeholder="What needs doing?"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewTask(); if (e.key === 'Escape') setTaskModalOpen(false); }}
              aria-label="Task title"
            />
            <div className="mt-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--nd-text-3)' }}>Category</div>
              <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Task category">
                {TASK_TAGS.map((t) => (
                  <button
                    key={t.name}
                    role="radio"
                    aria-checked={taskTag === t.name}
                    className="nd-chip-btn !py-1 !px-2.5 !text-[11px]"
                    style={taskTag === t.name ? { background: t.color, borderColor: t.color, color: readableInk(t.color) } : undefined}
                    onClick={() => setTaskTag(t.name)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--nd-text-3)' }}>Time (optional)</div>
              <input
                type="time"
                className="nd-input !w-[150px]"
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
                aria-label="Task time"
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="nd-btn-ghost" onClick={() => setTaskModalOpen(false)}>Cancel</button>
              <button className="nd-btn-cta" onClick={submitNewTask} disabled={!taskTitle.trim()}>
                <Check size={14} /> Add task
              </button>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
};

// Arrow for the CTA tile
const ChevronIc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// Create-note tile (dashed, hand-drawn feel)
const CreateTile: React.FC<{ onClick: () => void; compact?: boolean }> = ({ onClick, compact }) => (
  <button
    className="nd-create-tile"
    style={compact ? { minHeight: 84, flexDirection: 'row' } : undefined}
    onClick={onClick}
    aria-label="Create a new note"
  >
    <span className="nd-create-plus"><Plus size={20} /></span>
    <span className="text-[13px] font-bold">Create New Note</span>
  </button>
);

// Note card with pin/fav/trash kebab menu
const HomeNoteCard: React.FC<{
  note: DNote;
  list?: boolean;
  fav: boolean;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleFav: () => void;
  onTrash: () => void;
}> = ({ note, list, fav, pinned, onOpen, onTogglePin, onToggleFav, onTrash }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative">
      <NoteCard
        note={note}
        fav={fav}
        onOpen={onOpen}
        listMode={list}
        pinnedBadge={pinned}
      />
      <button
        className="nd-icon-btn !w-7 !h-7 absolute top-2 right-2 !bg-surface/85 backdrop-blur-sm border border-[var(--nd-border-soft)] opacity-90 hover:opacity-100"
        title="Note options"
        aria-label={`Options for ${note.title}`}
        aria-expanded={menuOpen}
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
      >
        ⋯
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="nd-menu" style={{ position: 'absolute', right: 6, top: 38, zIndex: 50, minWidth: 168 }}>
            <button onClick={() => { onTogglePin(); setMenuOpen(false); }}><Pin size={14} /> {pinned ? 'Unpin' : 'Pin to top'}</button>
            <button onClick={() => { onToggleFav(); setMenuOpen(false); }}><Star size={14} color="#C4762F" /> {fav ? 'Remove favorite' : 'Favorite'}</button>
            <button className="nd-danger" onClick={() => { onTrash(); setMenuOpen(false); }}><X size={14} /> Move to Trash</button>
          </div>
        </>
      )}
    </div>
  );
};

export default DesktopHome;
