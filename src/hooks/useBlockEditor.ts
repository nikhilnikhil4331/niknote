// ============================================================
// NikNote 5.0 — Enhanced Block Editor Hook
// Full block operations: duplicate, move, convert, undo/redo
// Auto-save, block validation, performance optimized
// ============================================================

import { useState, useCallback, useMemo, useRef } from 'react';
import { Block, createBlock, BlockType, detectBlockPrefix } from '@/types/block';
import { NoteLine, LineInkColor } from '@/types/noteLine';

interface HistoryEntry {
  blocks: Block[];
  timestamp: number;
}

const MAX_HISTORY = 100;
const AUTO_SAVE_KEY = 'niknote_autosave';

export const useBlockEditor = () => {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    // Try to restore from auto-save
    try {
      const saved = localStorage.getItem(AUTO_SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [createBlock('text', '')];
  });

  // FIX: Use state for history position so canUndo/canRedo trigger re-renders
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);
  const currentColorRef = useRef<LineInkColor>('black');
  const historyRef = useRef<HistoryEntry[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── HISTORY (Undo/Redo) ───
  const pushHistory = useCallback((newBlocks: Block[]) => {
    const entry: HistoryEntry = { blocks: newBlocks, timestamp: Date.now() };
    const history = historyRef.current;

    // Remove future entries if we're not at the end
    const currentIdx = history.length > 0 ? historyIndex : -1;
    if (currentIdx < history.length - 1) {
      historyRef.current = history.slice(0, currentIdx + 1);
    }

    historyRef.current.push(entry);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    const newIdx = historyRef.current.length - 1;
    setHistoryIndex(newIdx);
    setHistoryLength(historyRef.current.length);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      const prev = historyRef.current[newIdx];
      if (prev) {
        setBlocks(prev.blocks);
        setHistoryIndex(newIdx);
      }
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < historyRef.current.length - 1) {
      const newIdx = historyIndex + 1;
      const next = historyRef.current[newIdx];
      if (next) {
        setBlocks(next.blocks);
        setHistoryIndex(newIdx);
      }
    }
  }, [historyIndex]);

  // ─── AUTO-SAVE ───
  const triggerAutoSave = useCallback((newBlocks: Block[]) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(newBlocks));
      } catch {}
    }, 1000);
  }, []);

  // ─── CORE UPDATE ───
  const updateBlocks = useCallback((newBlocks: Block[]) => {
    const final = newBlocks.length > 0 ? newBlocks : [createBlock('text', '')];
    setBlocks(final);
    pushHistory(final);
    triggerAutoSave(final);
  }, [pushHistory, triggerAutoSave]);

  // ─── BLOCK OPERATIONS ───

  const addBlockAfter = useCallback((afterId: string, type: BlockType = 'text', content = '') => {
    const newBlock = createBlock(type, content);
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === afterId);
      if (idx === -1) return [...prev, newBlock];
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
    return newBlock.id;
  }, [pushHistory, triggerAutoSave]);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev; // Don't delete last block
      const next = prev.filter(b => b.id !== id);
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b);
      // Don't push history for every keystroke — only structural changes
      if ('type' in updates || 'checked' in updates || 'collapsed' in updates) {
        pushHistory(next);
      }
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const dup: Block = {
        ...original,
        id: createBlock('text', '').id, // New ID
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  const convertBlock = useCallback((id: string, newType: BlockType) => {
    setBlocks(prev => {
      const next = prev.map(b =>
        b.id === id ? { ...b, type: newType, updatedAt: Date.now() } : b
      );
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  const setCurrentColor = useCallback((color: LineInkColor) => {
    currentColorRef.current = color;
  }, []);

  const updateAllBlockColors = useCallback((color: LineInkColor) => {
    currentColorRef.current = color;
    setBlocks(prev => {
      const next = prev.map(b => ({ ...b, color }));
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  const clearAll = useCallback(() => {
    const next = [createBlock('text', '')];
    setBlocks(next);
    pushHistory(next);
    triggerAutoSave(next);
  }, [pushHistory, triggerAutoSave]);

  // Convert blocks to NoteLine[] for preview — WITH block type info for styling
  const lines: NoteLine[] = useMemo(() => {
    return blocks
      .filter(b => b.type !== 'divider')
      .map((block, i) => {
        let text = block.content;
        let fontSize: number | undefined;
        let fontWeight: string | undefined;
        const blockType = block.type;

        switch (block.type) {
          case 'heading1': fontSize = 28; fontWeight = 'bold'; break;
          case 'heading2': fontSize = 22; fontWeight = 'bold'; break;
          case 'heading3': fontSize = 18; fontWeight = '600'; break;
          case 'bullet': text = `•  ${text}`; break;
          case 'numbered': text = `${i + 1}.  ${text}`; break;
          case 'todo': text = block.checked ? `☑  ${text}` : `☐  ${text}`; break;
          case 'quote': text = `"${text}"`; break;
          case 'callout': text = `${block.emoji || '💡'}  ${text}`; break;
          case 'code': text = `  ${text}`; break;
        }
        return {
          id: `line-${block.id}`,
          text,
          color: (block.color || currentColorRef.current) as LineInkColor,
          timestamp: Date.now(),
          blockType,
          fontSize,
          fontWeight,
          indent: block.indent,
        };
      });
  }, [blocks]);

  const getPlainText = useCallback(() => {
    return blocks.map(b => b.content).join('\n');
  }, [blocks]);

  const importText = useCallback((text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    const newBlocks = lines.map(line => {
      const prefix = detectBlockPrefix(line);
      if (prefix) return createBlock(prefix.type, prefix.remaining);
      return createBlock('text', line);
    });
    setBlocks(prev => {
      const next = prev.length === 1 && !prev[0].content.trim() ? newBlocks : [...prev, ...newBlocks];
      pushHistory(next);
      triggerAutoSave(next);
      return next;
    });
  }, [pushHistory, triggerAutoSave]);

  return {
    blocks,
    setBlocks: updateBlocks,
    lines,
    getPlainText,
    importText,
    setCurrentColor,
    updateAllBlockColors,
    // NEW operations
    addBlockAfter,
    deleteBlock,
    updateBlock,
    duplicateBlock,
    moveBlock,
    convertBlock,
    clearAll,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < historyLength - 1,
  };
};
