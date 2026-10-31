// ============================================================
// NikNote 4.0 — Page Cover & Icon System
// Notion-style page headers with covers, emojis, and breadcrumbs
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Smile, MoreHorizontal, Star, Share2, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  icon?: string;
  coverUrl?: string;
  onTitleChange?: (title: string) => void;
  onIconChange?: (icon: string) => void;
  onCoverChange?: (url: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  lastEdited?: string;
  breadcrumb?: { label: string; href?: string }[];
}

const EMOJI_OPTIONS = [
  '📝', '📚', '🔬', '💡', '🎨', '📊', '🎯', '🚀', '💻', '🌍',
  '📖', '✏️', '🧠', '⚡', '🎵', '🏆', '📐', '🔬', '🧪', '💻',
  '📐', '📊', '📋', '🗂️', '📁', '📌', '🔖', '📌', '🎓', '🧑‍🎓',
];

const COVER_GRADIENTS = [
  'linear-gradient(135deg, #44174e 0%, #662249 100%)',
  'linear-gradient(135deg, #662249 0%, #a34054 100%)',
  'linear-gradient(135deg, #a34054 0%, #ed9e59 100%)',
  'linear-gradient(135deg, #e9bcb9 0%, #ed9e59 100%)',
  'linear-gradient(135deg, #1b1931 0%, #44174e 100%)',
  'linear-gradient(135deg, #5c3a6e 0%, #a34054 100%)',
  'linear-gradient(135deg, #662249 0%, #e9bcb9 100%)',
  'linear-gradient(160deg, #ed9e59 0%, #a34054 55%, #662249 100%)',
];

export const PageHeader: React.FC<PageHeaderProps> = ({
  title, icon, coverUrl, onTitleChange, onIconChange, onCoverChange,
  isFavorite, onToggleFavorite, lastEdited, breadcrumb
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  return (
    <div className="page-header">
      {/* Cover Image */}
      {(coverUrl || showCoverPicker) && (
        <div className="relative w-full h-48 md:h-64 overflow-hidden group">
          <div
            className="w-full h-full bg-cover bg-center"
            style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          >
            {!coverUrl && (
              <div className="w-full h-full" style={{ background: COVER_GRADIENTS[0] }} />
            )}
          </div>
          <div className="absolute inset-0 bg-nk-midnight/0 group-hover:bg-nk-midnight/15 transition-colors" />
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
            <button
              onClick={() => setShowCoverPicker(true)}
              className="px-2.5 py-1 rounded-lg bg-surface/80 backdrop-blur-sm text-xs font-medium hover:bg-surface transition-colors"
            >
              Change cover
            </button>
            <button
              onClick={() => onCoverChange?.('')}
              className="px-2.5 py-1 rounded-lg bg-surface/80 backdrop-blur-sm text-xs font-medium hover:bg-surface transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Cover Picker Modal */}
      <AnimatePresence>
        {showCoverPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-x-0 top-0 z-50 bg-surface rounded-2xl shadow-xl border border-subtle p-4 max-w-md mx-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Choose Cover</span>
              <button onClick={() => setShowCoverPicker(false)} className="text-fg-muted/70 hover:text-fg-secondary">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {COVER_GRADIENTS.map((gradient, i) => (
                <button
                  key={i}
                  onClick={() => { onCoverChange?.(gradient); setShowCoverPicker(false); }}
                  className="h-14 rounded-lg hover:ring-2 ring-primary transition-all"
                  style={{ background: gradient }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Area */}
      <div className="max-w-3xl mx-auto px-4 md:px-12 -mt-4 relative">
        <div className="flex items-start gap-2 mb-1">
          {/* Page Icon */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-12 h-12 rounded-xl bg-surface shadow-md flex items-center justify-center text-2xl hover:bg-muted transition-colors border border-subtle"
            >
              {icon || '📝'}
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  className="absolute top-full left-0 mt-1 z-50 bg-surface rounded-xl shadow-xl border border-subtle p-3 w-64"
                >
                  <div className="text-[10px] font-semibold text-fg-muted/70 uppercase tracking-wider mb-2">Choose Icon</div>
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => { onIconChange?.(emoji); setShowEmojiPicker(false); }}
                        className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 mt-1 ml-auto">
            {!coverUrl && (
              <button
                onClick={() => setShowCoverPicker(true)}
                className="p-1.5 rounded-lg hover:bg-muted text-fg-muted/70 hover:text-fg-secondary transition-colors"
                title="Add cover"
              >
                <Image className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onToggleFavorite}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isFavorite ? "text-accent-warm hover:bg-[color:hsl(var(--accent-warm-hsl)/0.16)]" : "text-fg-muted/70 hover:bg-muted hover:text-fg-secondary"
              )}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted text-fg-muted/70 hover:text-fg-secondary transition-colors" title="Share">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-fg-muted/70 mb-2 ml-14">
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-fg-muted/70">/</span>}
                <span className="hover:text-fg-secondary cursor-pointer">{crumb.label}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Title */}
        {isEditingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
            className="w-full text-3xl font-bold text-fg-primary bg-transparent border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] placeholder:text-fg-muted/70"
            placeholder="Untitled"
          />
        ) : (
          <h1
            onClick={() => setIsEditingTitle(true)}
            className="text-3xl font-bold text-fg-primary cursor-text hover:text-fg-primary transition-colors"
          >
            {title || <span className="text-fg-muted/70">Untitled</span>}
          </h1>
        )}

        {/* Meta */}
        {lastEdited && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-fg-muted/70">
            <Clock className="w-3 h-3" />
            <span>Last edited {lastEdited}</span>
          </div>
        )}
      </div>
    </div>
  );
};
