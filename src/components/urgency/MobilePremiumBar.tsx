import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePremium } from '@/hooks/usePremium';

export const MobilePremiumBar: React.FC = () => {
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on mobile for non-premium users
    if (isPremium || dismissed) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    // Show after user scrolls a bit (engaged user)
    const handleScroll = () => {
      const scrolled = window.scrollY;
      if (scrolled > 400 && !dismissed) {
        setVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isPremium, dismissed]);

  if (isPremium || dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 inset-x-0 z-50 md:hidden"
        >
          <div className="bg-gradient-to-r from-primary/95 to-nk-rose/95 backdrop-blur-xl border-t border-[color:var(--nk-glass-border)] px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-accent-warm flex-shrink-0" />
                <span className="text-white text-xs font-bold">Unlock ALL Features</span>
              </div>
              <p className="text-white/70 text-[10px]">AI writing + voice dictation — ₹49 for 7 days</p>
            </div>
            <button
              onClick={() => navigate('/payment?plan=weekly')}
              className="flex-shrink-0 px-4 py-2 rounded-full bg-surface text-accent-rose font-bold text-xs flex items-center gap-1 shadow-lg active:scale-95 transition-transform"
            >
              <Zap className="h-3 w-3" />
              Upgrade
            </button>
            <button
              onClick={() => { setVisible(false); setDismissed(true); }}
              className="flex-shrink-0 h-6 w-6 rounded-full bg-surface/10 flex items-center justify-center"
            >
              <X className="h-3 w-3 text-white/60" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
