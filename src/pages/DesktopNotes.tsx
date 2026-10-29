// ============================================================
// NikNote Desktop — My Notes with database views
// Table / Board (Kanban) / Gallery / List / Calendar — the
// Notion-style views from the design mockup, all functional.
// Desktop only (mobile keeps its own experience).
// ============================================================

import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Table2, KanbanSquare, LayoutGrid, List, CalendarDays,
  Star, Pin, MoreHorizontal, FileText, Pencil, FolderInput, Trash2, Zap, X,
} from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { NoteCard, StatusChip, EmptyState, STATUS_STYLE } from '@/components/desktop/widgets';
import { MonthCalendar, dayKey, type CalItem } from '@/components/desktop/MonthCalendar';
import { useDesktopNotes, type DNote } from '@/components/desktop/notes';
import { useNoteMeta, useSpaces, niceDate, TASK_COLUMNS, type TaskStatus } from '@/components/desktop/store';
import { cn } from '@/lib/utils';

type View = 'table' | 'board' | 'gallery' | 'list' | 'calendar';

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'board', label: 'Board', icon: KanbanSquare },
  { id: 'gallery', label: 'Gallery', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

const COVERS = ['#7C6CF0', '#3B82F6', '#F59E0B', '#EC4899', '#10B981', '#06B6D4', '#F26D8D', '#8B5CF6'];

const DesktopNotes: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const spaceParam = new URLSearchParams(search).get('space');

  const { active, trashed, loading, openNote, openNew, createNote, renameNote, moveToSpace, trashNote } = useDesktopNotes();
  const { statusOf, isFav, isPinned, setStatus, toggleFav, togglePinned, setPrevFolder } = useNoteMeta();

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );
  const { spaces } = useSpaces(folders);

  const [view, setViewState] = useState<View>(() => {
    const v = localStorage.getItem('niknote.desktop.notesView');
    return v && ['table', 'board', 'gallery', 'list', 'calendar'].includes(v) ? (v as View) : 'table';
  });
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem('niknote.desktop.notesView', v); } catch { /* ignore */ }
  };
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);
  const [calDay, setCalDay] = useState(dayKey(new Date()));

  // modal state
  const [modal, setModal] = useState<null | { mode: 'create' | 'rename'; note?: DNote; status?: TaskStatus }>(null);
  const [fTitle, setFTitle] = useState('');
  const [fSpace, setFSpace] = useState('');
  const [fTags, setFTags] = useState('');
  const [fColor, setFColor] = useState(COVERS[0]);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = active;
    if (spaceParam) list = list.filter((n) => (n.folder || '') === spaceParam);
    if (favOnly) list = list.filter((n) => isFav(n.id));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [active, spaceParam, favOnly, query, isFav]);

  /** Display order: pinned notes float to the top (kept stable otherwise). */
  const displayOrdered = useMemo(
    () => [...filtered].sort((a, b) => (isPinned(b.id) ? 1 : 0) - (isPinned(a.id) ? 1 : 0)),
    [filtered, isPinned],
  );

  const setSpace = (name: string | null) => {
    navigate(name ? `/notebooks?space=${encodeURIComponent(name)}` : '/notebooks', { replace: true });
  };

  const openCreate = (status?: TaskStatus) => {
    setFTitle('');
    setFSpace(spaceParam || '');
    setFTags('');
    setFColor(COVERS[Math.floor(Math.random() * COVERS.length)]);
    setModal({ mode: 'create', status });
    setTimeout(() => titleRef.current?.focus(), 60);
  };

  const openRename = (note: DNote) => {
    setFTitle(note.title);
    setModal({ mode: 'rename', note });
    setTimeout(() => titleRef.current?.focus(), 60);
  };

  const submitModal = async () => {
    if (!modal || busy) return;
    setBusy(true);
    try {
      if (modal.mode === 'rename' && modal.note) {
        await renameNote(modal.note, fTitle);
        setModal(null);
      } else {
        const created = await createNote({
          title: fTitle.trim() || 'Untitled Note',
          folder: fSpace || null,
          tags: fTags.split(',').map((t) => t.trim()).filter(Boolean),
          cover: fColor,
        });
        if (created) {
          if (modal.status) setStatus(created.id, modal.status);
          setModal(null);
          if (!modal.status) void openNote(created);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const quickCreateInColumn = async (status: TaskStatus) => {
    const created = await createNote({ title: 'Untitled Note', folder: spaceParam || null });
    if (created) setStatus(created.id, status);
  };

  const handleTrash = (note: DNote) => {
    setPrevFolder(note.id, note.folder);
    void trashNote(note);
    setMenuFor(null);
  };

  // ---------- per-note menu ----------
  const NoteMenu = ({ note, up }: { note: DNote; up?: boolean }) =>
    menuFor === note.id ? (
      <>
        <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
        <div
          className="nd-menu"
          style={{ right: 0, ...(up ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { setMenuFor(null); void openNote(note); }}><FileText size={14} /> Open</button>
          <button onClick={() => { setMenuFor(null); openRename(note); }}><Pencil size={14} /> Rename</button>
          <button onClick={() => togglePinned(note.id)}>
            <Pin size={14} color={isPinned(note.id) ? '#D92C9B' : 'currentColor'} fill={isPinned(note.id) ? '#D92C9B' : 'none'} />
            {isPinned(note.id) ? 'Unpin' : 'Pin to top'}
          </button>
          <button onClick={() => toggleFav(note.id)}>
            <Star size={14} fill={isFav(note.id) ? '#F5A623' : 'none'} color={isFav(note.id) ? '#F5A623' : 'currentColor'} />
            {isFav(note.id) ? 'Remove favourite' : 'Add to favourites'}
          </button>
          <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>
            <FolderInput size={11} className="inline mr-1" /> Move to space
          </div>
          <button onClick={() => { setMenuFor(null); void moveToSpace(note, null); }}>No space</button>
          {spaces.map((sp) => (
            <button key={sp.name} onClick={() => { setMenuFor(null); void moveToSpace(note, sp.name); }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: sp.color, display: 'inline-block' }} />
              {sp.name}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--nd-border-soft)', margin: '4px 0' }} />
          <button className="nd-danger" onClick={() => handleTrash(note)}><Trash2 size={14} /> Move to Trash</button>
        </div>
      </>
    ) : null;

  const menuBtn = (note: DNote, small = false, up = false) => (
    <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        className="nd-icon-btn"
        style={small ? { width: 24, height: 24 } : undefined}
        onClick={() => setMenuFor(menuFor === note.id ? null : note.id)}
        title="More actions"
      >
        <MoreHorizontal size={small ? 14 : 16} />
      </button>
      <NoteMenu note={note} up={up} />
    </span>
  );

  const starBtn = (note: DNote) => (
    <button
      className="nd-icon-btn !w-6 !h-6"
      title="Favourite"
      onClick={(e) => { e.stopPropagation(); toggleFav(note.id); }}
    >
      <Star size={14} fill={isFav(note.id) ? '#F5A623' : 'none'} color={isFav(note.id) ? '#F5A623' : '#C9C6DE'} />
    </button>
  );

  // ---------- views ----------
  const renderTable = () => (
    <div className="nd-card overflow-hidden">
      <table className="nd-table">
        <thead>
          <tr>
            <th style={{ width: '38%' }}>Name</th>
            <th>Space</th>
            <th>Tag</th>
            <th>Status</th>
            <th>Last Edited</th>
            <th style={{ width: 84 }} />
          </tr>
        </thead>
        <tbody>
          {displayOrdered.map((n, i) => (
            <tr key={n.id} onClick={() => void openNote(n)}>
              <td>
                <span className="flex items-center gap-2.5 min-w-0">
                  <span style={{ width: 10, height: 10, borderRadius: 3.5, background: n.cover, flex: 'none' }} />
                  <span className="font-semibold truncate" style={{ color: 'var(--nd-text)' }}>{n.title}</span>
                  {starBtn(n)}
                </span>
              </td>
              <td>
                {n.folder ? (
                  <span className="nd-chip" style={{ background: '#F1EFFF', color: '#6C5CE7' }}>{n.folder}</span>
                ) : (
                  <span style={{ color: 'var(--nd-text-3)' }}>—</span>
                )}
              </td>
              <td>
                {n.tags[0] ? (
                  <span className="nd-chip" style={{ background: '#FFF3CF', color: '#B87908' }}>{n.tags[0]}</span>
                ) : (
                  <span style={{ color: 'var(--nd-text-3)' }}>—</span>
                )}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <select
                  value={statusOf(n.id)}
                  onChange={(e) => setStatus(n.id, e.target.value as TaskStatus)}
                  className="nd-chip"
                  style={{
                    background: STATUS_STYLE[statusOf(n.id)].bg,
                    color: STATUS_STYLE[statusOf(n.id)].fg,
                    border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="doing">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </td>
              <td style={{ color: 'var(--nd-text-2)' }}>{niceDate(n.updatedAt)}</td>
              <td>{menuBtn(n, false, i >= filtered.length - 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="nd-kanban-new !px-4 !py-2.5" onClick={() => openCreate()}>
        <Plus size={14} /> New
      </button>
    </div>
  );

  const renderBoard = () => (
    <div className="grid grid-cols-3 gap-4 items-start">
      {TASK_COLUMNS.map((col) => {
        const colNotes = filtered.filter((n) => statusOf(n.id) === col.id);
        return (
          <div
            key={col.id}
            className={cn('nd-kanban-col', dropCol === col.id && 'nd-drop')}
            style={{ background: col.bg }}
            onDragOver={(e) => { e.preventDefault(); setDropCol(col.id); }}
            onDragLeave={() => setDropCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) setStatus(dragId, col.id);
              setDragId(null);
              setDropCol(null);
            }}
          >
            <div className="flex items-center gap-2 px-1 pb-2.5">
              <span style={{ width: 8, height: 8, borderRadius: 99, background: col.dot }} />
              <span className="text-[13px] font-bold" style={{ color: 'var(--nd-text)' }}>
                {col.label} <span style={{ color: 'var(--nd-text-3)', fontWeight: 600 }}>({colNotes.length})</span>
              </span>
            </div>
            {colNotes.map((n) => (
              <div
                key={n.id}
                className={cn('nd-kanban-card', dragId === n.id && 'nd-dragging')}
                draggable
                onDragStart={() => setDragId(n.id)}
                onDragEnd={() => { setDragId(null); setDropCol(null); }}
                onClick={() => void openNote(n)}
              >
                <div className="flex items-start gap-1.5">
                  <span className="text-[13.5px] font-semibold flex-1" style={{ color: 'var(--nd-text)' }}>{n.title}</span>
                  {menuBtn(n, true)}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {n.folder && <span className="nd-chip" style={{ background: '#F1EFFF', color: '#6C5CE7' }}>{n.folder}</span>}
                  {n.tags[0] && <span className="nd-chip" style={{ background: '#FFF3CF', color: '#B87908' }}>{n.tags[0]}</span>}
                  <span className="text-[11px] ml-auto" style={{ color: 'var(--nd-text-3)' }}>{niceDate(n.updatedAt)}</span>
                </div>
              </div>
            ))}
            <button className="nd-kanban-new" onClick={() => void quickCreateInColumn(col.id)}>
              <Plus size={14} /> New
            </button>
          </div>
        );
      })}
    </div>
  );

  const renderGallery = () => (
    <div className="grid grid-cols-4 gap-4">
      {displayOrdered.map((n) => (
        <div key={n.id} className="relative group">
          <NoteCard note={n} fav={isFav(n.id)} pinnedBadge={isPinned(n.id)} onOpen={(note) => void openNote(note)} />
          <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {menuBtn(n, true)}
          </span>
          <span className="absolute bottom-[52px] right-2.5">
            <StatusChip status={statusOf(n.id)} />
          </span>
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="nd-card divide-y" style={{ ['--tw-divide-opacity' as string]: 1 }}>
      {displayOrdered.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F8F7FF] transition-colors"
          style={{ borderColor: 'var(--nd-border-soft)' }}
          onClick={() => void openNote(n)}
        >
          <span
            className="flex-none flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 8, background: `${n.cover}1F`, color: n.cover }}
          >
            <FileText size={15} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-semibold truncate" style={{ color: 'var(--nd-text)' }}>{n.title}</span>
            <span className="block text-[11.5px]" style={{ color: 'var(--nd-text-3)' }}>
              {n.folder ? `${n.folder} · ` : ''}Edited {niceDate(n.updatedAt)}
            </span>
          </span>
          <StatusChip status={statusOf(n.id)} />
          {starBtn(n)}
          {menuBtn(n)}
        </div>
      ))}
    </div>
  );

  const calItems: CalItem[] = filtered.map((n) => ({
    id: n.id, title: n.title, date: n.updatedAt, color: n.cover, kind: 'note',
  }));
  const calDayNotes = filtered.filter((n) => (n.updatedAt || '').slice(0, 10) === calDay);

  const renderCalendar = () => (
    <div className="grid grid-cols-12 gap-4 items-start">
      <div className="col-span-8">
        <MonthCalendar
          items={calItems}
          selected={calDay}
          onSelectDay={setCalDay}
          onItemClick={(it) => {
            const note = filtered.find((n) => n.id === it.id);
            if (note) void openNote(note);
          }}
        />
      </div>
      <div className="col-span-4 nd-card p-4">
        <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--nd-text)' }}>
          {new Date(`${calDay}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div className="text-[12px] mb-3" style={{ color: 'var(--nd-text-3)' }}>
          {calDayNotes.length ? `${calDayNotes.length} note(s) edited` : 'No notes edited this day'}
        </div>
        <div className="flex flex-col gap-2">
          {calDayNotes.map((n) => (
            <button
              key={n.id}
              className="flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 hover:bg-[#F8F7FF] transition-colors"
              style={{ border: '1px solid var(--nd-border-soft)' }}
              onClick={() => void openNote(n)}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: n.cover, flex: 'none' }} />
              <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--nd-text)' }}>{n.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[1160px] px-8 py-7">
        {/* Header */}
        <div className="flex items-center gap-3 nd-anim">
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>
              {spaceParam || 'My Notes'}
            </h1>
            <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
              {filtered.length} of {active.length} notes
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--nd-text-3)' }} />
              <input
                className="nd-input !pl-8 !w-[220px]"
                placeholder="Search notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="nd-btn-ghost" onClick={() => openNew()} title="Open editor instantly">
              <Zap size={14} /> Quick note
            </button>
            <button className="nd-btn-primary" onClick={() => openCreate()}>
              <Plus size={15} /> New
            </button>
          </div>
        </div>

        {/* Filters + view tabs */}
        <div className="flex items-center gap-2 mt-5 nd-anim nd-anim-1 flex-wrap">
          <button className={cn('nd-chip-btn', !spaceParam && !favOnly && 'nd-on')} onClick={() => { setSpace(null); setFavOnly(false); }}>
            All
          </button>
          <button className={cn('nd-chip-btn', favOnly && 'nd-on')} onClick={() => setFavOnly((v) => !v)}>
            <Star size={12} className="inline mr-1 -mt-0.5" fill={favOnly ? '#fff' : '#F5A623'} color={favOnly ? '#fff' : '#F5A623'} />
            Favourites
          </button>
          {folders.map((f) => (
            <button key={f} className={cn('nd-chip-btn', spaceParam === f && 'nd-on')} onClick={() => setSpace(spaceParam === f ? null : f)}>
              {f}
            </button>
          ))}
          <div className="ml-auto nd-vtabs">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              return (
                <button key={v.id} className={view === v.id ? 'nd-on' : ''} onClick={() => setView(v.id)}>
                  <Icon size={14} /> {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="mt-4 pb-10 nd-anim nd-anim-2">
          {loading ? (
            <div className="nd-card p-10 text-center text-[13.5px]" style={{ color: 'var(--nd-text-2)' }}>
              Loading your notes…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              emoji="🗒️"
              title={active.length === 0 ? 'No notes yet' : 'No notes match this filter'}
              sub={active.length === 0 ? 'Create your first note and it will appear here in every view — table, board, gallery and calendar.' : 'Try a different search, space or filter.'}
              action={
                <button className="nd-btn-primary" onClick={() => openCreate()}>
                  <Plus size={15} /> Create note
                </button>
              }
            />
          ) : view === 'table' ? renderTable()
            : view === 'board' ? renderBoard()
            : view === 'gallery' ? renderGallery()
            : view === 'list' ? renderList()
            : renderCalendar()}
        </div>
      </div>

      {/* ---------- Create / Rename modal ---------- */}
      {modal && (
        <div className="nd-modal-back" onClick={() => !busy && setModal(null)}>
          <div className="nd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-extrabold" style={{ color: 'var(--nd-text)' }}>
                {modal.mode === 'rename' ? 'Rename note' : 'New note'}
              </h3>
              <button className="nd-icon-btn" onClick={() => setModal(null)}><X size={16} /></button>
            </div>

            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--nd-text-2)' }}>Title</label>
            <input
              ref={titleRef}
              className="nd-input"
              placeholder="e.g. Biology Class Notes"
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submitModal()}
            />

            {modal.mode === 'create' && (
              <>
                <label className="block text-[12px] font-semibold mt-4 mb-1.5" style={{ color: 'var(--nd-text-2)' }}>Space</label>
                <select className="nd-input" value={fSpace} onChange={(e) => setFSpace(e.target.value)}>
                  <option value="">No space</option>
                  {spaces.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>

                <label className="block text-[12px] font-semibold mt-4 mb-1.5" style={{ color: 'var(--nd-text-2)' }}>Tags (comma separated)</label>
                <input
                  className="nd-input"
                  placeholder="e.g. Biology, Exam"
                  value={fTags}
                  onChange={(e) => setFTags(e.target.value)}
                />

                <label className="block text-[12px] font-semibold mt-4 mb-2" style={{ color: 'var(--nd-text-2)' }}>Cover colour</label>
                <div className="flex items-center gap-2">
                  {COVERS.map((c) => (
                    <span
                      key={c}
                      className={cn('nd-swatch', fColor === c && 'nd-on')}
                      style={{ background: c }}
                      onClick={() => setFColor(c)}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button className="nd-btn-ghost" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
              <button className="nd-btn-primary" onClick={() => void submitModal()} disabled={busy}>
                {busy ? 'Saving…' : modal.mode === 'rename' ? 'Rename' : modal.status ? 'Add to board' : 'Create & open'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
};

export default DesktopNotes;
