// ============================================================
// NikNote 5.0 — Block Context Menu
// Right-click / long-press menu for block operations
// Duplicate, Move, Convert, Delete, Copy, Color, AI
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Trash2, ArrowUp, ArrowDown, Repeat, Palette,
  Sparkles, MoreHorizontal, Check, Edit3, ChevronRight
} from 'lucide-react';
import { Block, BlockType, SLASH_COMMANDS } from '@/types/block';
import { LineInkColor, LINE_INK_COLORS } from '@/types/noteLine';

interface BlockContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  block: Block | null;
  position: { x: number; y: number };
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onConvert: (id: string, type: BlockType) => void;
  onColorChange: (id: string, color: LineInkColor) => void;
  onAIAction: (id: string, action: string) => void;
  onCopyContent: (id: string) => void;
  isPremium: boolean;
}

const CONVERT_TYPES: { type: BlockType; icon: string; label: string }[] = [
  { type: 'text', icon: '📝', label: 'Text' },
  { type: 'heading1', icon: 'H₁', label: 'Heading 1' },
  { type: 'heading2', icon: 'H₂', label: 'Heading 2' },
  { type: 'heading3', icon: 'H₃', label: 'Heading 3' },
  { type: 'bullet', icon: '•', label: 'Bullet' },
  { type: 'numbered', icon: '1.', label: 'Numbered' },
  { type: 'todo', icon: '☐', label: 'To-do' },
  { type: 'quote', icon: '❝', label: 'Quote' },
  { type: 'callout', icon: '💡', label: 'Callout' },
  { type: 'code', icon: '<>', label: 'Code' },
];

const AI_ACTIONS = [
  { id: 'ai-explain', icon: '🧠', label: 'AI Explain', desc: 'Hinglish mein samjhao' },
  { id: 'ai-summarize', icon: '📋', label: 'Summarize', desc: 'Short summary banao' },
  { id: 'ai-rewrite', icon: '✍️', label: 'Rewrite', desc: 'Better likho' },
  { id: 'ai-translate', icon: '🌐', label: 'Translate', desc: 'Hindi ↔ English' },
  { id: 'ai-expand', icon: '📖', label: 'Expand', desc: 'Detail mein likho' },
  { id: 'ai-quiz', icon: '🎯', label: 'Make Quiz', desc: 'Is pe quiz banao' },
];

