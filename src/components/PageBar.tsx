import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Trash2, ChevronLeft, ChevronRight, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface PageBarProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage: (index: number) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoToPage: (index: number) => void;
}

export const PageBar: React.FC<PageBarProps> = ({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddPage,
  onDeletePage,
  canGoPrev,
  canGoNext,
  onGoToPage,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);
  const reduced = !!useReducedMotion();

  const handleDeleteClick = () => {
    if (totalPages > 1) {
      setPageToDelete(currentPage - 1);
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (pageToDelete !== null) {
      onDeletePage(pageToDelete);
      setShowDeleteConfirm(false);
      setPageToDelete(null);
    }
  };

  // Generate page thumbnails (show max 5 pages around current).
  // Memoised so typing in the editor never re-derives the strip, and the
  // same keys are reused for every render (no thumbnail flicker).
  const visiblePages = useMemo(() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - 1 - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);
    
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-1 sm:gap-2 p-1.5 sm:p-2 bg-card/80 backdrop-blur-md rounded-xl sm:rounded-2xl border border-border/50 shadow-lg h-10 sm:h-12 w-full overflow-hidden"
      >
        {/* Left: Navigation */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevPage}
            disabled={!canGoPrev}
            className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-secondary"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>

          {/* Page Thumbnails - Simplified for mobile */}
          <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 overflow-hidden">
            <AnimatePresence initial={false}>
              {visiblePages.map((pageIndex, position) => (
                <motion.button
                  key={pageIndex}
                  initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}
                  whileHover={reduced ? undefined : { scale: 1.08 }}
                  whileTap={reduced ? undefined : { scale: 0.95 }}
                  onClick={() => onGoToPage(pageIndex)}
                  className={cn(
                    "min-w-[1.5rem] h-7 sm:min-w-[2rem] sm:h-9 px-1 rounded-md sm:rounded-lg inline-flex items-center justify-center text-[10px] sm:text-xs font-medium transition-all duration-200 border flex-shrink-0 leading-none",
                    pageIndex === currentPage - 1
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-background border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    // Keep three thumbnails on phones via CSS, not a render-time window read.
                    position > 2 ? "hidden sm:inline-flex" : ""
                  )}
                >
                  {pageIndex + 1}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNextPage}
            disabled={!canGoNext}
            className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-secondary"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>

        {/* Center: Page Info - Fixed width */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-secondary/50 rounded-md sm:rounded-lg flex-shrink-0">
          <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground hidden sm:block" />
          <span className="text-[10px] sm:text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
            {currentPage}/{totalPages}
          </span>
        </div>

        {/* Right: Actions - Compact */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddPage}
              className="h-7 sm:h-9 gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 hover:border-primary px-1.5 sm:px-2"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline text-xs">New</span>
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              disabled={totalPages <= 1}
              className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle>Delete Page {pageToDelete !== null ? pageToDelete + 1 : ''}?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              This action cannot be undone. All content on this page will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              Delete Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
