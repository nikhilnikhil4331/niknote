// Interactive flashcard block: click to flip, inline edit both sides.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import { Block } from '@/types/block';

interface Props {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
}

export const FlashcardBlock: React.FC<Props> = ({ block, onUpdate }) => {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState<'front' | 'back' | null>(null);
  const front = block.front ?? block.content ?? '';
  const back = block.back ?? '';

  const showBack = flipped;
  const label = showBack ? 'Answer' : 'Question';
  const text = showBack ? back : front;
  const side: 'front' | 'back' = showBack ? 'back' : 'front';

  return (
    <div className="my-2 select-none" style={{ perspective: 1000 }}>
      <div className="relative w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                🎴 {label}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFlipped(f => !f); setEditing(null); }}
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors"
              >
                <RotateCw className="w-3 h-3" /> Flip
              </button>
            </div>

            {editing === side ? (
              <textarea
                autoFocus
                value={text}
                onChange={(e) => onUpdate(side === 'front' ? { front: e.target.value, content: e.target.value } : { back: e.target.value })}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                className="w-full min-h-[80px] bg-white/70 rounded-lg p-3 text-sm text-gray-800 border border-indigo-200 focus:border-indigo-400 outline-none resize-none"
                placeholder={side === 'front' ? 'Type the question...' : 'Type the answer...'}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(side)}
                className="w-full text-left min-h-[80px] py-2 text-base text-gray-800 whitespace-pre-wrap"
              >
                {text || <span className="text-gray-400 italic">Tap to add {side === 'front' ? 'question' : 'answer'}...</span>}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
