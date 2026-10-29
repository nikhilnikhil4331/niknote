import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ExitIntentPopup: React.FC = () => {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Only show on landing page and only once per session
    const alreadyShown = sessionStorage.getItem('niknote_exit_shown');
    if (alreadyShown) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !dismissed) {
        setShow(true);
        sessionStorage.setItem('niknote_exit_shown', 'true');
      }
    };

    // Only on desktop
    const isDesktop = window.innerWidth >= 768;
    if (isDesktop) {
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [dismissed]);

  // Mobile: show after 30 seconds of inactivity on landing
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    const alreadyShown = sessionStorage.getItem('niknote_exit_shown');
    if (alreadyShown) return;

    let timeout: ReturnType<typeof setTimeout>;
    let lastActivity = Date.now();

    const resetTimer = () => {
      lastActivity = Date.now();
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const inactive = Date.now() - lastActivity;
        if (inactive >= 15000 && !dismissed) {
          setShow(true);
          sessionStorage.setItem('niknote_exit_shown', 'true');
        }
      }, 15000);
    };

    resetTimer();
    ['scroll', 'touchstart', 'click'].forEach(evt =>
      document.addEventListener(evt, resetTimer, { passive: true })
    );

    return () => {
      clearTimeout(timeout);
      ['scroll', 'touchstart', 'click'].forEach(evt =>
        document.removeEventListener(evt, resetTimer)
      );
    };
  }, [dismissed]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
          >
            <div className="relative bg-card rounded-3xl border border-border/50 shadow-2xl max-w-sm w-full overflow-hidden">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header gradient */}
              <div className="bg-gradient-to-br from-primary/10 via-orange-500/10 to-pink-500/10 p-6 pb-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Crown className="h-7 w-7 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-center text-foreground">
                  Explore Premium
                </h3>
              </div>

              {/* Content */}
              <div className="p-6 pt-2 space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  Premium features sirf <span className="font-bold text-foreground">₹49 for 7 days</span> mein.
                  <br />
                  <span className="text-muted-foreground">One-time payment; automatic renewal nahi.</span>
                </p>

                {/* Quick benefits */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    '🧠 AI Writing Assistant',
                    '🎙️ Voice Dictation',
                    '🔍 AI Style Matcher',
                    '📷 Handwriting Import',
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted/30 rounded-lg px-2 py-1.5">
                      {benefit}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => {
                    setShow(false);
                    navigate('/payment?plan=weekly');
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white font-semibold text-sm hover:from-orange-400 hover:via-pink-400 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Unlock Premium — ₹49 for 7 days
                  <ArrowRight className="h-4 w-4" />
                </button>

                {/* Free alternative */}
                <button
                  onClick={() => {
                    setShow(false);
                    navigate('/signup');
                  }}
                  className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Ya pehle free try karo →
                </button>

                <p className="text-center text-[10px] text-muted-foreground">
                  🔒 Secured by Razorpay • No automatic renewal
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
