// ============================================================
// NikNote Desktop — app shell (Notion-style sidebar layout)
// Matches the design mockup: logo, Ctrl+K search, main nav,
// Spaces, and profile footer. Rendered ONLY on desktop routes.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, NotebookPen, Sparkles, CalendarDays, CheckSquare, HeartPulse,
  Wallet, LayoutTemplate, Users, Trash2, Search, Plus, Folder, Timer, FileText,
  ChevronsLeft, ChevronsRight, ChevronUp, User, Trophy, Crown, LogOut, LogIn, Check,
  MoreHorizontal, Pencil,
} from 'lucide-react';
import { CommandPalette, type CommandItem } from '@/components/command-palette/CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountName } from '@/hooks/useAccountName';
import { usePremiumContext } from '@/contexts/PremiumContext';
import { useSpaces, useTasks } from './store';
import { isGuestUser, useDesktopNotes } from './notes';
import { cn } from '@/lib/utils';
import './desktop.css';

interface ShellProps {
  children: React.ReactNode;
  counts?: { notes?: number; trash?: number };
  folders?: string[];
}

const NAV = [
  { label: 'Home', icon: Home, to: '/', match: (p: string, s: string) => p === '/' && !s.includes('editor') },
  { label: 'My Notes', icon: NotebookPen, to: '/notebooks', match: (p: string) => p === '/notebooks' || p === '/notes', countKey: 'notes' as const },
  { label: 'AI Assistant', icon: Sparkles, to: '/ai', match: (p: string) => p === '/ai' },
  { label: 'Calendar', icon: CalendarDays, to: '/calendar', match: (p: string) => p === '/calendar' },
  { label: 'Tasks', icon: CheckSquare, to: '/tasks', match: (p: string) => p === '/tasks' },
  { label: 'Habit Tracker', icon: HeartPulse, to: '/habit', match: (p: string) => p === '/habit' },
  { label: 'Focus Timer', icon: Timer, to: '/focus', match: (p: string) => p === '/focus' },
  { label: 'Money Tracker', icon: Wallet, to: '/money', match: (p: string) => p === '/money' },
  { label: 'Templates', icon: LayoutTemplate, to: '/templates', match: (p: string) => p === '/templates' },
  { label: 'Shared with me', icon: Users, to: '/shared', match: (p: string) => p === '/shared' },
  { label: 'Trash', icon: Trash2, to: '/trash', match: (p: string) => p === '/trash', countKey: 'trash' as const },
];

