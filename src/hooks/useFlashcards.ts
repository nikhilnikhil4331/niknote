// Simple SM-2-lite spaced repetition backed by localStorage.
// Reviews are portable but scoped to the active cloud owner.
import { useCallback, useEffect, useState } from 'react';
import { ownerScopedStorageKey } from '@/lib/ownerScopedStorage';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  ease: number;         // 1.3..2.8
  interval: number;     // days
  dueAt: number;        // ms epoch
  reps: number;
  lastReviewedAt?: number;
}

const KEY = 'niknote_flashcard_reviews_v1';

type StoredReviews = { key: string; value: Record<string, ReviewState> };

const load = (key: string): Record<string, ReviewState> => {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};
const save = (key: string, data: Record<string, ReviewState>) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

const defaultState = (): ReviewState => ({
  ease: 2.5, interval: 0, dueAt: Date.now(), reps: 0,
});

export const useFlashcards = (ownerId?: string) => {
  const storageKey = ownerScopedStorageKey(KEY, ownerId);
  const [stored, setStored] = useState<StoredReviews>(() => ({ key: storageKey, value: load(storageKey) }));
  const reviews = stored.key === storageKey ? stored.value : load(storageKey);

  useEffect(() => {
    if (stored.key !== storageKey) setStored({ key: storageKey, value: load(storageKey) });
  }, [storageKey, stored.key]);

  useEffect(() => {
    if (stored.key === storageKey) save(storageKey, stored.value);
  }, [storageKey, stored]);

  const updateReviews = useCallback((updater: (previous: Record<string, ReviewState>) => Record<string, ReviewState>) => {
    setStored((previous) => {
      const current = previous.key === storageKey ? previous.value : load(storageKey);
      return { key: storageKey, value: updater(current) };
    });
  }, [storageKey]);

  const getState = useCallback((id: string): ReviewState => reviews[id] || defaultState(), [reviews]);

  const isDue = useCallback((id: string): boolean => {
    const state = reviews[id];
    return !state || state.dueAt <= Date.now();
  }, [reviews]);

  const rate = useCallback((id: string, rating: ReviewRating) => {
    updateReviews((previous) => {
      const state = previous[id] || defaultState();
      let { ease, interval, reps } = state;

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
        if (rating === 'easy') { ease = ease + 0.15; interval = Math.round(interval * 1.3); }
      }

      const dueAt = Date.now() + interval * 86400000;
      return { ...previous, [id]: { ease, interval, reps, dueAt, lastReviewedAt: Date.now() } };
    });
  }, [updateReviews]);

  const reset = useCallback((id: string) => {
    updateReviews((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, [updateReviews]);

  return { getState, isDue, rate, reset, all: reviews };
};
