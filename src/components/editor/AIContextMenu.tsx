// ============================================================
// NikNote 4.0 — AI Context Menu
// Right-click or select text → AI actions appear
// AI integrated into every workflow, not a separate feature
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Wand2, Languages, BookOpen, Lightbulb,
  MessageSquare, List, Hash, ArrowRight, PenTool,
  Brain, Zap, FileText, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NikAIMarkIcon } from '@/components/nikai/NikAIBrand';

interface AIAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: 'write' | 'learn' | 'transform';
}

const AI_ACTIONS: AIAction[] = [
  // Writing
  { id: 'improve', label: 'Improve Writing', description: 'Make text clearer and more professional', icon: <Wand2 className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50', category: 'write' },
  { id: 'expand', label: 'Expand', description: 'Add more detail and depth', icon: <Sparkles className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50', category: 'write' },
  { id: 'shorten', label: 'Shorten', description: 'Make concise and to the point', icon: <Zap className="w-4 h-4" />, color: 'text-yellow-600 bg-yellow-50', category: 'write' },
  { id: 'rewrite', label: 'Rewrite', description: 'Rewrite in a different tone', icon: <PenTool className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50', category: 'write' },

  // Learning
  { id: 'explain', label: 'Explain This', description: 'Simple explanation of selected text', icon: <Lightbulb className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50', category: 'learn' },
  { id: 'quiz', label: 'Make Quiz', description: 'Generate quiz questions from text', icon: <MessageSquare className="w-4 h-4" />, color: 'text-green-600 bg-green-50', category: 'learn' },
  { id: 'flashcards', label: 'Flashcards', description: 'Create flashcards from key concepts', icon: <List className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50', category: 'learn' },
  { id: 'summarize', label: 'Summarize', description: 'Key points summary', icon: <FileText className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50', category: 'learn' },

  // Transform
  { id: 'translate-hindi', label: '→ Hindi', description: 'Translate to Hindi', icon: <Languages className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50', category: 'transform' },
  { id: 'translate-english', label: '→ English', description: 'Translate to English', icon: <Languages className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50', category: 'transform' },
  { id: 'bullet-points', label: '→ Bullet Points', description: 'Convert to bullet list', icon: <Hash className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50', category: 'transform' },
  { id: 'study-notes', label: '→ Study Notes', description: 'Format as study notes', icon: <BookOpen className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50', category: 'transform' },
];

interface AIContextMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  selectedText: string;
  onAction: (actionId: string, text: string) => void;
  onClose: () => void;
}

export const AIContextMenu: React.FC<AIContextMenuProps> = ({
  isOpen, position, selectedText, onAction, onClose
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('write');

  const filteredActions = AI_ACTIONS.filter(a => a.category === activeCategory);

  if (!isOpen) return null;

  const adjustedTop = Math.min(position.top, window.innerHeight - 350);
  const adjustedLeft = Math.min(position.left, window.innerWidth - 280);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 4 }}
        transition={{ duration: 0.12 }}
        className="fixed z-50 w-[270px] rounded-xl border border-gray-200/80 bg-white/95 backdrop-blur-xl shadow-xl overflow-hidden"
        style={{ top: adjustedTop, left: adjustedLeft }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-600">
          <NikAIMarkIcon className="w-[20px] h-3.5" />
          <span className="text-[11px] font-semibold text-white">NikAI Actions</span>
          <span className="text-[10px] text-white/60 ml-auto truncate max-w-[120px]">
            "{selectedText.slice(0, 30)}{selectedText.length > 30 ? '...' : ''}"
          </span>
        </div>

        {/* Category tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'write', label: '✍️ Write' },
            { id: 'learn', label: '📚 Learn' },
            { id: 'transform', label: '🔄 Transform' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors",
                activeCategory === cat.id
                  ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="py-1">
          {filteredActions.map((action) => (
            <motion.button
              key={action.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => { onAction(action.id, selectedText); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors group"
            >
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", action.color)}>
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-gray-800">{action.label}</div>
                <div className="text-[10px] text-gray-400">{action.description}</div>
              </div>
              <ArrowRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50">
          <span className="text-[9px] text-gray-300">Powered by NikNote AI • 28+ subjects</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
