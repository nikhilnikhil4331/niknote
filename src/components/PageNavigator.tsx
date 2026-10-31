import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddPage,
  canGoPrev,
  canGoNext,
}) => {
  const { triggerHaptic } = useHaptics();
  const { playClick } = useSoundEffects();

  const handlePrevPage = () => {
    if (canGoPrev) {
      triggerHaptic('light');
      playClick();
      onPrevPage();
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      triggerHaptic('light');
      playClick();
      onNextPage();
    }
  };

  const handleAddPage = () => {
    triggerHaptic('medium');
    playClick();
    onAddPage();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-card/95 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border/60 shadow-lg"
    >
      {/* Previous Button */}
      <motion.div whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevPage}
          disabled={!canGoPrev}
          className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl transition-all duration-200 hover:bg-primary/10 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </motion.div>

      {/* Page Indicator */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 min-w-[90px] sm:min-w-[120px] justify-center">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-rose" />
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={currentPage}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="font-semibold text-xs sm:text-sm text-foreground tabular-nums whitespace-nowrap"
          >
            {currentPage} / {totalPages}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Next Button */}
      <motion.div whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextPage}
          disabled={!canGoNext}
          className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl transition-all duration-200 hover:bg-primary/10 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </motion.div>

      {/* Separator */}
      <div className="w-px h-5 sm:h-6 bg-border/60 mx-0.5 sm:mx-1" />

      {/* Add Page Button */}
      <motion.div whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddPage}
          className="h-8 sm:h-10 gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border-dashed border-primary/40 text-accent-rose hover:bg-primary/10 hover:border-primary px-2 sm:px-3"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="text-xs font-medium hidden sm:inline">New Page</span>
        </Button>
      </motion.div>
    </motion.div>
  );
};
