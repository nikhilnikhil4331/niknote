import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserStreak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  const [loading, setLoading] = useState(true);

  // Fetch current streak
  const fetchStreak = useCallback(async () => {
    if (!user || String(user.id || '').startsWith('local-guest-')) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setStreak({
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastActiveDate: data.last_active_date,
      });
    }
    setLoading(false);
  }, [user]);

  // Update streak (call when user performs an action)
  const recordActivity = useCallback(async () => {
    if (!user || String(user.id || '').startsWith('local-guest-')) return;

    const { data, error } = await supabase.rpc('update_user_streak', { p_user_id: user.id });

    if (data && !error) {
      const result = data as unknown as { current_streak: number; longest_streak: number; streak_updated: boolean };
      setStreak({
        currentStreak: result.current_streak,
        longestStreak: result.longest_streak,
        lastActiveDate: new Date().toISOString().split('T')[0],
      });
      return result.streak_updated;
    }
    return false;
  }, [user]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  // Auto-record activity on mount (user opened the app)
  useEffect(() => {
    if (user && !loading) {
      recordActivity();
    }
  }, [user, loading, recordActivity]);

  return { streak, loading, recordActivity };
}
