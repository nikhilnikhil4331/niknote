import React from 'react';
import { motion } from 'framer-motion';
import { PenLine, Palette, Eye, Trophy, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export type AppStep = 'content' | 'style' | 'preview';

interface BottomNavBarProps {
  currentStep: AppStep;
  onStepChange: (step: AppStep) => void;
}

const NAV_ITEMS: { key: AppStep; icon: React.ElementType; label: string }[] = [
  { key: 'content', icon: PenLine, label: 'Write' },
  { key: 'style', icon: Palette, label: 'Style' },
  { key: 'preview', icon: Eye, label: 'Preview' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentStep, onStepChange }) => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/40 safe-area-pb">
      <div className="flex items-stretch h-16 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentStep === item.key;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => onStepChange(item.key)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavActive"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-12 h-[3px] bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <motion.div
                animate={isActive ? { scale: 1.1, y: -1 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              <span className={cn(
                "text-[10px] font-medium transition-all",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </motion.button>
          );
        })}

        {/* Flashcards tab */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/flashcards')}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground"
          aria-label="Flashcards"
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-medium">Cards</span>
        </motion.button>

        {/* Achievements tab */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/achievements')}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground"
          aria-label="Achievements"
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-medium">Badges</span>
        </motion.button>
      </div>
    </div>
  );
};
