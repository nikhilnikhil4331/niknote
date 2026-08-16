import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Gift, Crown, Share2, Check } from 'lucide-react';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  todayCompleted: boolean;
  rewards: StreakReward[];
}

interface StreakReward {
  days: number;
  label: string;
  description: string;
  claimed: boolean;
  type: 'free_premium_day' | 'ai_credits' | 'style_unlock';
}

const DEFAULT_REWARDS: StreakReward[] = [
  { days: 3, label: '3-Day Streak! 🔥', description: '1 Free AI Note Credit', claimed: false, type: 'ai_credits' },
  { days: 7, label: 'Week Warrior! 💪', description: '1 Day Free Premium', claimed: false, type: 'free_premium_day' },
  { days: 14, label: '2 Weeks! 🌟', description: '2 AI Credits + Style Unlock', claimed: false, type: 'style_unlock' },
  { days: 30, label: 'Monthly Master! 👑', description: '3 Days Free Premium', claimed: false, type: 'free_premium_day' },
];

const STREAK_KEY = 'niknote_streak_data';

export const useStudyStreak = () => {
  const [streakData, setStreakData] = useState<StreakData>(() => {
    try {
      const saved = localStorage.getItem(STREAK_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      todayCompleted: false,
      rewards: DEFAULT_REWARDS,
    };
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
  }, [streakData]);

  const markTodayActive = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];

    setStreakData(prev => {
      if (prev.lastActiveDate === today && prev.todayCompleted) return prev;

      let newStreak = prev.currentStreak;
      if (prev.lastActiveDate) {
        const lastDate = new Date(prev.lastActiveDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak = prev.currentStreak + 1; // Consecutive day
        } else if (diffDays > 1) {
          newStreak = 1; // Streak broken, restart
        }
        // diffDays === 0 means same day, keep streak
      } else {
        newStreak = 1; // First day
      }

      const longestStreak = Math.max(prev.longestStreak, newStreak);

      // Update rewards
      const rewards = prev.rewards.map(r => ({
        ...r,
        claimed: r.claimed || newStreak >= r.days,
      }));

      return {
        currentStreak: newStreak,
        longestStreak,
        lastActiveDate: today,
        todayCompleted: true,
        rewards,
      };
    });
  }, []);

  const claimReward = useCallback((days: number) => {
    setStreakData(prev => ({
      ...prev,
      rewards: prev.rewards.map(r =>
        r.days === days ? { ...r, claimed: true } : r
      ),
    }));
  }, []);

  return { streakData, markTodayActive, claimReward };
};

export const StudyStreakWidget: React.FC = () => {
  const { streakData, markTodayActive, claimReward } = useStudyStreak();
  const [showRewardPopup, setShowRewardPopup] = useState<StreakReward | null>(null);

  // Auto-mark today as active when component mounts
  useEffect(() => {
    markTodayActive();
  }, [markTodayActive]);

  // Check if a new reward was just unlocked
  useEffect(() => {
    const unclaimedUnlocked = streakData.rewards.find(r => !r.claimed && streakData.currentStreak >= r.days);
    // We show this only if streak matches exactly (just unlocked)
    if (unclaimedUnlocked && streakData.currentStreak === unclaimedUnlocked.days) {
      setShowRewardPopup(unclaimedUnlocked);
    }
  }, [streakData.currentStreak, streakData.rewards]);

  const handleClaim = (reward: StreakReward) => {
    claimReward(reward.days);
    setShowRewardPopup(null);
  };

  const nextReward = streakData.rewards.find(r => streakData.currentStreak < r.days);
  const progressToNext = nextReward
    ? Math.min(100, (streakData.currentStreak / nextReward.days) * 100)
    : 100;

  return (
    <>
      {/* Streak Display */}
      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`h-5 w-5 ${streakData.currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <span className="font-bold text-sm text-foreground">Study Streak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold text-orange-500">{streakData.currentStreak}</span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>

        {/* Progress to next reward */}
        {nextReward && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Next: {nextReward.label}</span>
              <span className="text-orange-600 font-semibold">{streakData.currentStreak}/{nextReward.days} days</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Reward Milestones */}
        <div className="flex items-center gap-1.5">
          {streakData.rewards.map((reward) => {
            const achieved = streakData.currentStreak >= reward.days;
            return (
              <div
                key={reward.days}
                className={`flex-1 text-center p-1.5 rounded-lg text-[9px] font-semibold transition-all ${
                  achieved
                    ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                    : 'bg-muted/30 text-muted-foreground border border-transparent'
                }`}
                title={reward.description}
              >
                <div className="text-[10px]">{achieved ? '🏆' : '🎯'}</div>
                <div>{reward.days}d</div>
              </div>
            );
          })}
        </div>

        {/* Today status */}
        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
          streakData.todayCompleted
            ? 'bg-green-500/10 text-green-600'
            : 'bg-amber-500/10 text-amber-600'
        }`}>
          {streakData.todayCompleted ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Today's streak saved! Keep going 🔥
            </>
          ) : (
            <>
              <Flame className="h-3.5 w-3.5" />
              Write notes today to keep your streak alive!
            </>
          )}
        </div>
      </div>

      {/* Reward Claim Popup */}
      <AnimatePresence>
        {showRewardPopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRewardPopup(null)}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-4"
            >
              <div className="bg-card rounded-3xl border border-border/50 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="text-5xl"
                >
                  🎉
                </motion.div>
                <h3 className="text-xl font-bold text-foreground">{showRewardPopup.label}</h3>
                <p className="text-sm text-muted-foreground">{showRewardPopup.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleClaim(showRewardPopup)}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <Gift className="h-4 w-4" />
                    Claim Reward!
                  </button>
                  <button
                    onClick={() => {
                      const msg = encodeURIComponent(
                        `🔥 I'm on a ${streakData.currentStreak}-day study streak on NikNote!\n\n${showRewardPopup.label}\nJoin me: https://www.niknote.online`
                      );
                      window.open(`https://wa.me/?text=${msg}`, '_blank');
                    }}
                    className="py-3 px-4 rounded-xl border-2 border-green-500/30 bg-green-500/5 text-green-600 font-semibold text-sm flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
