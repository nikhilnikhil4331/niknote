// ============================================================
// NikNote 4.0 — Command Palette (Cmd+K)
// Inspired by Notion, Linear, and VS Code
// Quick access to every action, page, and AI feature
// ============================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, FileText, Sparkles, Plus, Settings, Palette, 
  Download, Share2, Moon, Sun, Trash2, RotateCcw,
  BookOpen, Brain, Image, Table, Hash, Code,
  ArrowRight, Command, Clock, Star, ChevronRight,
  LayoutGrid, Scan, Edit3, Mic, PenTool, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NikAIMarkIcon } from '@/components/nikai/NikAIBrand';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: 'action' | 'page' | 'ai' | 'recent' | 'block';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewNote?: () => void;
  onToggleTheme?: () => void;
  onToggleSidebar?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen, onClose, onNewNote, onToggleTheme, onToggleSidebar
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // All commands
  const commands: CommandItem[] = useMemo(() => [
    // Pages
    { id: 'home', label: 'Go to Home', icon: <FileText className="w-4 h-4" />, category: 'page', action: () => navigate('/') },
    { id: 'ai', label: 'NikAI (Astra Core)', icon: <NikAIMarkIcon className="w-[18px] h-[18px]" />, category: 'page', action: () => navigate('/ai') },
    { id: 'notebooks', label: 'My Notebooks', icon: <BookOpen className="w-4 h-4" />, category: 'page', action: () => navigate('/notebooks') },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" />, category: 'page', action: () => navigate('/documents') },
    { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" />, category: 'page', action: () => navigate('/history') },
    { id: 'achievements', label: 'Achievements', icon: <Star className="w-4 h-4 text-amber-500" />, category: 'page', action: () => navigate('/achievements') },
    { id: 'account', label: 'Account Settings', icon: <Settings className="w-4 h-4" />, category: 'page', action: () => navigate('/account') },
    { id: 'blog', label: 'Blog', icon: <Edit3 className="w-4 h-4" />, category: 'page', action: () => navigate('/blog') },

    // Actions
    { id: 'new-note', label: 'New Note', description: 'Create a new note', icon: <Plus className="w-4 h-4 text-blue-500" />, shortcut: '⌘N', category: 'action', action: () => onNewNote?.() },
    { id: 'export-pdf', label: 'Export as PDF', icon: <Download className="w-4 h-4" />, category: 'action', action: () => {} },
    { id: 'share', label: 'Share Note', icon: <Share2 className="w-4 h-4" />, category: 'action', action: () => {} },
    { id: 'toggle-theme', label: 'Toggle Dark Mode', icon: <Moon className="w-4 h-4" />, category: 'action', action: () => onToggleTheme?.() },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', icon: <LayoutGrid className="w-4 h-4" />, shortcut: '⌘\\', category: 'action', action: () => onToggleSidebar?.() },
    { id: 'reset', label: 'Reset Note', icon: <RotateCcw className="w-4 h-4" />, category: 'action', action: () => {} },
    { id: 'delete', label: 'Delete Note', icon: <Trash2 className="w-4 h-4 text-red-500" />, category: 'action', action: () => {} },

    // NikAI Powers
    { id: 'ai-write', label: 'NikAI Smart Notes', description: 'Generate multi-ink notes & flashcards', icon: <NikAIMarkIcon className="w-[18px] h-[18px]" />, category: 'ai', action: () => navigate('/ai') },
    { id: 'ai-solve', label: 'NikAI Solver & Pro Reasoning', description: 'Solve math, science & coding step by step', icon: <NikAIMarkIcon className="w-[18px] h-[18px]" />, category: 'ai', action: () => navigate('/ai') },
    { id: 'ai-dna', label: 'Handwriting DNA Scanner', description: 'Scan handwriting DNA', icon: <Scan className="w-4 h-4 text-emerald-500" />, category: 'ai', action: () => {} },
    { id: 'ai-quiz', label: 'NikAI Live Quiz', description: 'Play interactive 5-MCQ test', icon: <NikAIMarkIcon className="w-[18px] h-[18px]" />, category: 'ai', action: () => navigate('/ai') },
    { id: 'ai-flashcards', label: 'NikAI Flashcards', description: 'Extract flashcards automatically', icon: <NikAIMarkIcon className="w-[18px] h-[18px]" />, category: 'ai', action: () => navigate('/ai') },
    { id: 'ai-explain', label: 'AI Explain', description: 'Explain selected text', icon: <NikAIMarkIcon className="w-[18px] h-[18px]" />, category: 'ai', action: () => {} },
    { id: 'ai-translate', label: 'AI Translate', description: 'Translate to Hindi/English', icon: <Hash className="w-4 h-4 text-green-500" />, category: 'ai', action: () => {} },
    { id: 'ai-dictate', label: 'Voice Dictation', description: 'Type with your voice', icon: <Mic className="w-4 h-4 text-red-500" />, category: 'ai', action: () => {} },

    // Blocks
    { id: 'block-heading1', label: 'Heading 1', icon: <Hash className="w-4 h-4" />, category: 'block', action: () => {} },
    { id: 'block-heading2', label: 'Heading 2', icon: <Hash className="w-4 h-4" />, category: 'block', action: () => {} },
    { id: 'block-heading3', label: 'Heading 3', icon: <Hash className="w-4 h-4" />, category: 'block', action: () => {} },
    { id: 'block-bullet', label: 'Bullet List', icon: <span className="text-sm font-bold">•</span>, category: 'block', action: () => {} },
    { id: 'block-todo', label: 'To-do List', icon: <span className="text-sm">☐</span>, category: 'block', action: () => {} },
    { id: 'block-code', label: 'Code Block', icon: <Code className="w-4 h-4" />, category: 'block', action: () => {} },
    { id: 'block-table', label: 'Table', icon: <Table className="w-4 h-4" />, category: 'block', action: () => {} },
    { id: 'block-image', label: 'Image', icon: <Image className="w-4 h-4" />, category: 'block', action: () => {} },
    { id: 'block-equation', label: 'Equation', icon: <span className="text-sm">∑</span>, category: 'block', action: () => {} },
    { id: 'block-divider', label: 'Divider', icon: <span className="text-sm">—</span>, category: 'block', action: () => {} },
    { id: 'block-callout', label: 'Callout', icon: <span className="text-sm">💡</span>, category: 'block', action: () => {} },
    { id: 'block-toggle', label: 'Toggle', icon: <span className="text-sm">▶</span>, category: 'block', action: () => {} },
  ], [navigate, onNewNote, onToggleTheme, onToggleSidebar]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Group filtered commands by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = [];
    const categoryOrder = ['page', 'action', 'ai', 'block'];
    const categoryLabels: Record<string, string> = {
      page: '📄 Pages',
      action: '⚡ Actions',
      ai: '✨ AI Features',
      block: '📦 Blocks',
      recent: '🕐 Recent',
    };

    for (const cat of categoryOrder) {
      const items = filteredCommands.filter(c => c.category === cat);
      if (items.length > 0) {
        groups.push({ category: categoryLabels[cat] || cat, items });
      }
    }
    return groups;
  }, [filteredCommands]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) { cmd.action(); onClose(); }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-0 top-[15%] z-[101] mx-auto w-[560px] max-w-[90vw] overflow-hidden rounded-2xl border border-white/20 bg-white/80 backdrop-blur-2xl shadow-2xl"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                className="flex-1 bg-transparent border-0 outline-none text-base text-gray-900 placeholder:text-gray-400"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 rounded border border-gray-200">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
              {grouped.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No results for "{query}"
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.category}>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {group.category}
                    </div>
                    {group.items.map((item) => {
                      const flatIndex = filteredCommands.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          data-index={flatIndex}
                          onClick={() => { item.action(); onClose(); }}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                            flatIndex === selectedIndex
                              ? "bg-indigo-50 text-indigo-900"
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            flatIndex === selectedIndex ? "bg-indigo-100" : "bg-gray-100"
                          )}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            {item.description && (
                              <div className="text-[11px] text-gray-400 truncate">{item.description}</div>
                            )}
                          </div>
                          {item.shortcut && (
                            <kbd className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              {item.shortcut}
                            </kbd>
                          )}
                          {flatIndex === selectedIndex && (
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">↑↓ Navigate</span>
                <span className="flex items-center gap-1">↵ Select</span>
                <span className="flex items-center gap-1">ESC Close</span>
              </div>
              <span className="text-indigo-400 font-medium">NikNote</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
