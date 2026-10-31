// ============================================================
// NikNote 4.0 — Enhanced Workspace Sidebar
// Notion-level sidebar with: drag-drop, nested pages, 
// favorites, recent, trash, templates, search, workspace switcher
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText, FolderClosed, FolderOpen, Star, Trash2, Plus, Search,
  ChevronRight, ChevronDown, PanelLeftClose, Settings,
  BookOpen, Clock, Palette, Brain, Scan, MoreHorizontal,
  Pin, Share2, Copy, Edit3, Heart, Hash, Globe,
  LayoutGrid, Layers, ChevronUp, LogOut, Crown, Flame,
  MessageCircle, BarChart3, Zap, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotebooks, Notebook } from '@/hooks/useNotebooks';
import { useStudyStreak } from '@/components/gamification/StudyStreak';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WorkspaceSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewNote?: () => void;
  onOpenCommandPalette?: () => void;
}

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  action: () => void;
  badge?: string | number;
  active?: boolean;
  color?: string;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({ 
  isOpen, onToggle, onNewNote, onOpenCommandPalette 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notebooks, loading, deleteNotebook } = useNotebooks();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__unfiled']));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const folderTree = useMemo(() => {
    const filtered = notebooks.filter(n =>
      !searchQuery || n.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const folders = new Map<string, Notebook[]>();
    filtered.forEach(nb => {
      const folder = nb.folder || '__unfiled';
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(nb);
    });
    return folders;
  }, [notebooks, searchQuery]);

  const favorites = useMemo(() => notebooks.filter((n) => (n as unknown as { is_favorite?: boolean }).is_favorite), [notebooks]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) return null;

  // Main navigation items (Notion-style left rail)
  const mainNav: NavItem[] = [
    { id: 'home', icon: <FileText className="w-4 h-4" />, label: 'Home', action: () => navigate('/') },
    { id: 'ai', icon: <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-4 w-auto object-contain" />, label: 'NikAI', action: () => navigate('/ai'), color: 'text-accent-cool', badge: 'ASTRA' },
    { id: 'dna', icon: <Scan className="w-4 h-4 text-success" />, label: 'DNA Scanner', action: () => {}, color: 'text-success' },
    { id: 'documents', icon: <BookOpen className="w-4 h-4" />, label: 'Documents', action: () => navigate('/documents') },
    { id: 'notebooks', icon: <Layers className="w-4 h-4" />, label: 'Notebooks', action: () => navigate('/notebooks') },
  ];

  return (
    <motion.div
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -260, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="h-full w-[260px] bg-surface/60 backdrop-blur-xl border-r border-subtle/60 flex flex-col overflow-hidden"
    >
      {/* ===== WORKSPACE HEADER ===== */}
      <div className="p-3 flex items-center justify-between border-b border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-nk-purple to-nk-rose shadow-sm">
            <img src="/niknote-logo.png" alt="NikNote" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-fg-primary leading-tight">NikNote</div>
            <div className="text-[10px] text-fg-muted/70">Workspace</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenCommandPalette}
            className="h-7 w-7 rounded-lg hover:bg-muted"
            title="Command Palette (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-fg-muted/70" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-7 w-7 rounded-lg hover:bg-muted"
          >
            <PanelLeftClose className="w-3.5 h-3.5 text-fg-muted/70" />
          </Button>
        </div>
      </div>

      {/* ===== QUICK ACTIONS BAR ===== */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onNewNote}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-nk-purple to-nk-rose shadow-sm hover:shadow-md transition-shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            New Note
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onOpenCommandPalette}
            className="h-8 px-2.5 rounded-lg text-xs text-fg-muted bg-muted hover:bg-surface-hover transition-colors"
            title="Search (⌘K)"
          >
            <Search className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* ===== MAIN NAVIGATION ===== */}
      <div className="px-2 py-2">
        {mainNav.map((item) => (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.98 }}
            onClick={item.action}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all group",
              item.active ? "bg-[color:hsl(var(--primary)/0.12)] text-fg-secondary" : "text-fg-secondary hover:bg-muted"
            )}
          >
            <span className={cn("flex-shrink-0", item.color || "text-fg-muted/70")}>
              {item.icon}
            </span>
            <span className="text-[13px] font-medium flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[color:hsl(var(--primary)/0.12)] text-accent-cool">
                {item.badge}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <div className="h-px bg-muted mx-3" />

      <ScrollArea className="flex-1">
        {/* ===== FAVORITES ===== */}
        {favorites.length > 0 && (
          <div className="px-2 py-2">
            <button
              onClick={() => toggleSection('favorites')}
              className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              {collapsed.favorites ? (
                <ChevronRight className="w-3 h-3 text-fg-muted/70" />
              ) : (
                <ChevronDown className="w-3 h-3 text-fg-muted/70" />
              )}
              <Star className="w-3 h-3 text-accent-warm" />
              <span className="text-[10px] font-semibold text-fg-muted/70 uppercase tracking-wider">Favorites</span>
            </button>
            <AnimatePresence>
              {!collapsed.favorites && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {favorites.map((nb) => (
                    <NotebookItem key={nb.id} notebook={nb} isFavorite onDelete={deleteNotebook} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ===== FOLDERS & PAGES ===== */}
        <div className="px-2 py-1">
          <button
            onClick={() => toggleSection('pages')}
            className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
          >
            {collapsed.pages ? (
              <ChevronRight className="w-3 h-3 text-fg-muted/70" />
            ) : (
              <ChevronDown className="w-3 h-3 text-fg-muted/70" />
            )}
            <FileText className="w-3 h-3 text-fg-muted/70" />
            <span className="text-[10px] font-semibold text-fg-muted/70 uppercase tracking-wider">Pages</span>
          </button>
          <AnimatePresence>
            {!collapsed.pages && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {loading ? (
                  <div className="space-y-1.5 px-2.5 py-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-5 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : folderTree.size === 0 ? (
                  <div className="text-center py-6 px-4">
                    <FileText className="w-8 h-8 text-fg-muted/70 mx-auto mb-2" />
                    <p className="text-[11px] text-fg-muted/70">No notes yet</p>
                    <Button variant="ghost" size="sm" onClick={onNewNote} className="mt-2 text-xs h-7 text-accent-cool">
                      <Plus className="w-3 h-3 mr-1" /> Create first note
                    </Button>
                  </div>
                ) : (
                  Array.from(folderTree.entries()).map(([folder, nbs]) => (
                    <FolderItem
                      key={folder}
                      folder={folder}
                      notebooks={nbs}
                      isExpanded={expandedFolders.has(folder)}
                      onToggle={() => toggleFolder(folder)}
                      onDelete={deleteNotebook}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===== TEMPLATES ===== */}
        <div className="px-2 py-1">
          <button
            onClick={() => toggleSection('templates')}
            className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
          >
            {collapsed.templates ? (
              <ChevronRight className="w-3 h-3 text-fg-muted/70" />
            ) : (
              <ChevronDown className="w-3 h-3 text-fg-muted/70" />
            )}
            <LayoutGrid className="w-3 h-3 text-fg-muted/70" />
            <span className="text-[10px] font-semibold text-fg-muted/70 uppercase tracking-wider">Templates</span>
          </button>
          <AnimatePresence>
            {!collapsed.templates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {[
                  { icon: '📝', label: 'Blank Note' },
                  { icon: '📋', label: 'To-Do List' },
                  { icon: '📚', label: 'Study Notes' },
                  { icon: '🔬', label: 'Lab Report' },
                  { icon: '📊', label: 'Project Tracker' },
                  { icon: '🗓️', label: 'Weekly Planner' },
                  { icon: '✍️', label: 'Handwriting Practice' },
                ].map(t => (
                  <button
                    key={t.label}
                    onClick={onNewNote}
                    className="w-full flex items-center gap-2 px-4 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-sm">{t.icon}</span>
                    <span className="text-[12px] text-fg-secondary">{t.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* ===== BOTTOM SECTION ===== */}
      <div className="border-t border-subtle">
        {/* Streak + Quick Stats */}
        <StreakDisplay />

        {/* Quick Stats */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-[10px] text-fg-muted/70">
            <Flame className="w-3 h-3 text-accent-warm" />
            <span>{notebooks.length} notes</span>
            <span className="text-fg-muted/70">•</span>
            <span>Free Plan</span>
            <button 
              onClick={() => navigate('/upgrade')}
              className="ml-auto text-accent-warm font-semibold hover:text-accent-warm transition-colors flex items-center gap-0.5"
            >
              <Crown className="w-3 h-3" />
              Pro
            </button>
          </div>
        </div>

        {/* User */}
        {user ? (
          <div className="px-3 py-2 border-t border-subtle">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nk-purple to-nk-rose flex items-center justify-center shadow-sm">
                <span className="text-[10px] text-white font-bold">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-fg-primary truncate">
                  {user.email?.split('@')[0]}
                </div>
                <div className="text-[10px] text-fg-muted/70 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => navigate('/account')}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-fg-muted/70" />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 border-t border-subtle">
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 gap-1.5 rounded-lg"
            >
              <LogOut className="w-3 h-3" />
              Sign In
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ===== Sub-components =====

const NotebookItem: React.FC<{
  notebook: Notebook;
  isFavorite?: boolean;
  onDelete: (id: string) => void;
}> = ({ notebook, isFavorite, onDelete }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate('/notebooks')}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
      >
        {isFavorite ? (
          <Star className="w-3 h-3 text-accent-warm flex-shrink-0" />
        ) : (
          <FileText className="w-3 h-3 text-fg-muted/70 flex-shrink-0" />
        )}
        <span className="text-[12px] text-fg-primary truncate flex-1">{notebook.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-hover transition-all"
        >
          <MoreHorizontal className="w-3 h-3 text-fg-muted/70" />
        </button>
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-full z-50 w-40 py-1 rounded-xl bg-surface/95 backdrop-blur-xl border border-subtle/60 shadow-lg"
          >
            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-fg-secondary hover:bg-muted">
              <Edit3 className="w-3 h-3" /> Rename
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-fg-secondary hover:bg-muted">
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-fg-secondary hover:bg-muted">
              <Share2 className="w-3 h-3" /> Share
            </button>
            <div className="h-px bg-muted my-1" />
            <button
              onClick={() => { onDelete(notebook.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-error hover:bg-[color:hsl(var(--error)/0.14)]"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FolderItem: React.FC<{
  folder: string;
  notebooks: Notebook[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}> = ({ folder, notebooks, isExpanded, onToggle, onDelete }) => {
  const isUnfiled = folder === '__unfiled';

  return (
    <div className="mb-0.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-fg-muted/70" />
        ) : (
          <ChevronRight className="w-3 h-3 text-fg-muted/70" />
        )}
        {isUnfiled ? (
          <FolderClosed className="w-3.5 h-3.5 text-accent-cool" />
        ) : (
          <FolderOpen className="w-3.5 h-3.5 text-accent-warm" />
        )}
        <span className="text-[12px] font-medium text-fg-primary flex-1 text-left truncate">
          {isUnfiled ? 'My Notes' : folder}
        </span>
        <span className="text-[10px] text-fg-muted/70 tabular-nums">{notebooks.length}</span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-4"
          >
            {notebooks.map((nb) => (
              <NotebookItem key={nb.id} notebook={nb} onDelete={onDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact streak display for sidebar
const StreakDisplay: React.FC = () => {
  const { streakData } = useStudyStreak();
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/account')}
      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors text-left"
    >
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${
        streakData.currentStreak > 0 ? 'bg-nk-warm-600/10' : 'bg-muted'
      }`}>
        <Flame className={`w-3.5 h-3.5 ${
          streakData.currentStreak > 0 ? 'text-accent-warm' : 'text-fg-muted/70'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-fg-secondary">
          {streakData.currentStreak > 0 ? `${streakData.currentStreak} day streak 🔥` : 'Start your streak!'}
        </div>
        <div className="text-[9px] text-fg-muted/70">Write daily to earn rewards</div>
      </div>
      <Crown className="w-3 h-3 text-accent-warm" />
    </button>
  );
};
