// ============================================================
// NikNote 4.0 — Version History System
// Track note changes, restore previous versions
// Notion-level version history with timestamps & diffs
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, Plus, ChevronRight, X, Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Version {
  id: string;
  timestamp: number;
  content: string;
  label?: string;
  wordCount: number;
  changeType: 'auto' | 'manual' | 'restore';
  changeDescription?: string;
}

interface VersionHistoryProps {
  versions: Version[];
  currentContent: string;
  onRestore: (version: Version) => void;
  onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions, currentContent, onRestore, onClose
}) => {
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const changeIcon = (type: Version['changeType']) => {
    switch (type) {
      case 'auto': return '💾';
      case 'manual': return '✏️';
      case 'restore': return '🔄';
    }
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="fixed right-0 top-0 bottom-0 w-[340px] bg-surface border-l border-subtle shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-cool" />
            <h3 className="text-sm font-bold text-fg-primary">Version History</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-fg-muted/70">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-fg-muted/70 mt-1">
          {versions.length} versions saved
        </p>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto py-2">
        {versions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-fg-muted/70 mx-auto mb-3" />
            <p className="text-sm text-fg-muted/70">No versions saved yet</p>
            <p className="text-[11px] text-fg-muted/70 mt-1">Versions are saved automatically as you edit</p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {versions.map((version, i) => (
              <motion.button
                key={version.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedVersion(version)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all",
                  selectedVersion?.id === version.id
                    ? "bg-[color:hsl(var(--primary)/0.12)] border border-[color:hsl(var(--primary)/0.3)]"
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{changeIcon(version.changeType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-fg-primary">
                      {version.label || formatDate(version.timestamp)}
                    </div>
                    <div className="text-[10px] text-fg-muted/70">
                      {version.wordCount} words • {formatDate(version.timestamp)}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-fg-muted/70" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Preview / Restore */}
      <AnimatePresence>
        {selectedVersion && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-subtle overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-fg-primary">Preview</span>
                <button
                  onClick={() => onRestore(selectedVersion)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-primary hover:bg-primary transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore
                </button>
              </div>
              <div className="text-[12px] text-fg-secondary line-clamp-6 p-3 bg-muted rounded-lg border border-subtle">
                {selectedVersion.content.slice(0, 500)}
                {selectedVersion.content.length > 500 && '...'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Utility to create versions from content
export function createVersion(
  content: string,
  changeType: Version['changeType'] = 'auto',
  label?: string
): Version {
  return {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    content,
    label,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    changeType,
  };
}
