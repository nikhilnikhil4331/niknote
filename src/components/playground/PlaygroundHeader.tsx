import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, Check, ChevronRight, Cloud, CloudOff,
  Home, Loader2, Monitor, Moon, PanelLeft, Plus, Search, Sparkles, Sun, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { PlaygroundIndexEntry, PlaygroundObject, PlaygroundTheme } from '@/lib/playground';
import type { PlaygroundSaveState } from '@/hooks/usePlayground';

export type AppThemeMode = 'light' | 'dark' | 'system';

interface Props {
  title: string;
  entries: PlaygroundIndexEntry[];
  tabs: string[];
  activeId: string;
  objects: PlaygroundObject[];
  saveState: PlaygroundSaveState;
  syncMessage: string | null;
  appMode: AppThemeMode;
  canvasTheme: PlaygroundTheme;
  documentsOpen: boolean;
  onToggleDocuments: () => void;
  onTitle: (title: string) => void;
  onOpen: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCreate: () => void;
  onSelectObject: (id: string) => void;
  onAppMode: (mode: AppThemeMode) => void;
  onCanvasTheme: (theme: PlaygroundTheme) => void;
}

export function PlaygroundHeader(props: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return props.objects.filter((object) => `${object.text || ''} ${object.subtitle || ''} ${object.kind}`.toLowerCase().includes(query)).slice(0, 6);
  }, [props.objects, search]);
  const tabs = props.tabs.map((id) => props.entries.find((entry) => entry.id === id)).filter(Boolean) as PlaygroundIndexEntry[];
  const initial = (user?.user_metadata?.full_name || user?.email || 'G').charAt(0).toUpperCase();

  const saveLabel = props.saveState === 'saving' ? 'Saving…' : props.saveState === 'synced' ? 'Cloud saved' : props.saveState === 'error' ? 'Save failed' : props.saveState === 'loading' ? 'Loading…' : 'Device saved';

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  return (
    <div className="pg-header-wrap">
      <header className="pg-topbar">
        <button
          className="pg-canvas-list-toggle"
          onClick={props.onToggleDocuments}
          aria-label="Toggle canvas list"
          aria-expanded={props.documentsOpen}
          title="Canvas list"
        >
          <PanelLeft size={16} />
        </button>
        <div className="pg-history-buttons">
          <button onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft size={15} /></button>
          <button onClick={() => navigate(1)} aria-label="Go forward"><ArrowRight size={15} /></button>
        </div>
        <div className="pg-breadcrumbs">
          <button onClick={() => navigate('/')}><Home size={14} /><span>Study Hub</span></button><ChevronRight size={12} />
          <span>Research</span><ChevronRight size={12} />
          <input value={props.title} onChange={(e) => props.onTitle(e.target.value)} aria-label="Playground title" />
        </div>
        <div className="pg-topbar-actions">
          <div className="pg-canvas-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
                if (e.key === 'Enter' && results[0]) {
                  props.onSelectObject(results[0].id);
                  setSearch('');
                  setSearchFocused(false);
                }
              }}
              placeholder="Search this canvas…"
              aria-label="Search this canvas"
            />
            <kbd>/</kbd>
            {searchFocused && search && (
              <div className="pg-search-results">
                {results.map((object) => (
                  <button key={object.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { props.onSelectObject(object.id); setSearch(''); setSearchFocused(false); }}>
                    <span>{object.kind}</span><strong>{object.text || object.subtitle || 'Untitled object'}</strong><ChevronRight size={12} />
                  </button>
                ))}
                {!results.length && <p>No objects found.</p>}
              </div>
            )}
          </div>
          <button className="pg-topbar-ai" onClick={() => navigate('/ai')} title="Open NikAI"><Sparkles size={16} /><span>Ask AI</span></button>
          <button onClick={() => navigate('/tasks')} title="Tasks and reminders"><Bell size={16} /></button>
          <div className="pg-theme-control">
            <button onClick={() => setThemeOpen((value) => !value)} title="Theme settings" aria-expanded={themeOpen}>
              {props.canvasTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            {themeOpen && (
              <>
                <button className="pg-menu-backdrop" onClick={() => setThemeOpen(false)} aria-label="Close theme menu" />
                <div className="pg-theme-menu">
                  <strong>Playground</strong>
                  <div className="pg-theme-segment">
                    <button className={props.canvasTheme === 'light' ? 'is-active' : ''} onClick={() => props.onCanvasTheme('light')}><Sun size={13} /> White</button>
                    <button className={props.canvasTheme === 'dark' ? 'is-active' : ''} onClick={() => props.onCanvasTheme('dark')}><Moon size={13} /> Black</button>
                  </div>
                  <strong>Application</strong>
                  {(['light', 'dark', 'system'] as AppThemeMode[]).map((mode) => (
                    <button className="pg-app-theme-row" key={mode} onClick={() => props.onAppMode(mode)}>
                      {mode === 'light' ? <Sun size={13} /> : mode === 'dark' ? <Moon size={13} /> : <Monitor size={13} />}
                      <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>{props.appMode === mode && <Check size={13} />}
                    </button>
                  ))}
                  <p>Canvas and app preferences are separate.</p>
                </div>
              </>
            )}
          </div>
          <button className="pg-profile-button" onClick={() => navigate('/account-details')} title="Account">{initial}</button>
        </div>
      </header>
      <div className="pg-document-tabs-bar">
        <button className="pg-mode-tab" onClick={() => navigate('/notebooks')}><span>▤</span> Notes</button>
        {tabs.map((entry) => (
          <div className={`pg-open-tab${entry.id === props.activeId ? ' is-active' : ''}`} key={entry.id}>
            <button onClick={() => props.onOpen(entry.id)}><span className="pg-tab-gradient-icon">∞</span>{entry.title}</button>
            <button onClick={() => props.onCloseTab(entry.id)} aria-label={`Close ${entry.title} tab`}><X size={12} /></button>
          </div>
        ))}
        <button className="pg-add-tab" onClick={props.onCreate} aria-label="New canvas tab"><Plus size={16} /></button>
        <div className={`pg-save-state is-${props.saveState}`} title={props.syncMessage || saveLabel}>
          {props.saveState === 'saving' || props.saveState === 'loading' ? <Loader2 size={12} className="animate-spin" /> : props.saveState === 'synced' ? <Cloud size={12} /> : props.saveState === 'error' || props.syncMessage ? <CloudOff size={12} /> : <Check size={12} />}
          <span>{saveLabel}</span>
        </div>
      </div>
    </div>
  );
}
