// Flashcards study mode: pulls flashcard blocks from all pages of all notebooks
// and runs a spaced-repetition session (Again / Hard / Good / Easy).
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCw, Sparkles, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlashcards, ReviewRating } from '@/hooks/useFlashcards';
import { Block } from '@/types/block';
import { toast } from 'sonner';

interface Card {
  id: string;
  front: string;
  back: string;
  notebookTitle: string;
}

const extractCards = (pages: Array<{ content: any; notebook_id: string }>, nbTitles: Record<string, string>): Card[] => {
  const cards: Card[] = [];
  for (const page of pages) {
    const blocks: Block[] = Array.isArray(page.content) ? page.content : [];
    for (const b of blocks) {
      if (b?.type === 'flashcard') {
        const front = (b.front ?? b.content ?? '').trim();
        const back = (b.back ?? '').trim();
        if (front || back) {
          cards.push({
            id: b.id,
            front: front || '(no question)',
            back: back || '(no answer)',
            notebookTitle: nbTitles[page.notebook_id] || 'Notebook',
          });
        }
      }
    }
  }
  return cards;
};

const Flashcards: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const srs = useFlashcards();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionOnlyDue, setSessionOnlyDue] = useState(true);
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const { data: nbs } = await supabase.from('notebooks').select('id, title').eq('user_id', user.id);
        const titles: Record<string, string> = {};
        (nbs || []).forEach((n: any) => { titles[n.id] = n.title || 'Untitled'; });
        const { data: pages } = await supabase.from('pages').select('content, notebook_id').eq('user_id', user.id);
        setCards(extractCards(pages || [], titles));
      } catch (e) {
        console.error(e);
        toast.error('Failed to load flashcards');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const queue = useMemo(() => {
    if (!sessionOnlyDue) return cards;
    return cards.filter(c => srs.isDue(c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, sessionOnlyDue, srs.all]);

  const current = queue[idx];

  const handleRate = (rating: ReviewRating) => {
    if (!current) return;
    srs.rate(current.id, rating);
    setSessionStats(s => ({ ...s, [rating]: s[rating] + 1 }));
    setFlipped(false);
    setIdx(i => i + 1);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 text-gray-500">Loading flashcards...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-indigo-100">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-indigo-100 text-indigo-600" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Flashcards
            </h1>
            <p className="text-[11px] text-gray-500">
              {cards.length} total · {cards.filter(c => srs.isDue(c.id)).length} due
            </p>
          </div>
          <button
            onClick={() => { setSessionOnlyDue(v => !v); setIdx(0); setFlipped(false); }}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
          >
            {sessionOnlyDue ? 'Due only' : 'All cards'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {cards.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800">No flashcards yet</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">Type <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 rounded font-mono">/flashcard</kbd> inside any note to create one.</p>
            <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
              Open editor
            </button>
          </div>
        ) : idx >= queue.length ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-lg font-bold text-gray-800">Session complete!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Again {sessionStats.again} · Hard {sessionStats.hard} · Good {sessionStats.good} · Easy {sessionStats.easy}
            </p>
            <div className="flex gap-2 justify-center mt-6">
              <button
                onClick={() => { setIdx(0); setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 }); setFlipped(false); }}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                Review again
              </button>
              <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">
                Back to editor
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center text-[11px] text-gray-400 mb-3">
              Card {idx + 1} of {queue.length} · {current.notebookTitle}
            </div>

            <div className="relative" style={{ perspective: 1200 }}>
              <AnimatePresence mode="wait">
                <motion.button
                  key={`${current.id}-${flipped ? 'b' : 'f'}`}
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.28 }}
                  onClick={() => setFlipped(f => !f)}
                  className="w-full min-h-[280px] rounded-3xl border-2 border-indigo-200 bg-white shadow-lg p-8 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-4">
                    {flipped ? 'Answer' : 'Question'}
                  </span>
                  <p className="text-xl text-gray-900 whitespace-pre-wrap max-w-lg">
                    {flipped ? current.back : current.front}
                  </p>
                  <span className="mt-6 text-[11px] text-gray-400 flex items-center gap-1">
                    <RotateCw className="w-3 h-3" /> Tap to flip
                  </span>
                </motion.button>
              </AnimatePresence>
            </div>

            {flipped ? (
              <div className="grid grid-cols-4 gap-2 mt-6">
                {(['again', 'hard', 'good', 'easy'] as ReviewRating[]).map(r => {
                  const colors: Record<ReviewRating, string> = {
                    again: 'bg-red-500 hover:bg-red-600',
                    hard: 'bg-amber-500 hover:bg-amber-600',
                    good: 'bg-emerald-500 hover:bg-emerald-600',
                    easy: 'bg-indigo-500 hover:bg-indigo-600',
                  };
                  return (
                    <button
                      key={r}
                      onClick={() => handleRate(r)}
                      className={`${colors[r]} text-white py-3 rounded-xl text-sm font-semibold capitalize transition-colors shadow-sm active:scale-95`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                onClick={() => setFlipped(true)}
                className="w-full mt-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Show answer
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Flashcards;
