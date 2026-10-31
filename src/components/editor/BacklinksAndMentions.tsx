// ============================================================
// NikNote 4.0 — Backlinks & Mentions System
// Notion-style backlinks showing all pages that reference current page
// @mention system with user/page suggestions
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FileText, AtSign, Link2, ExternalLink,
  Search, Sparkles, ChevronRight, ChevronDown, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Backlink {
  id: string;
  fromPageId: string;
  fromPageTitle: string;
  fromPageIcon?: string;
  contextText: string; // Text surrounding the link
  timestamp: number;
}

interface BacklinksPanelProps {
  backlinks: Backlink[];
  onNavigate: (pageId: string) => void;
  currentPageTitle?: string;
}

const formatTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  backlinks, onNavigate, currentPageTitle
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(true);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return backlinks;
    const q = searchQuery.toLowerCase();
    return backlinks.filter(bl =>
      bl.fromPageTitle.toLowerCase().includes(q) ||
      bl.contextText.toLowerCase().includes(q)
    );
  }, [backlinks, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-subtle">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2"
        >
          {expanded ? <ChevronDown className="w-3 h-3 text-fg-muted/70" /> : <ChevronRight className="w-3 h-3 text-fg-muted/70" />}
          <Link2 className="w-3.5 h-3.5 text-accent-cool" />
          <span className="text-[11px] font-semibold text-fg-primary">Backlinks</span>
          <span className="text-[9px] text-fg-muted/70 tabular-nums">{backlinks.length}</span>
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Search */}
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-muted/70" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter backlinks..."
                  className="w-full text-[10px] bg-muted rounded-lg pl-7 pr-3 py-1.5 border border-subtle focus:border-[color:hsl(var(--primary)/0.3)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
                />
              </div>
            </div>

            {/* List */}
            <div className="px-3 pb-3 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-center py-4">
                  <Link2 className="w-6 h-6 text-fg-muted/70 mx-auto mb-1" />
                  <p className="text-[10px] text-fg-muted/70">No backlinks yet</p>
                  <p className="text-[9px] text-fg-muted/70">Other pages will appear here when they link to this page</p>
                </div>
              ) : (
                filtered.map((bl, i) => (
                  <motion.button
                    key={bl.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => onNavigate(bl.fromPageId)}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-muted border border-subtle hover:border-subtle transition-all group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{bl.fromPageIcon || '📄'}</span>
                      <span className="text-[11px] font-medium text-fg-primary truncate flex-1">{bl.fromPageTitle}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-fg-muted/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[10px] text-fg-muted/70 line-clamp-2 leading-relaxed">
                      ...{bl.contextText.slice(0, 100)}...
                    </p>
                    <span className="text-[8px] text-fg-muted/70 mt-1 block">{formatTime(bl.timestamp)}</span>
                  </motion.button>
                ))
              )}
            </div>

            {/* AI suggest */}
            <div className="px-3 pb-3">
              <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium text-accent-cool bg-[color:hsl(var(--primary)/0.12)] hover:bg-[color:hsl(var(--primary)/0.12)] transition-colors">
                <Sparkles className="w-3 h-3" /> AI find related pages
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================
// @Mention Suggestion Dropdown
// ============================================================

export interface MentionItem {
  id: string;
  type: 'user' | 'page' | 'date';
  label: string;
  icon: string;
  description?: string;
}

interface MentionDropdownProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  isOpen, query, position, onSelect, onClose
}) => {
  const allMentions: MentionItem[] = [
    { id: 'u-1', type: 'user', label: 'Nikhil Jatav', icon: '👤', description: 'Owner' },
    { id: 'u-2', type: 'user', label: 'Rahul Kumar', icon: '👤', description: 'Editor' },
    { id: 'u-3', type: 'user', label: 'Priya Sharma', icon: '👤', description: 'Viewer' },
    { id: 'p-1', type: 'page', label: 'Physics Notes', icon: '📝', description: 'Page' },
    { id: 'p-2', type: 'page', label: 'Math Homework', icon: '📝', description: 'Page' },
    { id: 'p-3', type: 'page', label: 'Chemistry Lab', icon: '📝', description: 'Page' },
    { id: 'd-today', type: 'date', label: 'Today', icon: '📅', description: new Date().toLocaleDateString('en-IN') },
    { id: 'd-tomorrow', type: 'date', label: 'Tomorrow', icon: '📅', description: new Date(Date.now() + 86400000).toLocaleDateString('en-IN') },
  ];

  const filtered = query.trim()
    ? allMentions.filter(m => m.label.toLowerCase().includes(query.toLowerCase()))
    : allMentions;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      className="fixed z-50 w-[220px] max-h-[200px] overflow-y-auto rounded-xl border border-subtle/80 bg-surface/95 backdrop-blur-xl shadow-lg py-1"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map(item => (
        <button
          key={item.id}
          onClick={() => { onSelect(item); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[color:hsl(var(--primary)/0.12)] transition-colors"
        >
          <span className="text-sm">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-fg-primary truncate">{item.label}</div>
            <div className="text-[9px] text-fg-muted/70">{item.description}</div>
          </div>
        </button>
      ))}
    </motion.div>
  );
};
