import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  side?: 'left' | 'right';
}

export const SlidePanel: React.FC<SlidePanelProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  side = 'right',
}) => {
  const { triggerHaptic } = useHaptics();
  const { playClick } = useSoundEffects();

  const handleClose = () => {
    triggerHaptic('light');
    playClick();
    onClose();
  };

  const slideVariants = {
    hidden: {
      x: side === 'right' ? '100%' : '-100%',
      opacity: 0,
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        damping: 30,
        stiffness: 300,
      },
    },
    exit: {
      x: side === 'right' ? '100%' : '-100%',
      opacity: 0,
      transition: {
        type: 'spring' as const,
        damping: 30,
        stiffness: 300,
      },
    },
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClose}
            className="fixed inset-0 bg-[color:var(--nk-scrim)] backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            variants={slideVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              fixed top-0 bottom-0 z-50 w-[320px] max-w-[85vw]
              bg-card border-border shadow-2xl
              ${side === 'right' ? 'right-0 border-l rounded-l-3xl' : 'left-0 border-r rounded-r-3xl'}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                {icon && (
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    {icon}
                  </div>
                )}
                <h2 className="font-semibold text-base text-foreground">{title}</h2>
              </div>
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-9 w-9 rounded-xl hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto h-[calc(100vh-70px)] p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
