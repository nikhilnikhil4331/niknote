// ============================================================
// NikNote 4.0 — Gallery View
// Notion-style gallery with cards, covers, properties
// AI-powered auto-covers and organization
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid3X3, List, Plus, Star, MoreHorizontal, Sparkles,
  Image, FileText, Clock, ArrowUpDown, Filter, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GalleryItem {
  id: string;
  title: string;
  coverUrl?: string;
  icon?: string;
  description?: string;
  tags?: { label: string; color: string }[];
  lastEdited?: number;
  isFavorite?: boolean;
  properties?: Record<string, string>;
}

interface GalleryViewProps {
  items: GalleryItem[];
  onItemClick?: (id: string) => void;
  onAddItem?: () => void;
  title?: string;
}

const COVER_COLORS = [
  'linear-gradient(135deg, #44174e 0%, #662249 100%)',
  'linear-gradient(135deg, #662249 0%, #a34054 100%)',
  'linear-gradient(135deg, #a34054 0%, #ed9e59 100%)',
  'linear-gradient(135deg, #e9bcb9 0%, #ed9e59 100%)',
  'linear-gradient(135deg, #1b1931 0%, #44174e 100%)',
  'linear-gradient(135deg, #5c3a6e 0%, #a34054 100%)',
  'linear-gradient(135deg, #662249 0%, #e9bcb9 100%)',
  'linear-gradient(160deg, #ed9e59 0%, #a34054 55%, #662249 100%)',
];

export const GalleryView: React.FC<GalleryViewProps> = ({
  items, onItemClick, onAddItem, title
}) => {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'title' | 'lastEdited'>('lastEdited');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return (b.lastEdited || 0) - (a.lastEdited || 0);
    });
  }, [items, sortBy]);

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="gallery-view">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {title && <h3 className="text-sm font-bold text-fg-primary">{title}</h3>}
          <span className="text-[10px] text-fg-muted/70 tabular-nums">{items.length} items</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Sort */}
          <button
            onClick={() => setSortBy(sortBy === 'title' ? 'lastEdited' : 'title')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-fg-muted hover:bg-muted transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'title' ? 'A-Z' : 'Recent'}
          </button>

          {/* Layout toggle */}
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setLayout('grid')}
              className={cn(
                "p-1 rounded-md transition-colors",
                layout === 'grid' ? "bg-surface shadow-sm text-fg-primary" : "text-fg-muted/70"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayout('list')}
              className={cn(
                "p-1 rounded-md transition-colors",
                layout === 'list' ? "bg-surface shadow-sm text-fg-primary" : "text-fg-muted/70"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      {layout === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sortedItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onItemClick?.(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group cursor-pointer rounded-xl border border-subtle/60 overflow-hidden bg-surface hover:shadow-md hover:border-active transition-all"
            >
              {/* Cover */}
              <div
                className="h-24 relative overflow-hidden"
                style={{
                  background: item.coverUrl
                    ? `url(${item.coverUrl}) center/cover`
                    : COVER_COLORS[i % COVER_COLORS.length]
                }}
              >
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-nk-midnight/0 group-hover:bg-nk-midnight/15 transition-colors" />
                
                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className={cn(
                      "p-1 rounded-md bg-surface/80 backdrop-blur-sm transition-colors",
                      item.isFavorite ? "text-accent-warm" : "text-fg-muted/70"
                    )}
                  >
                    <Star className="w-3 h-3" fill={item.isFavorite ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="p-1 rounded-md bg-surface/80 backdrop-blur-sm text-fg-muted/70"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </div>

                {/* Icon */}
                {item.icon && (
                  <div className="absolute bottom-2 left-2 w-8 h-8 rounded-lg bg-surface shadow-md flex items-center justify-center text-lg">
                    {item.icon}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <h4 className="text-[12px] font-semibold text-fg-primary truncate">{item.title}</h4>
                {item.description && (
                  <p className="text-[10px] text-fg-muted/70 mt-0.5 line-clamp-1">{item.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {item.tags?.slice(0, 2).map(tag => (
                    <span key={tag.label} className={cn("text-[8px] font-medium px-1.5 py-0.5 rounded-full", tag.color)}>
                      {tag.label}
                    </span>
                  ))}
                  {item.lastEdited && (
                    <span className="text-[9px] text-fg-muted/70 ml-auto">{formatTime(item.lastEdited)}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add item card */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onAddItem}
            className="h-48 rounded-xl border-2 border-dashed border-subtle hover:border-[color:hsl(var(--primary)/0.3)] flex flex-col items-center justify-center gap-2 text-fg-muted/70 hover:text-accent-cool transition-colors"
          >
            <Plus className="w-6 h-6" />
            <span className="text-[11px] font-medium">Add new</span>
          </motion.button>
        </div>
      ) : (
        /* List Layout */
        <div className="space-y-0.5">
          {sortedItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onItemClick?.(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
            >
              {/* Mini cover */}
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0"
                style={{ background: COVER_COLORS[i % COVER_COLORS.length] }}
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {item.icon && <span className="text-sm">{item.icon}</span>}
                  <span className="text-[12px] font-medium text-fg-primary truncate">{item.title}</span>
                </div>
                {item.description && (
                  <p className="text-[10px] text-fg-muted/70 truncate">{item.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.tags?.slice(0, 2).map(tag => (
                  <span key={tag.label} className={cn("text-[8px] font-medium px-1.5 py-0.5 rounded-full hidden sm:inline", tag.color)}>
                    {tag.label}
                  </span>
                ))}
                {item.lastEdited && (
                  <span className="text-[9px] text-fg-muted/70">{formatTime(item.lastEdited)}</span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* AI Suggest */}
      <div className="mt-4 flex justify-center">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-accent-cool bg-[color:hsl(var(--primary)/0.12)] hover:bg-[color:hsl(var(--primary)/0.12)] transition-colors">
          <Sparkles className="w-3.5 h-3.5" />
          AI auto-organize & suggest covers
        </button>
      </div>
    </div>
  );
};
