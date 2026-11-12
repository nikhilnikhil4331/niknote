// ============================================================
// NikNote 4.0 — Enhanced Workspace Sidebar
// Notion-level sidebar with: drag-drop, nested pages, 
// favorites, recent, trash, templates, search, workspace switcher
// ============================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText, FolderClosed, FolderOpen, Star, Trash2, Plus, Search,
  ChevronRight, ChevronDown, PanelLeftClose, Settings, BookOpen,
  MoreHorizontal, LayoutGrid, Layers, LogOut, Shapes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotebooks, Notebook } from '@/hooks/useNotebooks';
import { useAuth } from '@/contexts/AuthContext';
import { useNoteMeta } from '@/components/desktop/store';
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
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { notebooks, loading, updateNotebook } = useNotebooks();
  const { setPrevFolder } = useNoteMeta();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__unfiled']));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const moveToTrash = useCallback((id: string) => {
    const notebook = notebooks.find((item) => item.id === id);
    if (!notebook || notebook.folder === '__trash__') return;
    setPrevFolder(id, notebook.folder ?? null);
    void updateNotebook(id, { folder: '__trash__' });
  }, [notebooks, setPrevFolder, updateNotebook]);

  const folderTree = useMemo(() => {
    const filtered = notebooks.filter((notebook) =>
      notebook.folder !== '__trash__' &&
      (!searchQuery || notebook.title.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const folders = new Map<string, Notebook[]>();
    filtered.forEach(nb => {
      const folder = nb.folder || '__unfiled';
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(nb);
    });
    return folders;
  }, [notebooks, searchQuery]);

  const favorites = useMemo(() => notebooks.filter((notebook) => notebook.folder !== '__trash__' && notebook.is_favorite), [notebooks]);

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

  // Keep the primary rail focused on real workspace destinations. NikAI and
  // handwriting tools remain available from the editor top bar and integrations.
  const mainNav: NavItem[] = [
    { id: 'home', icon: <FileText className="w-4 h-4" />, label: 'Home', action: () => navigate('/home'), active: pathname === '/home' },
    { id: 'notes', icon: <BookOpen className="w-4 h-4" />, label: 'Notes', action: () => navigate('/notes'), active: pathname.startsWith('/editor') || pathname === '/notes' },
    { id: 'notebooks', icon: <Layers className="w-4 h-4" />, label: 'Notebooks', action: () => navigate('/notebooks'), active: pathname === '/notebooks' },
    { id: 'documents', icon: <FileText className="w-4 h-4" />, label: 'Documents', action: () => navigate('/documents'), active: pathname === '/documents' },
    { id: 'playground', icon: <Shapes className="w-4 h-4" />, label: 'Playground', action: () => navigate('/playground'), active: pathname === '/playground' },
    { id: 'trash', icon: <Trash2 className="w-4 h-4" />, label: 'Trash', action: () => navigate('/trash'), active: pathname === '/trash' },
  ];

  return (
    <motion.div
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -260, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="nn-workspace-sidebar h-full w-[260px] bg-white/60 backdrop-blur-xl border-r border-gray-200/60 flex flex-col overflow-hidden"
    >
      {/* ===== WORKSPACE HEADER ===== */}
      <div className="p-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center bg-[#EAF2FF] border border-[#C7D9F5] shadow-sm">
            <img src="/images/brand/niknote-primary-mark.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
          </div>
          <div className="text-sm font-bold text-gray-900 leading-tight">Workspace</div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenCommandPalette}
            className="h-7 w-7 rounded-lg hover:bg-gray-100"
            title="Command Palette (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-gray-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-7 w-7 rounded-lg hover:bg-gray-100"
          >
            <PanelLeftClose className="w-3.5 h-3.5 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* ===== QUICK ACTIONS BAR ===== */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onNewNote}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white bg-primary hover:bg-primary/90 shadow-sm hover:shadow-md transition-shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            New Note
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onOpenCommandPalette}
            className="h-8 px-2.5 rounded-lg text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
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
              item.active ? "bg-blue-50 text-blue-800" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <span className={cn("flex-shrink-0", item.color || "text-gray-400")}>
              {item.icon}
            </span>
            <span className="text-[13px] font-medium flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFE45C] text-[#171313]">
                {item.badge}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <div className="h-px bg-gray-100 mx-3" />

      <ScrollArea className="flex-1">
        {/* ===== FAVORITES ===== */}
        {favorites.length > 0 && (
          <div className="px-2 py-2">
            <button
              onClick={() => toggleSection('favorites')}
              className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {collapsed.favorites ? (
                <ChevronRight className="w-3 h-3 text-gray-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              )}
              <Star className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Favorites</span>
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
                    <NotebookItem key={nb.id} notebook={nb} isFavorite onDelete={moveToTrash} />
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
            className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {collapsed.pages ? (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            )}
            <FileText className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pages</span>
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
                      <div key={i} className="h-5 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : folderTree.size === 0 ? (
                  <div className="text-center py-6 px-4">
                    <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-400">No notes yet</p>
                    <Button variant="ghost" size="sm" onClick={onNewNote} className="mt-2 text-xs h-7 text-blue-700">
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
                      onDelete={moveToTrash}
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
            className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {collapsed.templates ? (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            )}
            <LayoutGrid className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Templates</span>
          </button>
          <AnimatePresence>
            {!collapsed.templates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => navigate('/templates')}
                  className="w-full flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <LayoutGrid className="w-4 h-4 text-gray-500" />
                  <span className="text-[12px] text-gray-600">Browse templates</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* ===== BOTTOM SECTION ===== */}
      <div className="border-t border-gray-100">
        {/* Account */}
        {user ? (
          <div className="px-3 py-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2869D5] to-[#1F56B4] flex items-center justify-center shadow-sm">
                <span className="text-[10px] text-white font-bold">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-gray-800 truncate">
                  {user.email?.split('@')[0]}
                </div>
                <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => navigate('/account')}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 border-t border-gray-100">
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
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!showMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && (target.closest('.nn-sidebar-note-menu') || target.closest('.nn-sidebar-note-menu-trigger'))) return;
      setShowMenu(false);
      setMenuPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        setMenuPosition(null);
      }
    };
    window.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showMenu]);

  return (
    <div className="relative group">
      <div className="nn-sidebar-note-row">
        <button
          type="button"
          onClick={() => navigate(`/editor/${encodeURIComponent(notebook.id)}`)}
          className="nn-sidebar-note-open"
          title={notebook.title}
        >
          {isFavorite ? <Star aria-hidden="true" /> : <FileText aria-hidden="true" />}
          <span>{notebook.title}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            const opening = !showMenu;
            setShowMenu(opening);
            if (opening) {
              const rect = event.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: Math.min(rect.bottom + 5, window.innerHeight - 48), right: Math.max(8, window.innerWidth - rect.right) });
            } else {
              setMenuPosition(null);
            }
          }}
          aria-label={`More actions for ${notebook.title}`}
          aria-expanded={showMenu}
          className="nn-sidebar-note-menu-trigger"
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </div>
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -3 }}
            className="nn-sidebar-note-menu"
            style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { onDelete(notebook.id); setShowMenu(false); setMenuPosition(null); }}
            >
              <Trash2 aria-hidden="true" /> Move to Trash
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
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        {isUnfiled ? (
          <FolderClosed className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span className="text-[12px] font-medium text-gray-700 flex-1 text-left truncate">
          {isUnfiled ? 'My Notes' : folder}
        </span>
        <span className="text-[10px] text-gray-400 tabular-nums">{notebooks.length}</span>
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
