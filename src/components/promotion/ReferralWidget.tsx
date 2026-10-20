import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Copy, Check, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useReferral } from '@/hooks/useReferral';
import { toast } from 'sonner';

export const ReferralWidget: React.FC<{ variant?: 'banner' | 'card' | 'compact' }> = ({
  variant = 'card',
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('niknote_referral_dismissed') === 'true'
  );

  const { stats, shareViaWhatsApp, copyLink, loading } = useReferral();

  const handleCopyLink = async () => {
    if (!user || !stats.referralCode) {
      toast.info('Sign in to get your personal referral code.');
      return;
    }
    const copiedSuccessfully = await copyLink();
    if (!copiedSuccessfully) {
      toast.error('Could not copy your referral link.');
      return;
    }
    setCopied(true);
    toast.success('Link copied! Ab share karo dosto ko 🎁');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!user || !stats.referralCode) {
      toast.info('Sign in to get your personal referral code.');
      return;
    }
    shareViaWhatsApp();
    toast.success('Share your link to earn up to 7 Premium days per friend!');
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('niknote_referral_dismissed', 'true');
  };

  if (dismissed) return null;

  // Compact variant — for sidebar or small spaces
  if (variant === 'compact') {
    return (
      <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/50">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-bold text-foreground">Invite & Earn Premium Days!</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">
          Earn 7 days after each invited friend subscribes (up to 30 days/month).
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={handleWhatsApp}
            disabled={!user || loading || !stats.referralCode}
            className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </button>
          <button
            onClick={handleCopyLink}
            disabled={!user || loading || !stats.referralCode}
            className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    );
  }

  // Card variant — for landing page or account page
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-primary/5 border border-purple-200/50 p-6 overflow-hidden"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Invite friends, earn Premium days 🎁</h3>
            <p className="text-sm text-muted-foreground">Earn up to 7 days for each friend after their first subscription (30 reward days/month max).</p>
          </div>
        </div>

        {/* Server-backed referral results */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Friends referred</p>
            <p className="text-lg font-bold text-foreground">{stats.totalReferrals}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Premium days earned</p>
            <p className="text-lg font-bold text-foreground">{stats.rewardDays}</p>
          </div>
          {stats.pendingRewards > 0 && (
            <p className="col-span-2 text-xs text-muted-foreground">
              {stats.pendingRewards} referral{stats.pendingRewards === 1 ? '' : 's'} waiting for a first subscription.
            </p>
          )}
        </div>

        {/* Share Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleWhatsApp}
            disabled={!user || loading || !stats.referralCode}
            className="flex-1 h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Share on WhatsApp 📱
          </Button>
          <Button
            onClick={handleCopyLink}
            disabled={!user || loading || !stats.referralCode}
            variant="outline"
            className="flex-1 h-11 rounded-xl font-semibold gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Referral Link'}
          </Button>
        </div>

        {/* Referral code */}
        <div className="mt-3 text-center">
          <span className="text-[11px] text-muted-foreground">
            Your code: <span className="font-mono font-bold text-foreground">{loading ? 'Loading…' : stats.referralCode || 'Sign in to create a code'}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
};
