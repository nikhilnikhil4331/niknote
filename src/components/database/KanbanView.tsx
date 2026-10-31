// ============================================================
// NikNote 4.0 — Kanban Board View
// Notion-style drag-drop Kanban for task tracking
// AI-powered suggestions, color-coded columns
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Plus, MoreHorizontal, GripVertical, Trash2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  tags?: { label: string; color: string }[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
}

interface KanbanViewProps {
  columns: KanbanColumn[];
  onColumnsChange: (columns: KanbanColumn[]) => void;
  onCardClick?: (card: KanbanCard) => void;
}

const PRIORITY_COLORS = {
  low: 'bg-[color:hsl(var(--success)/0.14)] text-success',
  medium: 'bg-[color:hsl(var(--accent-warm-hsl)/0.16)] text-accent-warm',
  high: 'bg-[color:hsl(var(--error)/0.14)] text-error',
};

export const KanbanView: React.FC<KanbanViewProps> = ({
  columns, onColumnsChange, onCardClick
}) => {
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const addCard = useCallback((columnId: string) => {
    if (!newCardTitle.trim()) return;
    const newCard: KanbanCard = {
      id: `card-${Date.now()}`,
      title: newCardTitle.trim(),
    };
    onColumnsChange(columns.map(col =>
      col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col
    ));
    setNewCardTitle('');
    setAddingToColumn(null);
  }, [columns, newCardTitle, onColumnsChange]);

  const moveCard = useCallback((cardId: string, fromColumnId: string, toColumnId: string) => {
    const fromColumn = columns.find(c => c.id === fromColumnId);
    const toColumn = columns.find(c => c.id === toColumnId);
    if (!fromColumn || !toColumn) return;

    const card = fromColumn.cards.find(c => c.id === cardId);
    if (!card) return;

    onColumnsChange(columns.map(col => {
      if (col.id === fromColumnId) return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
      if (col.id === toColumnId) return { ...col, cards: [...col.cards, card] };
      return col;
    }));
  }, [columns, onColumnsChange]);

  const deleteCard = useCallback((cardId: string, columnId: string) => {
    onColumnsChange(columns.map(col =>
      col.id === columnId ? { ...col, cards: col.cards.filter(c => c.id !== cardId) } : col
    ));
  }, [columns, onColumnsChange]);

  return (
    <div className="kanban-view h-full overflow-x-auto p-4">
      <div className="flex gap-4 h-full min-w-max">
        {columns.map((column) => (
          <div
            key={column.id}
            className="w-[280px] flex-shrink-0 flex flex-col bg-muted rounded-xl"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => {
              e.preventDefault();
              const data = e.dataTransfer.getData('text/plain');
              const [cardId, fromCol] = data.split(':');
              if (cardId && fromCol) moveCard(cardId, fromCol, column.id);
            }}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", column.color)} />
              <span className="text-xs font-semibold text-fg-primary flex-1">{column.title}</span>
              <span className="text-[10px] text-fg-muted/70 tabular-nums">{column.cards.length}</span>
              <button className="p-0.5 rounded hover:bg-surface-hover text-fg-muted/70 hover:text-fg-secondary transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
              {column.cards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  draggable
                  onDragStart={(e) => {
                    setDraggingCard(card.id);
                    const dt = (e as unknown as React.DragEvent).dataTransfer;
                    dt?.setData('text/plain', `${card.id}:${column.id}`);
                    if (dt) dt.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDraggingCard(null)}
                  onClick={() => onCardClick?.(card)}
                  className={cn(
                    "p-3 bg-surface rounded-lg border border-subtle/60 shadow-sm cursor-pointer hover:shadow-md hover:border-active transition-all group",
                    draggingCard === card.id && "opacity-50"
                  )}
                >
                  <div className="text-[12px] font-medium text-fg-primary mb-1">{card.title}</div>
                  {card.description && (
                    <div className="text-[10px] text-fg-muted/70 mb-2 line-clamp-2">{card.description}</div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {card.tags?.map((tag) => (
                      <span
                        key={tag.label}
                        className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", tag.color)}
                      >
                        {tag.label}
                      </span>
                    ))}
                    {card.priority && (
                      <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", PRIORITY_COLORS[card.priority])}>
                        {card.priority}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCard(card.id, column.id); }}
                      className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[color:hsl(var(--error)/0.14)] text-fg-muted/70 hover:text-error transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Add card */}
              {addingToColumn === column.id ? (
                <div className="p-2 bg-surface rounded-lg border border-[color:hsl(var(--primary)/0.3)] shadow-sm">
                  <input
                    autoFocus
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCard(column.id); if (e.key === 'Escape') setAddingToColumn(null); }}
                    placeholder="Card title..."
                    className="w-full text-xs bg-transparent border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] placeholder:text-fg-muted/70"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => addCard(column.id)}
                      className="text-[10px] font-medium px-2 py-1 rounded bg-primary text-white hover:bg-primary transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingToColumn(null); setNewCardTitle(''); }}
                      className="text-[10px] text-fg-muted/70 hover:text-fg-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingToColumn(column.id)}
                  className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-fg-muted/70 hover:text-fg-secondary hover:bg-surface/60 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add card
                </button>
              )}
            </div>
          </div>
        ))}

        {/* AI suggestion column */}
        <div className="w-[280px] flex-shrink-0 flex flex-col items-center justify-center">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-accent-cool hover:bg-[color:hsl(var(--primary)/0.12)] transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            AI suggest columns
          </button>
        </div>
      </div>
    </div>
  );
};