export const DesktopShell: React.FC<ShellProps> = ({ children, counts, folders = [] }) => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { user, signOut } = useAuth();
  const account = useAccountName();
  const { isPremium } = usePremiumContext();
  const guest = isGuestUser(user);
  const { spaces, addSpace, renameSpace, removeSpace, isCustom } = useSpaces(folders);
  const { active: searchNotes, openNote: openSearchNote } = useDesktopNotes();
  const { tasks: searchTasks } = useTasks();

  /** Real content results for ⌘K: notes open straight in the editor. */
  const contentCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    for (const n of searchNotes.slice(0, 50)) {
      items.push({
        id: `note-${n.id}`,
        label: n.title,
        description: (n.preview || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || undefined,
        icon: <FileText size={14} />,
        category: 'content',
        action: () => { void openSearchNote(n); },
      });
    }
    for (const t of searchTasks.filter((x) => x.status !== 'done').slice(0, 30)) {
      items.push({
        id: `task-${t.id}`,
        label: `Task: ${t.title}`,
        description: t.due ? `due ${t.due}` : undefined,
        icon: <CheckSquare size={14} />,
        category: 'content',
        action: () => navigate('/tasks'),
      });
    }
    for (const sp of spaces) {
      items.push({
        id: `space-${sp.name}`,
        label: `Space: ${sp.name}`,
        icon: <Folder size={14} />,
        category: 'content',
        action: () => navigate(`/notebooks?space=${encodeURIComponent(sp.name)}`),
      });
    }
    return items;
  }, [searchNotes, searchTasks, spaces, navigate, openSearchNote]);

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('niknote.desktop.sidebar') === '1');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const spaceInputRef = useRef<HTMLInputElement>(null);
  const [spaceMenuFor, setSpaceMenuFor] = useState<string | null>(null);
  const [renamingSpace, setRenamingSpace] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams(search);
  const activeSpace = pathname === '/notebooks' || pathname === '/notes' ? params.get('space') : null;

  useEffect(() => {
    localStorage.setItem('niknote.desktop.sidebar', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    const onOpen = () => setPaletteOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('nik:open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('nik:open-command-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (newSpaceOpen) spaceInputRef.current?.focus();
  }, [newSpaceOpen]);

  useEffect(() => {
    if (renamingSpace) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingSpace]);

  const submitSpace = () => {
    const created = addSpace(spaceName);
    setSpaceName('');
    setNewSpaceOpen(false);
    if (created) navigate(`/notebooks?space=${encodeURIComponent(created.name)}`);
  };

  const submitRenameSpace = (oldName: string) => {
    const clean = renameDraft.trim();
    if (clean && renameSpace(oldName, clean)) {
      if (activeSpace === oldName) navigate(`/notebooks?space=${encodeURIComponent(clean)}`);
    }
    setRenamingSpace(null);
  };

  const deleteSpace = (name: string) => {
    if (!window.confirm(`Delete the “${name}” space? Notes inside keep their folder until you move them.`)) return;
    removeSpace(name);
    setSpaceMenuFor(null);
    if (activeSpace === name) navigate('/notebooks');
  };

  const initial = (account.fullName || user?.email || 'N').charAt(0).toUpperCase();
  const displayName = guest ? 'Guest' : account.fullName || user?.email?.split('@')[0] || 'NikNote User';

  return (
    <div className="nik-desktop flex h-screen w-full overflow-hidden">
      {/* ------------ Sidebar ------------ */}
      <aside
        className="flex flex-col flex-none h-full transition-[width] duration-200 ease-out"
        style={{
          width: collapsed ? 68 : 252,
          background: 'var(--nd-side)',
          borderRight: '1px solid var(--nd-border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 pt-3.5 pb-1">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 min-w-0 rounded-lg px-1 py-1 hover:bg-surface-secondary transition-colors"
            title="NikNote Home"
          >
            <img
              src="/niknote-logo.png"
              alt="NikNote"
              className="flex-none object-contain"
              style={{ width: collapsed ? 34 : 'auto', height: 30, maxWidth: collapsed ? 34 : 150, objectPosition: 'left center' }}
            />
          </button>
          <button
            className="nd-icon-btn ml-auto flex-none"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* Search */}
        {!collapsed ? (
          <div className="nd-search" onClick={() => setPaletteOpen(true)} role="button" title="Search (Ctrl K)">
            <Search size={14} />
            <span>Search…</span>
            <kbd>Ctrl K</kbd>
          </div>
        ) : (
          <button className="nd-icon-btn mx-auto mt-1 mb-1" onClick={() => setPaletteOpen(true)} title="Search (Ctrl K)">
            <Search size={16} />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pb-2">
          {NAV.map((item) => {
            const active = item.match(pathname, search) && !(activeSpace && item.label === 'My Notes');
            const Icon = item.icon;
            const count = item.countKey ? counts?.[item.countKey] : undefined;
            return (
              <div
                key={item.label}
                className={cn('nd-side-item', active && 'nd-active', collapsed && 'justify-center !mx-2')}
                onClick={() => navigate(item.to)}
                role="button"
                title={collapsed ? item.label : undefined}
              >
                <Icon size={17} className="flex-none" strokeWidth={active ? 2.4 : 2} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && count !== undefined && count > 0 && <span className="nd-count">{count}</span>}
              </div>
            );
          })}

          {/* Spaces */}
          {!collapsed && (
            <>
              <div className="nd-side-label">
                <span>Spaces</span>
              </div>
              {spaces.map((sp) => {
                const active = activeSpace === sp.name;
                const custom = isCustom(sp.name);
                if (renamingSpace === sp.name) {
                  return (
                    <div key={sp.name} className="flex items-center gap-1.5 mx-3 mt-1">
                      <input
                        ref={renameInputRef}
                        className="nd-input !py-1.5 !px-2.5 !text-[13px]"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRenameSpace(sp.name);
                          if (e.key === 'Escape') setRenamingSpace(null);
                        }}
                        aria-label={`Rename space ${sp.name}`}
                      />
                      <button
                        className="nd-icon-btn flex-none !bg-primary !text-white hover:!bg-primary"
                        onClick={() => submitRenameSpace(sp.name)}
                        title="Save name"
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={sp.name}
                    className={cn('nd-side-item group', active && 'nd-active')}
                    onClick={() => navigate(`/notebooks?space=${encodeURIComponent(sp.name)}`)}
                    role="button"
                  >
                    <Folder size={16} className="flex-none" fill={sp.color} color={sp.color} />
                    <span className="truncate">{sp.name}</span>
                    {custom && (
                      <span className="ml-auto relative">
                        <button
                          className="nd-icon-btn !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={`Manage ${sp.name}`}
                          aria-label={`Manage space ${sp.name}`}
                          aria-expanded={spaceMenuFor === sp.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpaceMenuFor((v) => (v === sp.name ? null : sp.name));
                          }}
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {spaceMenuFor === sp.name && (
                          <>
                            <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setSpaceMenuFor(null); }} />
                            <div className="nd-menu" style={{ position: 'absolute', right: 0, top: 26, zIndex: 60, minWidth: 150 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameDraft(sp.name);
                                  setRenamingSpace(sp.name);
                                  setSpaceMenuFor(null);
                                }}
                              >
                                <Pencil size={13} /> Rename
                              </button>
                              <button
                                className="nd-danger"
                                onClick={(e) => { e.stopPropagation(); deleteSpace(sp.name); }}
                              >
                                <Trash2 size={13} /> Delete space
                              </button>
                            </div>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}

              {newSpaceOpen ? (
                <div className="flex items-center gap-1.5 mx-3 mt-1.5">
                  <input
                    ref={spaceInputRef}
                    className="nd-input !py-1.5 !px-2.5 !text-[13px]"
                    placeholder="Space name…"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitSpace();
                      if (e.key === 'Escape') setNewSpaceOpen(false);
                    }}
                  />
                  <button className="nd-icon-btn flex-none !bg-primary !text-white hover:!bg-primary" onClick={submitSpace} title="Create space">
                    <Check size={15} />
                  </button>
                </div>
              ) : (
                <div className="nd-side-item" onClick={() => setNewSpaceOpen(true)} role="button" style={{ color: 'var(--nd-text-3)' }}>
                  <Plus size={16} className="flex-none" />
                  <span>New Space</span>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Premium upsell (mockup) — only for non-premium users */}
        {!isPremium && !collapsed && (
          <button
            className="nd-premium-card flex-none"
            onClick={() => navigate('/upgrade')}
            title="Upgrade to NikNote Premium"
          >
            <span className="flex items-center gap-2">
              <span className="grid place-items-center rounded-lg w-8 h-8" style={{ background: 'linear-gradient(135deg,#44174E,#A34054)', color: '#fff' }}>
                <Crown size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-extrabold" style={{ color: 'var(--nd-ink)' }}>NikNote Premium</span>
                <span className="block text-[10.5px] font-medium" style={{ color: 'var(--nd-ink-2)' }}>Unlock all features</span>
              </span>
              <ChevronsRight size={14} className="ml-auto" style={{ color: 'var(--nd-brand-magenta)' }} />
            </span>
          </button>
        )}
        {!isPremium && collapsed && (
          <button
            className="nd-icon-btn mx-auto mb-1.5 flex-none"
            style={{ background: 'linear-gradient(135deg,#44174E,#A34054)', color: '#fff' }}
            onClick={() => navigate('/upgrade')}
            title="Upgrade to NikNote Premium"
          >
            <Crown size={15} />
          </button>
        )}

        {/* Profile footer */}
        <div className="relative flex-none" style={{ borderTop: '1px solid var(--nd-border-soft)' }}>
          <button
            className={cn('flex items-center gap-2.5 w-full text-left px-3.5 py-3 hover:bg-surface-secondary transition-colors', collapsed && 'justify-center px-0')}
            onClick={() => setMenuOpen((v) => !v)}
            title={collapsed ? displayName : undefined}
          >
            <span
              className="flex-none flex items-center justify-center text-white text-[13px] font-bold"
              style={{ width: 30, height: 30, borderRadius: 99, background: 'linear-gradient(135deg,#C4762F,#A34054 55%,#662249)' }}
            >
              {initial}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--nd-text)' }}>{displayName}</span>
                  <span className="block text-[11px] truncate" style={{ color: 'var(--nd-text-3)' }}>
                    {guest ? 'Guest workspace' : isPremium ? 'NikNote Premium' : 'NikNote Free'}
                  </span>
                </span>
                <ChevronUp size={14} style={{ color: 'var(--nd-text-3)' }} />
              </>
            )}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)} />
              <div className="nd-menu" style={{ left: 10, bottom: 64 }}>
                {!guest && (
                  <div className="px-2.5 py-2" style={{ borderBottom: '1px solid var(--nd-border-soft)' }}>
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--nd-text)' }}>{displayName}</div>
                    <div className="text-[11.5px] truncate" style={{ color: 'var(--nd-text-3)' }}>{user?.email}</div>
                  </div>
                )}
                <button onClick={() => { setMenuOpen(false); navigate('/account-details'); }}><User size={15} /> Account</button>
                <button onClick={() => { setMenuOpen(false); navigate('/achievements'); }}><Trophy size={15} /> Achievements</button>
                {!isPremium && (
                  <button onClick={() => { setMenuOpen(false); navigate('/upgrade'); }}>
                    <Crown size={15} color="#C4762F" /> Upgrade to Premium
                  </button>
                )}
                {guest ? (
                  <button onClick={() => { setMenuOpen(false); navigate('/login'); }}><LogIn size={15} /> Sign in</button>
                ) : (
                  <button className="nd-danger" onClick={async () => { setMenuOpen(false); await signOut(); navigate('/'); }}>
                    <LogOut size={15} /> Sign out
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ------------ Main ------------ */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto" style={{ background: 'var(--nd-bg)' }}>
        {children}
      </main>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewNote={() => navigate('/?editor=1&new=1')}
      />
    </div>
  );
};
