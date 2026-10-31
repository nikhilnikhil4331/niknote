// ============================================================
// NikNote 4.0 — Quick Search / Quick Find
// Notion-style search: instant, filtered, keyboard navigable
// Search across pages, blocks, AI history
// ============================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, FileText, Clock, Sparkles, Hash,
  ArrowRight, Command, X, Brain, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'page' | 'block' | 'ai' | 'recent';
  title: string;
  preview?: string;
  icon?: React.ReactNode;
  timestamp?: number;
}

interface QuickSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export const QuickSearch: React.FC<QuickSearchProps> = ({
  isOpen, onClose, onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock search results (in production, would search Supabase)
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      return [
        { id: 'recent-1', type: 'recent', title: 'Physics Notes - Chapter 5', icon: <Clock className="w-3.5 h-3.5 text-fg-muted/70" />, timestamp: Date.now() - 3600000 },
        { id: 'recent-2', type: 'recent', title: 'Math Homework', icon: <Clock className="w-3.5 h-3.5 text-fg-muted/70" />, timestamp: Date.now() - 7200000 },
        { id: 'recent-3', type: 'recent', title: 'Chemistry Lab Report', icon: <Clock className="w-3.5 h-3.5 text-fg-muted/70" />, timestamp: Date.now() - 86400000 },
      ];
    }

    const q = query.toLowerCase();
    const allResults: SearchResult[] = [
      { id: 'page-1', type: 'page', title: 'Physics Notes - Chapter 5', preview: 'Light, Reflection, Refraction...', icon: <FileText className="w-3.5 h-3.5 text-accent-cool" /> },
      { id: 'page-2', type: 'page', title: 'Math Homework', preview: 'Integration and Differentiation', icon: <FileText className="w-3.5 h-3.5 text-success" /> },
      { id: 'page-3', type: 'page', title: 'Chemistry Lab Report', preview: 'Acid Base Titration', icon: <FileText className="w-3.5 h-3.5 text-accent-cool" /> },
      { id: 'page-4', type: 'page', title: 'English Essay', preview: 'My Country India', icon: <FileText className="w-3.5 h-3.5 text-accent-warm" /> },
      { id: 'ai-1', type: 'ai', title: 'AI: Explain Newton\'s Laws', preview: 'Generated explanation with examples', icon: <Sparkles className="w-3.5 h-3.5 text-accent-cool" /> },
      { id: 'ai-2', type: 'ai', title: 'AI: Quiz on Periodic Table', preview: '10 MCQ questions generated', icon: <Brain className="w-3.5 h-3.5 text-accent-cool" /> },
      { id: 'block-1', type: 'block', title: 'Heading: Important Formulae', preview: 'F = ma, E = mc²', icon: <Hash className="w-3.5 h-3.5 text-fg-muted/70" /> },
    ];

    return allResults.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.preview?.toLowerCase().includes(q)
    );
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const result = results[selectedIndex];
        if (result) { onNavigate(result.id); onClose(); }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onNavigate, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[color:var(--nk-scrim)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-0 top-[12%] z-[101] mx-auto w-[520px] max-w-[90vw] overflow-hidden rounded-2xl border border-[color:var(--nk-glass-border)] bg-surface/90 backdrop-blur-2xl shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
              <Search className="w-5 h-5 text-fg-muted/70 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages, blocks, AI results..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                className="flex-1 bg-transparent border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] text-base text-fg-primary placeholder:text-fg-muted/70"
              />
              <kbd className="text-[10px] font-mono text-fg-muted/70 bg-muted px-1.5 py-0.5 rounded border border-subtle">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[350px] overflow-y-auto py-2">
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-fg-muted/70 mx-auto mb-2" />
                  <p className="text-sm text-fg-muted/70">No results found</p>
                  <p className="text-[11px] text-fg-muted/70 mt-1">Try a different search term</p>
                </div>
              ) : (
                <>
                  {!query.trim() && (
                    <div className="px-4 py-1 text-[10px] font-semibold text-fg-muted/70 uppercase tracking-wider">Recent</div>
                  )}
                  {results.map((result, idx) => (
                    <button
                      key={result.id}
                      onClick={() => { onNavigate(result.id); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        idx === selectedIndex ? "bg-[color:hsl(var(--primary)/0.12)]" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                        idx === selectedIndex ? "bg-[color:hsl(var(--primary)/0.12)]" : "bg-muted"
                      )}>
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-fg-primary truncate">{result.title}</div>
                        {result.preview && (
                          <div className="text-[11px] text-fg-muted/70 truncate">{result.preview}</div>
                        )}
                      </div>
                      {result.timestamp && (
                        <span className="text-[10px] text-fg-muted/70 flex-shrink-0">{formatTimestamp(result.timestamp)}</span>
                      )}
                      {idx === selectedIndex && (
                        <ArrowRight className="w-3.5 h-3.5 text-accent-cool flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-subtle text-[10px] text-fg-muted/70">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Open</span>
                <span>ESC Close</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-accent-cool" />
                <span className="text-accent-cool">NikNote Search</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
