import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, MoreVertical, Undo2, Redo2, Sparkles, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NikAIMarkIcon } from '@/components/nikai/NikAIBrand';

interface AppHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExport: () => void;
  isExporting: boolean;
  wordCount: number;
  currentPage: number;
  totalPages: number;
  currentStreak: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title, onTitleChange, onExport, isExporting, wordCount, currentPage, totalPages, currentStreak,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between px-4 pb-2 border-b border-border/30 bg-background/95 backdrop-blur-lg z-40 flex-shrink-0"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)', minHeight: 52 }}
    >
      {/* Left: Editable Title + Stats */}
      <div className="flex-1 min-w-0 mr-3">
        {isEditing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            className="w-full text-sm font-semibold bg-transparent border-b border-primary outline-none text-foreground"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-semibold text-foreground truncate block max-w-[160px]"
          >
            {title || 'Untitled Note'}
          </button>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>Page {currentPage}/{totalPages}</span>
        </div>
      </div>

      {/* Right: Streak + Export + More */}
      <div className="flex items-center gap-1.5">
        {/* Streak Badge */}
        <motion.div
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold",
            currentStreak > 0
              ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
              : "bg-muted/50 text-muted-foreground"
          )}
          animate={currentStreak > 0 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Flame className={cn("w-3.5 h-3.5", currentStreak > 0 && "text-orange-500")} />
          <span>{currentStreak}</span>
        </motion.div>

        {/* Export */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onExport}
          disabled={isExporting}
          className={cn(
            "h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5",
            "bg-primary text-primary-foreground shadow-md shadow-primary/20",
            "disabled:opacity-50"
          )}
        >
          <Download className="w-3.5 h-3.5" />
          {isExporting ? '...' : 'Export'}
        </motion.button>

        {/* More menu */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="absolute right-0 top-10 z-50 w-48 rounded-2xl bg-card border border-border/50 shadow-xl py-2"
                >
                  <MenuButton icon={<Undo2 className="w-4 h-4" />} label="Undo" onClick={() => setShowMenu(false)} />
                  <MenuButton icon={<Redo2 className="w-4 h-4" />} label="Redo" onClick={() => setShowMenu(false)} />
                  <div className="h-px bg-border/50 my-1 mx-3" />
                  <MenuButton icon={<NikAIMarkIcon className="w-[18px] h-[18px]" />} label="AI Writing Help" onClick={() => setShowMenu(false)} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
};

const MenuButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
  >
    <span className="text-muted-foreground">{icon}</span>
    {label}
  </button>
);
