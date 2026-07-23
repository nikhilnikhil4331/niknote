import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Trash2, Plus, Palette, ChevronRight, Sparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Block, BlockType, createBlock, detectBlockPrefix, generateBlockId } from '@/types/block';
import { SlashCommandMenu } from './SlashCommandMenu';
import { InlineAIMenu } from './InlineAIMenu';
import { MentionPopup, MentionItem } from './MentionPopup';
import { BlockCommentsThread } from './BlockCommentsThread';
import { LineInkColor, LINE_INK_COLORS } from '@/types/noteLine';

interface BlockEditorProps {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  currentColor?: LineInkColor;
  onColorChange?: (color: LineInkColor) => void;
  notebookId?: string | null;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ blocks, onBlocksChange, currentColor = 'blue', onColorChange, notebookId = null }) => {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string; position: { top: number; left: number } } | null>(null);
  const [mentionMenu, setMentionMenu] = useState<{ blockId: string; query: string; anchor: number; position: { top: number; left: number } } | null>(null);
  const [showInlineColor, setShowInlineColor] = useState<string | null>(null);
  const [typingBlockId, setTypingBlockId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTargetId, setAiTargetId] = useState<string | null>(null);
  const [commentBlockId, setCommentBlockId] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const typingTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Tasks derived from todo blocks — feeds MentionPopup
  const mentionTasks = useMemo<MentionItem[]>(() =>
    blocks.filter(b => b.type === 'todo' && b.content.trim())
      .map(b => ({ id: b.id, type: 'task' as const, label: b.content.slice(0, 60) })),
    [blocks]
  );

  // Focus a block by id
  const focusBlock = useCallback((id: string, cursorPos?: number) => {
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(id);
      if (el) {
        el.focus();
        if (cursorPos !== undefined) {
          el.setSelectionRange(cursorPos, cursorPos);
        }
      }
    });
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    onBlocksChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  }, [blocks, onBlocksChange]);

  const addBlockAfter = useCallback((afterId: string, type: BlockType = 'text', content = ''): string => {
    const newBlock = createBlock(type, content);
    newBlock.color = currentColor;
    const idx = blocks.findIndex(b => b.id === afterId);
    const newBlocks = [...blocks];
    newBlocks.splice(idx + 1, 0, newBlock);
    onBlocksChange(newBlocks);
    focusBlock(newBlock.id, 0);
    return newBlock.id;
  }, [blocks, onBlocksChange, focusBlock, currentColor]);

  const removeBlock = useCallback((id: string) => {
    if (blocks.length <= 1) {
      updateBlock(id, { content: '', type: 'text' });
      return;
    }
    const idx = blocks.findIndex(b => b.id === id);
    const prevBlock = blocks[idx - 1];
    onBlocksChange(blocks.filter(b => b.id !== id));
    if (prevBlock) {
      focusBlock(prevBlock.id, prevBlock.content.length);
    }
  }, [blocks, onBlocksChange, updateBlock, focusBlock]);

  const handleTextChange = useCallback((blockId: string, text: string) => {
    // Typing animation
    setTypingBlockId(blockId);
    const existing = typingTimerRef.current.get(blockId);
    if (existing) clearTimeout(existing);
    typingTimerRef.current.set(blockId, setTimeout(() => setTypingBlockId(null), 800));

    // Check for slash command
    if (text === '/') {
      const el = inputRefs.current.get(blockId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashMenu({
          blockId,
          query: '',
          position: { top: rect.bottom + 4, left: rect.left },
        });
      }
      updateBlock(blockId, { content: text });
      return;
    }

    // Update slash menu query
    if (slashMenu?.blockId === blockId && text.startsWith('/')) {
      setSlashMenu(prev => prev ? { ...prev, query: text.slice(1) } : null);
      updateBlock(blockId, { content: text });
      return;
    }

    // Close slash menu if '/' removed
    if (slashMenu?.blockId === blockId && !text.startsWith('/')) {
      setSlashMenu(null);
    }

    // Detect prefix shortcuts
    const prefixMatch = detectBlockPrefix(text);
    if (prefixMatch) {
      updateBlock(blockId, { type: prefixMatch.type, content: prefixMatch.remaining });
      focusBlock(blockId, prefixMatch.remaining.length);
      return;
    }

    updateBlock(blockId, { content: text });
  }, [updateBlock, slashMenu, focusBlock]);

  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!slashMenu) return;
    const { blockId } = slashMenu;

    // Template content for each block type — instant working templates
    const templates: Partial<Record<BlockType, { content: string; extra?: Partial<Block> }>> = {
      text: { content: '' },
      heading1: { content: 'Heading 1' },
      heading2: { content: 'Heading 2' },
      heading3: { content: 'Heading 3' },
      bullet: { content: '' },
      numbered: { content: '' },
      todo: { content: '', extra: { checked: false } },
      quote: { content: 'Enter your quote here...' },
      callout: { content: 'Important note', extra: { emoji: '💡' } },
      divider: { content: '' },
      code: { content: '// Your code here\nconsole.log("Hello, NikNote!");', extra: { language: 'javascript' } },
      toggle: { content: 'Click to expand', extra: { collapsed: true } },
      equation: { content: 'E = mc^2' },
      image: { content: '', extra: { url: '', caption: 'Add image description' } },
      bookmark: { content: 'NikNote — AI Study App', extra: { url: 'https://niknote.online' } },
      video: { content: '', extra: { url: '', caption: '' } },
      audio: { content: '', extra: { url: '', caption: '' } },
      embed: { content: '', extra: { url: '' } },
      pdf: { content: '', extra: { url: '' } },
      file: { content: '', extra: { url: '' } },
      table: { content: '', extra: { tableData: { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [[{id:'c1',content:'',type:'text' as const},{id:'c2',content:'',type:'text' as const},{id:'c3',content:'',type:'text' as const}], [{id:'c4',content:'',type:'text' as const},{id:'c5',content:'',type:'text' as const},{id:'c6',content:'',type:'text' as const}]], colCount: 3 } } },
      column: { content: '' },
      'ai-generated': { content: '✨ AI will generate content here...' },
      mermaid: { content: 'graph TD\n  A[Start] --> B[Process]\n  B --> C[End]' },
      synced: { content: '', extra: { syncId: `sync-${Date.now()}` } },
      breadcrumb: { content: 'Home > Notes > Topic' },
      'table_of_contents': { content: '📋 Table of Contents (Auto-generated)' },
      mention: { content: '@user' },
      comment: { content: '💬 Add a comment...' },
    };

    if (type === 'divider') {
      updateBlock(blockId, { type: 'divider', content: '' });
      addBlockAfter(blockId);
    } else {
      const template = templates[type];
      const updates: Partial<Block> = {
        type,
        content: template?.content || '',
        ...template?.extra,
      };
      updateBlock(blockId, updates);
      // For blocks that need a new block after (like image, bookmark)
      if (['image', 'bookmark', 'video', 'audio', 'embed', 'pdf', 'divider', 'table', 'equation'].includes(type)) {
        setTimeout(() => addBlockAfter(blockId, 'text', ''), 50);
      }
      focusBlock(blockId, 0);
    }
    setSlashMenu(null);
  }, [slashMenu, updateBlock, addBlockAfter, focusBlock]);

  const handleKeyDown = useCallback((blockId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    if (slashMenu?.blockId === blockId) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const cursorPos = el.selectionStart;
      const before = block.content.slice(0, cursorPos);
      const after = block.content.slice(cursorPos);

      if (!block.content.trim() && ['bullet', 'numbered', 'todo'].includes(block.type)) {
        updateBlock(blockId, { type: 'text' });
        return;
      }

      updateBlock(blockId, { content: before });
      const nextType = ['bullet', 'numbered', 'todo'].includes(block.type) ? block.type : 'text';
      addBlockAfter(blockId, nextType, after);
    }

    if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      if (block.type !== 'text') {
        e.preventDefault();
        updateBlock(blockId, { type: 'text' });
        return;
      }
      const idx = blocks.findIndex(b => b.id === blockId);
      if (idx > 0) {
        e.preventDefault();
        const prevBlock = blocks[idx - 1];
        if (prevBlock.type === 'divider') {
          removeBlock(prevBlock.id);
          return;
        }
        const mergePos = prevBlock.content.length;
        updateBlock(prevBlock.id, { content: prevBlock.content + block.content });
        removeBlock(blockId);
        focusBlock(prevBlock.id, mergePos);
      }
    }

    if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0) {
      const idx = blocks.findIndex(b => b.id === blockId);
      if (idx > 0) {
        e.preventDefault();
        focusBlock(blocks[idx - 1].id, blocks[idx - 1].content.length);
      }
    }

    if (e.key === 'ArrowDown') {
      const el = e.currentTarget;
      if (el.selectionStart === el.value.length) {
        const idx = blocks.findIndex(b => b.id === blockId);
        if (idx < blocks.length - 1) {
          e.preventDefault();
          focusBlock(blocks[idx + 1].id, 0);
        }
      }
    }

    if (e.key === 'Tab' && ['bullet', 'numbered', 'todo'].includes(block.type)) {
      e.preventDefault();
      const currentIndent = block.indent || 0;
      if (e.shiftKey) {
        updateBlock(blockId, { indent: Math.max(0, currentIndent - 1) });
      } else {
        updateBlock(blockId, { indent: Math.min(3, currentIndent + 1) });
      }
    }
  }, [blocks, slashMenu, updateBlock, addBlockAfter, removeBlock, focusBlock]);

  const handleAddBlock = useCallback(() => {
    const lastBlock = blocks[blocks.length - 1];
    addBlockAfter(lastBlock.id);
  }, [blocks, addBlockAfter]);

  // Handle paste — auto split into new lines
  const handlePaste = useCallback((blockId: string, e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const lines = text.replace(/\r/g, '').split('\n');
    if (lines.length <= 1) {
      // Single line — just insert
      const el = e.currentTarget as HTMLTextAreaElement;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const newContent = block.content.slice(0, start) + text + block.content.slice(end);
      updateBlock(blockId, { content: newContent });
      setTimeout(() => focusBlock(blockId, start + text.length), 0);
      return;
    }

    // Multi-line — split into separate blocks
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const el = e.currentTarget as HTMLTextAreaElement;
    const cursorPos = el.selectionStart;
    const beforeCursor = block.content.slice(0, cursorPos);
    const afterCursor = block.content.slice(el.selectionEnd);

    // Update current block with first line
    updateBlock(blockId, { content: beforeCursor + lines[0] });

    // Create new blocks for remaining lines
    const newBlocks: Block[] = [];
    for (let i = 1; i < lines.length; i++) {
      const nb = createBlock('text', lines[i]);
      nb.color = currentColor;
      newBlocks.push(nb);
    }

    // Add afterCursor to last new block
    if (newBlocks.length > 0) {
      newBlocks[newBlocks.length - 1].content += afterCursor;
    } else {
      updateBlock(blockId, { content: beforeCursor + lines[0] + afterCursor });
    }

    // Insert all new blocks after current
    const idx = blocks.findIndex(b => b.id === blockId);
    const updated = [...blocks];
    updated.splice(idx + 1, 0, ...newBlocks);
    onBlocksChange(updated);

    // Focus last new block
    if (newBlocks.length > 0) {
      setTimeout(() => focusBlock(newBlocks[newBlocks.length - 1].id, newBlocks[newBlocks.length - 1].content.length), 50);
    }
  }, [blocks, onBlocksChange, updateBlock, focusBlock, currentColor]);

  return (
    <div className="block-editor relative">
      <Reorder.Group
        axis="y"
        values={blocks}
        onReorder={onBlocksChange}
        className="space-y-0.5"
      >
        {blocks.map((block, idx) => (
          <BlockContainer
            key={block.id}
            block={block}
            index={idx}
            totalBlocks={blocks.length}
            isFocused={focusedBlockId === block.id}
            isTyping={typingBlockId === block.id}
            currentColor={currentColor}
            showInlineColor={showInlineColor === block.id}
            onFocus={() => { setFocusedBlockId(block.id); setShowInlineColor(null); }}
            onTextChange={(text) => handleTextChange(block.id, text)}
            onKeyDown={(e) => handleKeyDown(block.id, e)}
            onPaste={(e) => handlePaste(block.id, e)}
            onToggleTodo={() => updateBlock(block.id, { checked: !block.checked })}
            onToggleCollapse={() => updateBlock(block.id, { collapsed: !block.collapsed })}
            onDelete={() => removeBlock(block.id)}
            onToggleColor={() => setShowInlineColor(showInlineColor === block.id ? null : block.id)}
            onColorPick={(color) => { updateBlock(block.id, { color }); onColorChange?.(color); setShowInlineColor(null); }}
            inputRef={(el) => {
              if (el) inputRefs.current.set(block.id, el);
              else inputRefs.current.delete(block.id);
            }}
          />
        ))}
      </Reorder.Group>

      {/* Add block button */}
      <button
        onClick={handleAddBlock}
        className="flex items-center gap-2 w-full px-3 py-2 mt-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors group"
      >
        <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          Add a block, or type <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded font-mono">/</kbd> for commands
        </span>
      </button>

      {/* Slash Command Menu */}
      <SlashCommandMenu
        isOpen={!!slashMenu}
        query={slashMenu?.query || ''}
        position={slashMenu?.position || { top: 0, left: 0 }}
        onSelect={handleSlashSelect}
        onClose={() => setSlashMenu(null)}
      />

      {/* Floating Ask AI button — mobile-first, always reachable */}
      <button
        type="button"
        onClick={() => {
          const targetId = focusedBlockId || blocks[blocks.length - 1]?.id || null;
          setAiTargetId(targetId);
          setAiOpen(true);
        }}
        aria-label="Ask AI"
        className="fixed z-40 bottom-24 right-4 sm:bottom-6 sm:right-6 h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Inline AI menu */}
      {(() => {
        const targetIdx = blocks.findIndex(b => b.id === aiTargetId);
        const target = targetIdx >= 0 ? blocks[targetIdx] : null;
        const targetText = target?.content || '';
        const ctx = targetIdx >= 0
          ? [blocks[targetIdx - 1]?.content, blocks[targetIdx + 1]?.content].filter(Boolean).join('\n')
          : '';
        return (
          <InlineAIMenu
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            text={targetText}
            context={ctx}
            onAccept={(newText) => {
              if (!aiTargetId) return;
              const t = blocks.find(b => b.id === aiTargetId);
              if (!t) return;
              // If block was empty or "continue" style, append; otherwise replace.
              const shouldAppend = (t.content || '').trim().length > 0 && newText.startsWith(t.content.trim());
              const finalText = shouldAppend ? newText : newText;
              updateBlock(aiTargetId, { content: finalText });
            }}
          />
        );
      })()}
    </div>
  );
};

