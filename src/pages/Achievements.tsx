import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useBadges } from '@/hooks/useBadges';
import { useStreak } from '@/hooks/useStreak';
import { Flame, Trophy, ArrowLeft, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const CATEGORY_LABELS: Record<string, string> = {
  getting_started: '🚀 Getting Started',
  streaks: '🔥 Streaks',
  style: '🎨 Style Master',
  productivity: '⚡ Productivity',
  special: '✨ Special',
};

const AchievementsPage: React.FC = () => {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { allBadges, earnedBadges, isBadgeEarned, earnedCount, totalCount, loading } = useBadges();
  const { streak } = useStreak();

  const categories = [...new Set(allBadges.map(b => b.category))];

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="font-display text-base font-bold text-foreground">Achievements</h1>
            <p className="text-[11px] text-muted-foreground">{earnedCount}/{totalCount} badges earned</p>
          </div>
        </div>
      </div>

      {/* Streak Card */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-[#eef4ff] to-[#fff0f0] dark:from-[#1d2b41] dark:to-[#34242f] border border-primary/20 p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-6 h-6 text-orange-500" />
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{streak.currentStreak}</span>
              </div>
              <p className="text-sm font-medium text-foreground">Day Streak</p>
              <p className="text-xs text-muted-foreground mt-0.5">Longest: {streak.longestStreak} days</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold",
                    i < streak.currentStreak % 7
                      ? "bg-orange-500 text-white"
                      : "bg-orange-100 dark:bg-orange-900/30 text-orange-300"
                  )}
                >
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Badges Grid */}
      <div className="px-4 pt-5 pb-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          categories.map((cat) => {
            const catBadges = allBadges.filter(b => b.category === cat);
            return (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {catBadges.map((badge, idx) => {
                    const earned = isBadgeEarned(badge.id);
                    return (
                      <motion.div
                        key={badge.id}
                        initial={reduced ? false : { opacity: 0, scale: 0.88, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        whileHover={earned && !reduced ? { y: -3, scale: 1.025 } : undefined}
                        whileTap={earned && !reduced ? { scale: 0.98 } : undefined}
                        transition={reduced ? { duration: 0.01 } : { delay: idx * 0.045, type: 'spring', stiffness: 250, damping: 20 }}
                        data-earned={earned ? 'true' : 'false'}
                        className={cn(
                          "nn-achievement-card relative flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all",
                          earned
                            ? "border-primary/30 bg-primary/5 shadow-sm"
                            : "border-border/30 bg-muted/20 opacity-60"
                        )}
                      >
                        <span className="text-2xl mb-1.5">{badge.icon}</span>
                        <span className="text-[10px] font-semibold text-foreground leading-tight">{badge.name}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{badge.description}</span>
                        {!earned && (
                          <div className="absolute top-1.5 right-1.5">
                            <Lock className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                        )}
                        {earned && (
                          <motion.div
                            initial={reduced ? false : { scale: 0, rotate: -24 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 340, damping: 15, delay: idx * 0.045 + 0.08 }}
                            className="nn-achievement-earned absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Trophy className="w-3 h-3 text-primary-foreground" />
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AchievementsPage;
