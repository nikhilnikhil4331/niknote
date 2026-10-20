import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
}

interface EarnedBadge extends Badge {
  earned_at: string;
}

export function useBadges() {
  const { user } = useAuth();
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    // Fetch all badges
    const { data: badges } = await supabase
      .from('badges')
      .select('*')
      .order('category', { ascending: true });

    if (badges) setAllBadges(badges);

    // Fetch earned badges
    if (user) {
      const { data: earned } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', user.id);

      if (earned) {
        const earnedRows = earned as Array<{ badges: Badge | null; earned_at: string }>;
        setEarnedBadges(earnedRows.flatMap((entry) => entry.badges
          ? [{ ...entry.badges, earned_at: entry.earned_at }]
          : []));
      }
    }

    setLoading(false);
  }, [user]);

  const earnBadge = useCallback(async (badgeId: string) => {
    if (!user) return false;

    // Check if already earned
    const alreadyEarned = earnedBadges.find(b => b.id === badgeId);
    if (alreadyEarned) return false;

    const { data: awarded, error } = await supabase.rpc('award_badge', { p_badge_id: badgeId });
    if (error || !awarded) return false;

    await fetchBadges();
    return true;
  }, [user, earnedBadges, fetchBadges]);

  const isBadgeEarned = useCallback((badgeId: string) => {
    return earnedBadges.some(b => b.id === badgeId);
  }, [earnedBadges]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  return {
    allBadges,
    earnedBadges,
    loading,
    earnBadge,
    isBadgeEarned,
    earnedCount: earnedBadges.length,
    totalCount: allBadges.length,
  };
}
