// ============================================================
// NikNote 4.0 — Workspace Layout (3-Panel Notion-style)
// Sidebar | Content | Properties Panel
// Full responsive, collapsible panels, premium animations
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  PanelLeft, PanelRight, Search, Bell, Plus,
  Scan, Star, Clock, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { CommandPalette } from '@/components/command-palette/CommandPalette';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  title?: string;
  icon?: string;
  breadcrumb?: { label: string; href?: string }[];
  rightPanel?: React.ReactNode;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  lastEdited?: string;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children, title, icon, breadcrumb, rightPanel,
  isFavorite, onToggleFavorite, lastEdited
}) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Keyboard shortcut: Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50/50">
      {/* ===== TOP BAR ===== */}
      <div className="h-11 flex items-center justify-between px-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {breadcrumb.map((crumb, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-gray-300">/</span>}
                  <button
                    onClick={() => crumb.href && navigate(crumb.href)}
                    className="hover:text-gray-600 transition-colors"
                  >
                    {crumb.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Page title */}
          {title && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              {icon && <span>{icon}</span>}
              <span className="truncate max-w-[200px]">{title}</span>
              <button
                onClick={onToggleFavorite}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isFavorite ? "text-amber-500" : "text-gray-300 hover:text-gray-400"
                )}
              >
                <Star className="w-3 h-3" fill={isFavorite ? "currentColor" : "none"} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Search (⌘K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* AI */}
          <button
            onClick={() => navigate('/ai')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-600 shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/95">
              <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-3 w-auto object-contain select-none" />
            </span>
            {!isMobile && 'AI'}
          </button>

          {/* DNA */}
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm hover:shadow-md transition-shadow"
          >
            <Scan className="w-3 h-3" />
            {!isMobile && 'DNA'}
          </button>

          {/* Right panel toggle */}
          {rightPanel && (
            <button
              onClick={() => setRightPanelOpen(p => !p)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          )}

          {/* Notifications */}
          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors relative">
            <Bell className="w-4 h-4" />
            <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== LEFT SIDEBAR ===== */}
        <AnimatePresence>
          {sidebarOpen && (
            <WorkspaceSidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(false)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
          )}
        </AnimatePresence>

        {/* ===== CENTER CONTENT ===== */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* ===== RIGHT PROPERTIES PANEL ===== */}
        <AnimatePresence>
          {rightPanelOpen && rightPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="border-l border-gray-200/60 bg-white/60 backdrop-blur-xl overflow-y-auto flex-shrink-0"
            >
              {rightPanel}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== COMMAND PALETTE ===== */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onToggleSidebar={() => setSidebarOpen(p => !p)}
      />

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
