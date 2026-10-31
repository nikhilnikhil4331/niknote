// ============================================================
// NikNote 4.0 — Multi-Column Layout
// Notion-style column blocks with drag resize
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Columns, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnProps {
  id: string;
  ratio: number; // 0.0 to 1.0
  content: React.ReactNode;
}

interface ColumnLayoutProps {
  columns: ColumnProps[];
  onColumnsChange: (columns: ColumnProps[]) => void;
  onAddColumn?: () => void;
  onRemoveColumn?: (id: string) => void;
  onContentChange?: (columnId: string, content: string) => void;
}

export const ColumnLayout: React.FC<ColumnLayoutProps> = ({
  columns, onColumnsChange, onAddColumn, onRemoveColumn, onContentChange
}) => {
  const [dragging, setDragging] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((e: React.MouseEvent, dividerId: string) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const totalWidth = rect.width;
    const ratio = x / totalWidth;

    // Find the two columns sharing this divider
    const idx = columns.findIndex(c => c.id === dividerId);
    if (idx < 0 || idx >= columns.length - 1) return;

    const leftCol = columns[idx];
    const rightCol = columns[idx + 1];
    const minRatio = 0.2; // Minimum 20% width
    const maxRatio = 0.8; // Maximum 80% width

    const newLeftRatio = Math.max(minRatio, Math.min(maxRatio, ratio));
    const newRightRatio = leftCol.ratio + rightCol.ratio - newLeftRatio;

    if (newRightRatio < minRatio) return;

    const newColumns = [...columns];
    newColumns[idx] = { ...leftCol, ratio: newLeftRatio };
    newColumns[idx + 1] = { ...rightCol, ratio: newRightRatio };
    onColumnsChange(newColumns);
  }, [columns, onColumnsChange]);

  return (
    <div ref={containerRef} className="column-layout flex gap-2 w-full group/column">
      {columns.map((column, idx) => (
        <React.Fragment key={column.id}>
          {/* Column */}
          <div
            className="min-h-[60px] rounded-lg border border-subtle bg-surface/50 p-2"
            style={{ width: `${column.ratio * 100}%`, flexShrink: 0 }}
          >
            {column.content || (
              <div className="text-[11px] text-fg-muted/70 text-center py-6">
                Type '/' for commands
              </div>
            )}
          </div>

          {/* Resize handle */}
          {idx < columns.length - 1 && (
            <div
              onMouseDown={() => setDragging(column.id)}
              onMouseMove={(e) => { if (dragging === column.id) handleDrag(e, column.id); }}
              onMouseUp={() => setDragging(null)}
              onMouseLeave={() => setDragging(null)}
              className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[color:hsl(var(--primary)/0.2)] transition-colors rounded-full group-hover/column:opacity-100 opacity-0 self-stretch my-2"
            />
          )}
        </React.Fragment>
      ))}

      {/* Add column button */}
      {columns.length < 4 && (
        <button
          onClick={onAddColumn}
          className="w-8 flex-shrink-0 rounded-lg border border-dashed border-subtle hover:border-[color:hsl(var(--primary)/0.3)] flex items-center justify-center text-fg-muted/70 hover:text-accent-cool transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
