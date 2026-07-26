// Simple SM-2-lite spaced repetition backed by localStorage.
// Keyed by block id. Portable, no DB dependency.
import { useCallback, useEffect, useState } from 'react';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  ease: number;         // 1.3..2.8
  interval: number;     // days
  dueAt: number;        // ms epoch
  reps: number;
  lastReviewedAt?: number;
}

const KEY = 'niknote_flashcard_reviews_v1';

const load = (): Record<string, ReviewState> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const save = (data: Record<string, ReviewState>) => {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
};

const defaultState = (): ReviewState => ({
  ease: 2.5, interval: 0, dueAt: Date.now(), reps: 0,
});

export const useFlashcards = () => {
  const [reviews, setReviews] = useState<Record<string, ReviewState>>(() => load());

  useEffect(() => { save(reviews); }, [reviews]);

  const getState = useCallback((id: string): ReviewState => reviews[id] || defaultState(), [reviews]);

  const isDue = useCallback((id: string): boolean => {
    const s = reviews[id];
    return !s || s.dueAt <= Date.now();
  }, [reviews]);

  const rate = useCallback((id: string, rating: ReviewRating) => {
    setReviews(prev => {
      const s = prev[id] || defaultState();
      let { ease, interval, reps } = s;

      if (rating === 'again') {
        reps = 0;
        interval = 0;
        ease = Math.max(1.3, ease - 0.2);
      } else {
        reps += 1;
        if (reps === 1) interval = 1;
        else if (reps === 2) interval = 3;
        else interval = Math.round(interval * ease);
        if (rating === 'hard') { ease = Math.max(1.3, ease - 0.15); interval = Math.max(1, Math.round(interval * 0.8)); }
        if (rating === 'good') { /* no change */ }
        if (rating === 'easy') { ease = ease + 0.15; interval = Math.round(interval * 1.3); }
      }

      const dueAt = Date.now() + interval * 86400000;
      return { ...prev, [id]: { ease, interval, reps, dueAt, lastReviewedAt: Date.now() } };
    });
  }, []);

  const reset = useCallback((id: string) => {
    setReviews(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  return { getState, isDue, rate, reset, all: reviews };
};
