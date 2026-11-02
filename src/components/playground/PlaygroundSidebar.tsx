import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes, Check, ChevronDown, Copy, FileText, Heart, MoreHorizontal,
  PanelLeftClose, Pin, Plus, Search, Trash2, X,
} from 'lucide-react';
import type { PlaygroundIndexEntry } from '@/lib/playground';

interface Props {
  entries: PlaygroundIndexEntry[];
  activeId: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMeta: (id: string, patch: Partial<PlaygroundIndexEntry>) => void;
  onRename: (id: string, title: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
  onClose?: () => void;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return 'Yesterday';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PlaygroundSidebar(props: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'canvas' | 'favorites'>('all');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pinnedOpen, setPinnedOpen] = useState(true);

  const filtered = useMemo(() => props.entries.filter((entry) => {
    if (tab === 'favorites' && !entry.favorite) return false;
    return !query.trim() || entry.title.toLowerCase().includes(query.trim().toLowerCase());
  }), [props.entries, query, tab]);
  const pinned = filtered.filter((entry) => entry.pinned);
  const recent = filtered.filter((entry) => !entry.pinned);

  const submitRename = (id: string) => {
    const title = draft.trim();
    if (title) props.onRename(id, title);
    setRenaming(null);
  };

  const renderEntry = (entry: PlaygroundIndexEntry) => (
    <div
      key={entry.id}
      className={`pg-document-row${entry.id === props.activeId ? ' is-active' : ''}`}
      draggable={!renaming}
      onDragStart={(event) => event.dataTransfer.setData('application/x-niknote-canvas', entry.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const source = event.dataTransfer.getData('application/x-niknote-canvas');
        if (source) props.onReorder(source, entry.id);
      }}
      onContextMenu={(event) => { event.preventDefault(); setMenu(entry.id); }}
    >
      <button className="pg-document-main" onClick={() => props.onOpen(entry.id)}>
        <span className="pg-document-icon"><Boxes size={16} /></span>
        <span><strong>{entry.title}</strong><small>{relativeTime(entry.updatedAt)}</small></span>
      </button>
      {renaming === entry.id ? (
        <div className="pg-document-rename">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') submitRename(entry.id);
            if (e.key === 'Escape') setRenaming(null);
          }} autoFocus aria-label="Canvas name" />
          <button onClick={() => submitRename(entry.id)} aria-label="Save canvas name"><Check size={13} /></button>
        </div>
      ) : (
        <button className="pg-document-more" onClick={() => setMenu(menu === entry.id ? null : entry.id)} aria-label={`Actions for ${entry.title}`}><MoreHorizontal size={15} /></button>
      )}
      {menu === entry.id && (
        <>
          <button className="pg-menu-backdrop" onClick={() => setMenu(null)} aria-label="Close document menu" />
          <div className="pg-document-menu">
            <button onClick={() => { setDraft(entry.title); setRenaming(entry.id); setMenu(null); }}><FileText size={13} /> Rename</button>
            <button onClick={() => { props.onDuplicate(entry.id); setMenu(null); }}><Copy size={13} /> Duplicate</button>
            <button onClick={() => { props.onMeta(entry.id, { pinned: !entry.pinned }); setMenu(null); }}><Pin size={13} /> {entry.pinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => { props.onMeta(entry.id, { favorite: !entry.favorite }); setMenu(null); }}><Heart size={13} /> {entry.favorite ? 'Remove favorite' : 'Favorite'}</button>
            <button className="is-danger" onClick={() => { setMenu(null); props.onDelete(entry.id); }}><Trash2 size={13} /> Delete</button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <aside className="pg-document-panel">
      <header>
        <div><span className="pg-space-mark"><Boxes size={17} /></span><strong>Study Hub</strong><ChevronDown size={13} /></div>
        <button className="pg-new-canvas" onClick={props.onCreate} aria-label="Create new canvas"><Plus size={17} /></button>
        {props.onClose && <button className="pg-panel-close" onClick={props.onClose} aria-label="Close workspace panel"><PanelLeftClose size={16} /></button>}
      </header>
      <div className="pg-document-tabs">
        <button className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')}>All</button>
        <button className={tab === 'canvas' ? 'is-active' : ''} onClick={() => setTab('canvas')}>Canvas</button>
        <button onClick={() => navigate('/notebooks')}>Notes</button>
        <button className={tab === 'favorites' ? 'is-active' : ''} onClick={() => setTab('favorites')} aria-label="Favorite canvases"><Heart size={12} /></button>
      </div>
      <label className="pg-document-search"><Search size={12} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter canvases…" /></label>
      <div className="pg-document-scroll">
        {pinned.length > 0 && (
          <section>
            <button className="pg-document-section-title" onClick={() => setPinnedOpen((value) => !value)}><ChevronDown size={12} className={pinnedOpen ? '' : '-rotate-90'} /> Pinned</button>
            {pinnedOpen && pinned.map(renderEntry)}
          </section>
        )}
        <section>
          <div className="pg-document-section-title"><ChevronDown size={12} /> {tab === 'favorites' ? 'Favorites' : 'Recently edited'}</div>
          {recent.map(renderEntry)}
        </section>
        {!filtered.length && (
          <div className="pg-documents-empty">
            {query ? <X size={22} /> : <Boxes size={24} />}
            <p>{query ? 'No matching canvases.' : tab === 'favorites' ? 'Favorite a canvas to find it here.' : 'Your canvases will appear here.'}</p>
            {!query && <button onClick={props.onCreate}><Plus size={13} /> New canvas</button>}
          </div>
        )}
      </div>
      <footer><span>{props.entries.length} canvas{props.entries.length === 1 ? '' : 'es'}</span><span>Drag to reorder</span></footer>
    </aside>
  );
}
