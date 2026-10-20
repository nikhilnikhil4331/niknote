// SM-2-lite review schedules with a local cache and Supabase account sync.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  ease: number;         // 1.3..2.8
  interval: number;     // days
  dueAt: number;        // ms epoch
  reps: number;
  lastReviewedAt?: number;
}

const KEY = 'niknote_flashcard_reviews_v1';
const LEGACY_IMPORTED_KEY = `${KEY}:legacy-imported`;

const storageKey = (userId: string | null) => `${KEY}:${userId || 'guest'}`;

const load = (key: string): Record<string, ReviewState> => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, ReviewState] => {
        const state = entry[1] as Partial<ReviewState> | undefined;
        return !!state && Number.isFinite(state.ease) && Number.isFinite(state.interval)
          && Number.isFinite(state.dueAt) && Number.isFinite(state.reps);
      }),
    );
  } catch {
    return {};
  }
};

const save = (key: string, data: Record<string, ReviewState>) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Local cache is best-effort; the account sync below remains available.
  }
};

const defaultState = (): ReviewState => ({
  ease: 2.5, interval: 0, dueAt: Date.now(), reps: 0,
});

interface FlashcardReviewRow {
  block_id: string;
  ease: number;
  interval_days: number;
  due_at: string;
  reps: number;
  last_reviewed_at: string | null;
}

const fromDatabaseRow = (row: FlashcardReviewRow): ReviewState => ({
  ease: Number(row.ease) || 2.5,
  interval: Number(row.interval_days) || 0,
  dueAt: Date.parse(row.due_at) || Date.now(),
  reps: Number(row.reps) || 0,
  lastReviewedAt: row.last_reviewed_at ? Date.parse(row.last_reviewed_at) : undefined,
});

export const useFlashcards = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewState>>(() => load(storageKey(null)));
  const [ready, setReady] = useState(false);

  // Keep local state scoped to the currently authenticated account.
  useEffect(() => {
    let active = true;
    const applyUser = (id: string | null) => {
      if (active) setUserId(id);
    };
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error) applyUser(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Hydrate from the account cache, then merge server records (server wins).
  useEffect(() => {
    let active = true;
    setReady(false);

    let cached = load(storageKey(userId));
    if (userId && Object.keys(cached).length === 0) {
      try {
        if (typeof localStorage !== 'undefined' && !localStorage.getItem(LEGACY_IMPORTED_KEY)) {
          cached = load(KEY);
          localStorage.setItem(LEGACY_IMPORTED_KEY, 'true');
        }
      } catch {
        // Ignore storage access failures.
      }
    }
    setReviews(cached);

    if (!userId) {
      setReady(true);
      return () => { active = false; };
    }

    void supabase
      .from('flashcard_reviews')
      .select('block_id, ease, interval_days, due_at, reps, last_reviewed_at')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Flashcard review sync is unavailable:', error.message);
          setReady(true);
          return;
        }
        const serverReviews: Record<string, ReviewState> = {};
        const serverRows = (data || []) as FlashcardReviewRow[];
        for (const row of serverRows) serverReviews[row.block_id] = fromDatabaseRow(row);
        setReviews((current) => ({ ...current, ...serverReviews }));
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.warn('Flashcard review sync failed:', error);
        setReady(true);
      });

    return () => { active = false; };
  }, [userId]);

  // Persist a local cache immediately and batch account syncs after quick review bursts.
  useEffect(() => {
    if (!ready) return;
    save(storageKey(userId), reviews);
    if (!userId) return;

    const timeout = window.setTimeout(() => {
      const entries = Object.entries(reviews);
      if (entries.length === 0) return;
      const rows = entries.map(([block_id, state]) => ({
        user_id: userId,
        block_id,
        ease: state.ease,
        interval_days: state.interval,
        due_at: new Date(state.dueAt).toISOString(),
        reps: state.reps,
        last_reviewed_at: state.lastReviewedAt ? new Date(state.lastReviewedAt).toISOString() : null,
      }));
      void (async () => {
        for (let index = 0; index < rows.length; index += 500) {
          const { error } = await supabase
            .from('flashcard_reviews')
            .upsert(rows.slice(index, index + 500), { onConflict: 'user_id,block_id' });
          if (error) {
            console.warn('Flashcard review save failed:', error.message);
            return;
          }
        }
      })();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [ready, reviews, userId]);

  const getState = useCallback((id: string): ReviewState => reviews[id] || defaultState(), [reviews]);

  const isDue = useCallback((id: string): boolean => {
    const state = reviews[id];
    return !state || state.dueAt <= Date.now();
  }, [reviews]);

  const rate = useCallback((id: string, rating: ReviewRating) => {
    setReviews((previous) => {
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
        if (rating === 'hard') {
          ease = Math.max(1.3, ease - 0.15);
          interval = Math.max(1, Math.round(interval * 0.8));
        }
        if (rating === 'easy') {
          ease += 0.15;
          interval = Math.round(interval * 1.3);
        }
      }

      const now = Date.now();
      return {
        ...previous,
        [id]: { ease, interval, reps, dueAt: now + interval * 86_400_000, lastReviewedAt: now },
      };
    });
  }, []);

  const reset = useCallback((id: string) => {
    setReviews((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    if (userId) {
      void supabase.from('flashcard_reviews').delete().eq('user_id', userId).eq('block_id', id)
        .then(({ error }) => { if (error) console.warn('Flashcard review reset failed:', error.message); });
    }
  }, [userId]);

  return { getState, isDue, rate, reset, all: reviews };
};