// Individual block container
interface BlockContainerProps {
  block: Block;
  index: number;
  totalBlocks: number;
  isFocused: boolean;
  isTyping: boolean;
  currentColor: LineInkColor;
  showInlineColor: boolean;
  onFocus: () => void;
  onTextChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onToggleTodo: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onToggleColor: () => void;
  onColorPick: (color: LineInkColor) => void;
  inputRef: (el: HTMLTextAreaElement | null) => void;
}

const BlockContainer: React.FC<BlockContainerProps> = ({
  block, index, isFocused, isTyping, currentColor, showInlineColor,
  onFocus, onTextChange, onKeyDown, onPaste, onToggleTodo, onToggleCollapse, onDelete,
  onToggleColor, onColorPick, inputRef,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [block.content]);

  const setRef = useCallback((el: HTMLTextAreaElement | null) => {
    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    inputRef(el);
  }, [inputRef]);

  if (block.type === 'divider') {
    return (
      <Reorder.Item value={block} dragListener={false}>
        <div className="group relative flex items-center py-3 px-2">
          <DragHandle />
          <hr className="flex-1 border-t border-border/60" />
          <DeleteButton onDelete={onDelete} />
        </div>
      </Reorder.Item>
    );
  }

  const indentPx = (block.indent || 0) * 24;
  const blockColor = (block.color || currentColor) as LineInkColor;
  const inkData = LINE_INK_COLORS.find(c => c.value === blockColor);

  return (
    <Reorder.Item value={block} dragListener={false}>
      <div
        className={cn(
          "group relative flex items-start gap-0 rounded-lg transition-all min-h-[32px]",
          isFocused && "bg-muted/30"
        )}
        style={{ paddingLeft: indentPx }}
      >
        <DragHandle />

        {/* Block type prefix */}
        <BlockPrefix block={block} onToggleTodo={onToggleTodo} onToggleCollapse={onToggleCollapse} />

        {/* Content area with typing animation */}
        <div className="flex-1 relative">
          {/* Typing indicator — floating dot */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, scale: 0, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0, y: -5 }}
                className="absolute -top-1 -right-1 z-10"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                  style={{ backgroundColor: inkData?.hex || '#1a1a2e' }}
                >
                  ✨
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={(el) => {
              setRef(el);
              if (el) {
                // Auto-resize textarea to fit content
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
            value={block.content}
            onChange={(e) => {
              onTextChange(e.target.value);
              // Auto-resize on change
              const target = e.target;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={onFocus}
            placeholder={getPlaceholder(block.type)}
            rows={1}
            className={cn(
              "flex-1 bg-transparent border-0 outline-none resize-none py-1.5 px-1 placeholder:text-muted-foreground/40 leading-relaxed w-full overflow-hidden",
              getBlockTextClass(block.type)
            )}
          />

          {/* Special block previews — ALL types */}
          {block.type === 'image' && (block.url || block.content) && (
            <div className="mt-1 rounded-lg overflow-hidden border border-border/30 max-w-md">
              {block.url ? (
                <img src={block.url} alt={block.caption || ''} className="w-full object-cover max-h-48" />
              ) : (
                <div className="p-4 text-center bg-muted/20">
                  <span className="text-2xl">🖼️</span>
                  <p className="text-xs text-muted-foreground mt-1">Paste image URL in the text field</p>
                </div>
              )}
              {block.caption && (
                <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/20">{block.caption}</div>
              )}
            </div>
          )}
          {block.type === 'equation' && block.content && (
            <div className="mt-1 p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 font-mono text-sm text-indigo-800">
              ∑ {block.content}
            </div>
          )}
          {block.type === 'bookmark' && (block.url || block.content) && (
            <div className="mt-1 p-2 rounded-lg border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer max-w-md">
              <div className="text-xs font-medium text-primary truncate">{block.content || 'Bookmark'}</div>
              {block.url && <div className="text-[10px] text-muted-foreground truncate">🔗 {block.url}</div>}
              {!block.url && <div className="text-[10px] text-muted-foreground">Paste URL in the text field</div>}
            </div>
          )}
          {block.type === 'code' && block.content && (
            <div className="mt-1 p-3 rounded-lg bg-slate-900 text-green-400 font-mono text-xs max-w-lg overflow-x-auto">
              <div className="flex items-center gap-1 mb-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="ml-2 text-[10px]">{block.language || 'code'}</span>
              </div>
              <pre className="whitespace-pre-wrap">{block.content}</pre>
            </div>
          )}
          {block.type === 'table' && block.tableData && (
            <div className="mt-1 rounded-lg border border-border/30 overflow-hidden max-w-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    {block.tableData.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left font-medium border-r border-border/20 last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.tableData.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border/20">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 border-r border-border/20 last:border-r-0">{cell.content}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {block.type === 'mermaid' && block.content && (
            <div className="mt-1 p-3 rounded-lg bg-teal-50/50 border border-teal-100 font-mono text-[11px] text-teal-800">
              📊 {block.content.split('\n')[0]}
              {block.content.split('\n').length > 1 && <span className="text-teal-500 ml-1">({block.content.split('\n').length} lines)</span>}
            </div>
          )}
          {block.type === 'video' && (
            <div className="mt-1 p-4 rounded-lg border border-border/30 bg-muted/10 text-center max-w-md">
              <span className="text-2xl">🎥</span>
              <p className="text-xs text-muted-foreground mt-1">Video embed — paste URL</p>
            </div>
          )}
          {block.type === 'audio' && (
            <div className="mt-1 p-3 rounded-lg border border-border/30 bg-muted/10 text-center max-w-md">
              <span className="text-2xl">🎵</span>
              <p className="text-xs text-muted-foreground mt-1">Audio embed — paste URL</p>
            </div>
          )}
          {block.type === 'ai-generated' && (
            <div className="mt-1 p-3 rounded-lg bg-gradient-to-r from-purple-50/50 to-indigo-50/50 border border-purple-100">
              <div className="flex items-center gap-1.5 text-xs text-purple-600">
                <span>✨</span>
                <span className="font-medium">AI Generated</span>
              </div>
              {block.content && <p className="text-xs text-purple-800 mt-1">{block.content}</p>}
            </div>
          )}
          {block.type === 'pdf' && (
            <div className="mt-1 p-3 rounded-lg border border-border/30 bg-red-50/50 text-center max-w-md">
              <span className="text-2xl">📄</span>
              <p className="text-xs text-muted-foreground mt-1">PDF embed — paste URL</p>
            </div>
          )}
          {block.type === 'table_of_contents' && (
            <div className="mt-1 p-2 rounded-lg bg-muted/20 border border-border/30">
              <span className="text-xs font-medium text-muted-foreground">📋 Table of Contents</span>
            </div>
          )}
          {block.type === 'synced' && (
            <div className="mt-1 p-2 rounded-lg bg-blue-50/50 border border-blue-100">
              <span className="text-xs text-blue-600">🔄 Synced Block</span>
            </div>
          )}

          {/* Inline color picker */}
          <AnimatePresence>
            {showInlineColor && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                className="absolute left-0 top-full mt-1 z-50 bg-white/95 backdrop-blur-xl rounded-xl border border-white/30 shadow-lg p-2 flex gap-1"
              >
                {LINE_INK_COLORS.map((ink) => (
                  <button
                    key={ink.value}
                    onClick={() => onColorPick(ink.value)}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-transform hover:scale-125",
                      blockColor === ink.value ? "border-primary scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: ink.hex }}
                    title={ink.label}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Color + Delete buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
          <button
            onClick={onToggleColor}
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            title="Change color"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: inkData?.hex || '#1a1a2e' }} />
          </button>
          <DeleteButton onDelete={onDelete} />
        </div>
      </div>
    </Reorder.Item>
  );
};

// Drag handle
const DragHandle: React.FC = () => (
  <div className="flex items-center justify-center w-6 h-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0 mt-0.5">
    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
  </div>
);

// Delete button
const DeleteButton: React.FC<{ onDelete: () => void }> = ({ onDelete }) => (
  <button
    onClick={onDelete}
    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"
    tabIndex={-1}
  >
    <Trash2 className="w-3.5 h-3.5" />
  </button>
);

// Block type prefix
const BlockPrefix: React.FC<{ block: Block; onToggleTodo: () => void; onToggleCollapse?: () => void }> = ({ block, onToggleTodo, onToggleCollapse }) => {
  switch (block.type) {
    case 'bullet':
      return (
        <div className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/70" />
        </div>
      );
    case 'numbered':
      return (
        <div className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5 text-sm text-muted-foreground font-medium">•</div>
      );
    case 'todo':
      return (
        <button onClick={onToggleTodo} className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5" tabIndex={-1}>
          <div className={cn(
            "w-4 h-4 rounded border-2 transition-colors flex items-center justify-center",
            block.checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"
          )}>
            {block.checked && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </button>
      );
    case 'quote':
      return (
        <div className="flex items-stretch flex-shrink-0 mt-1 mr-1">
          <div className="w-1 rounded-full bg-primary/40" />
        </div>
      );
    case 'callout':
      return (
        <div className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5 text-base">{block.emoji || '💡'}</div>
      );
    case 'toggle':
      return (
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5 hover:bg-muted/30 rounded transition-colors"
          tabIndex={-1}
        >
          <motion.div
            animate={{ rotate: block.collapsed ? 0 : 90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.div>
        </button>
      );
    case 'equation':
      return (
        <div className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5 text-base">∑</div>
      );
    case 'image':
      return (
        <div className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5 text-base">🖼️</div>
      );
    case 'bookmark':
      return (
        <div className="flex items-center justify-center w-6 h-8 flex-shrink-0 mt-0.5 text-base">🔗</div>
      );
    default:
      return null;
  }
};

// Text styling classes per block type
const getBlockTextClass = (type: BlockType): string => {
  switch (type) {
    case 'heading1': return 'text-2xl font-bold';
    case 'heading2': return 'text-xl font-semibold';
    case 'heading3': return 'text-lg font-semibold';
    case 'quote': return 'text-base italic text-muted-foreground';
    case 'callout': return 'text-sm bg-accent/30 rounded-lg px-2 py-1';
    case 'code': return 'text-sm font-mono bg-muted/50 rounded px-2 py-1';
    case 'equation': return 'text-sm font-mono bg-indigo-50 rounded px-2 py-1';
    case 'toggle': return 'text-sm font-medium';
    case 'todo': return 'text-sm';
    default: return 'text-sm';
  }
};

// Placeholder text
const getPlaceholder = (type: BlockType): string => {
  switch (type) {
    case 'heading1': return 'Heading 1';
    case 'heading2': return 'Heading 2';
    case 'heading3': return 'Heading 3';
    case 'text': return "Type '/' for commands";
    case 'bullet': return 'List item';
    case 'numbered': return 'List item';
    case 'todo': return 'To-do';
    case 'quote': return 'Quote';
    case 'callout': return 'Callout';
    case 'code': return 'Code';
    case 'toggle': return 'Toggle heading...';
    case 'equation': return 'Type LaTeX equation...';
    case 'image': return 'Image URL or paste...';
    case 'bookmark': return 'Paste URL...';
    default: return '';
  }
};