export const BlockContextMenu: React.FC<BlockContextMenuProps> = ({
  isOpen, onClose, block, position,
  onDuplicate, onDelete, onMoveUp, onMoveDown,
  onConvert, onColorChange, onAIAction, onCopyContent, isPremium
}) => {
  const [showConvert, setShowConvert] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport
  const adjustedPos = useCallback(() => {
    const menuWidth = 220;
    const menuHeight = 350;
    return {
      x: Math.min(position.x, window.innerWidth - menuWidth - 10),
      y: Math.min(position.y, window.innerHeight - menuHeight - 10),
    };
  }, [position]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen || !block) return null;

  const pos = adjustedPos();

  const menuItems = [
    {
      icon: <Copy className="w-4 h-4" />,
      label: 'Copy Text',
      action: () => { onCopyContent(block.id); onClose(); },
      shortcut: '⌘C',
    },
    {
      icon: <Copy className="w-4 h-4" />,
      label: 'Duplicate',
      action: () => { onDuplicate(block.id); onClose(); },
      shortcut: '⌘D',
    },
    { divider: true },
    {
      icon: <ArrowUp className="w-4 h-4" />,
      label: 'Move Up',
      action: () => { onMoveUp(block.id); onClose(); },
      shortcut: '⌥↑',
    },
    {
      icon: <ArrowDown className="w-4 h-4" />,
      label: 'Move Down',
      action: () => { onMoveDown(block.id); onClose(); },
      shortcut: '⌥↓',
    },
    { divider: true },
    {
      icon: <Repeat className="w-4 h-4" />,
      label: 'Convert to...',
      action: () => { setShowConvert(true); setShowColors(false); setShowAI(false); },
      hasSubmenu: true,
    },
    {
      icon: <Palette className="w-4 h-4" />,
      label: 'Change Color',
      action: () => { setShowColors(true); setShowConvert(false); setShowAI(false); },
      hasSubmenu: true,
    },
    { divider: true },
    {
      icon: <Sparkles className="w-4 h-4 text-pink-500" />,
      label: 'AI Actions',
      action: () => { setShowAI(true); setShowConvert(false); setShowColors(false); },
      hasSubmenu: true,
      premium: true,
    },
    { divider: true },
    {
      icon: <Trash2 className="w-4 h-4 text-red-500" />,
      label: 'Delete Block',
      action: () => { onDelete(block.id); onClose(); },
      shortcut: '⌫',
      danger: true,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -5 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed z-[9999] w-[220px] rounded-xl border border-gray-200 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        role="menu"
        aria-label="Block actions menu"
        style={{ left: pos.x, top: pos.y }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Block Actions</span>
        </div>

        {/* Menu items */}
        <div className="py-1 max-h-[300px] overflow-y-auto">
          {menuItems.map((item, i) => {
            if ('divider' in item && item.divider) {
              return <div key={`div-${i}`} className="h-px bg-gray-100 my-1 mx-2" />;
            }
            const menuItem = item as { icon: React.ReactNode; label: string; action: () => void; shortcut?: string; hasSubmenu?: boolean; premium?: boolean; danger?: boolean };
            return (
              <button
                key={menuItem.label}
                onClick={menuItem.action}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                  menuItem.danger ? 'text-red-600' : ''
                }`}
              >
                <span className={menuItem.danger ? 'text-red-400' : 'text-gray-500'}>{menuItem.icon}</span>
                <span className="text-[13px] flex-1">{menuItem.label}</span>
                {menuItem.premium && !isPremium && <span className="text-[9px] text-amber-500 font-bold">PRO</span>}
                {menuItem.hasSubmenu && <ChevronRight className="w-3 h-3 text-gray-300" />}
                {menuItem.shortcut && <kbd className="text-[9px] font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded">{menuItem.shortcut}</kbd>}
              </button>
            );
          })}
        </div>

        {/* Convert Submenu */}
        <AnimatePresence>
          {showConvert && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-xl rounded-xl border border-gray-200 shadow-2xl overflow-y-auto"
            >
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <button onClick={() => setShowConvert(false)} className="text-[10px] text-gray-500 hover:text-gray-700">← Back</button>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Convert to</span>
              </div>
              <div className="py-1">
                {CONVERT_TYPES.map(ct => (
                  <button
                    key={ct.type}
                    onClick={() => { onConvert(block.id, ct.type); onClose(); }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                      block.type === ct.type ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs">{ct.icon}</div>
                    <span className="text-[13px]">{ct.label}</span>
                    {block.type === ct.type && <Check className="w-3.5 h-3.5 text-blue-500 ml-auto" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Colors Submenu */}
        <AnimatePresence>
          {showColors && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-xl rounded-xl border border-gray-200 shadow-2xl overflow-y-auto"
            >
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <button onClick={() => setShowColors(false)} className="text-[10px] text-gray-500 hover:text-gray-700">← Back</button>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Ink Color</span>
              </div>
              <div className="p-3 flex gap-2 flex-wrap">
                {LINE_INK_COLORS.map(ink => (
                  <button
                    key={ink.value}
                    onClick={() => { onColorChange(block.id, ink.value); onClose(); }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${
                      block.color === ink.value ? 'border-blue-500 ring-2 ring-blue-200 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: ink.hex, touchAction: 'manipulation', cursor: 'pointer' }}
                    title={ink.label}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Submenu */}
        <AnimatePresence>
          {showAI && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-xl rounded-xl border border-gray-200 shadow-2xl overflow-y-auto"
            >
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <button onClick={() => setShowAI(false)} className="text-[10px] text-gray-500 hover:text-gray-700">← Back</button>
                <span className="text-[10px] font-bold text-pink-500 uppercase">✨ AI Actions</span>
              </div>
              <div className="py-1">
                {AI_ACTIONS.map(ai => (
                  <button
                    key={ai.id}
                    onClick={() => { onAIAction(block.id, ai.id); onClose(); }}
                    onMouseDown={(e) => e.preventDefault()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-pink-50 active:bg-pink-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-sm">{ai.icon}</div>
                    <div>
                      <div className="text-[13px] font-medium">{ai.label}</div>
                      <div className="text-[10px] text-gray-400">{ai.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
