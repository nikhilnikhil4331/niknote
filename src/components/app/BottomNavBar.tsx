import React from 'react';
import { motion } from 'framer-motion';
import { PenLine, Palette, Eye, Trophy, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';

export type AppStep = 'content' | 'style' | 'preview';

interface BottomNavBarProps {
  currentStep: AppStep;
  onStepChange: (step: AppStep) => void;
}

type NavItem =
  | { key: AppStep; kind: 'step'; icon: React.ElementType; label: string }
  | { key: string; kind: 'route'; icon: React.ElementType; label: string; path: string };

const NAV_ITEMS: NavItem[] = [
  { key: 'content', kind: 'step',  icon: PenLine, label: 'Write' },
  { key: 'style',   kind: 'step',  icon: Palette, label: 'Style' },
  { key: 'preview', kind: 'step',  icon: Eye,     label: 'Preview' },
  { key: 'cards',   kind: 'route', icon: Layers,  label: 'Cards',  path: '/flashcards' },
  { key: 'badges',  kind: 'route', icon: Trophy,  label: 'Badges', path: '/achievements' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentStep, onStepChange }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isItemActive = (item: NavItem) =>
    item.kind === 'step' ? currentStep === item.key : location.pathname === item.path;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-2xl border-t border-border/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-[58px] max-w-md mx-auto px-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() =>
                item.kind === 'step' ? onStepChange(item.key) : navigate(item.path)
              }
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl mx-0.5 my-1.5',
                'transition-colors duration-200 active:scale-[0.94]',
                isActive ? 'text-primary' : 'text-muted-foreground/80'
              )}
              style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavActivePill"
                  className="absolute inset-0 rounded-2xl bg-primary/10"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative z-10">
                <Icon
                  className={cn(
                    'w-[22px] h-[22px] transition-transform duration-200',
                    isActive && '-translate-y-[1px]'
                  )}
                  strokeWidth={isActive ? 2.4 : 2}
                />
              </span>
              <span
                className={cn(
                  'relative z-10 text-[10px] tracking-wide leading-none',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
