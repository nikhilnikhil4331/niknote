import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Trash2, ChevronRight } from 'lucide-react';
import { Notebook } from '@/hooks/useNotebooks';
import { formatDistanceToNow } from 'date-fns';

interface NotebookCardProps {
  notebook: Notebook;
  index: number;
  onClick: () => void;
  onDelete: () => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
  notebook,
  index,
  onClick,
  onDelete,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      {/* Cover color strip */}
      <div 
        className="h-3 w-full"
        style={{ backgroundColor: notebook.cover_color }}
      />

      <div className="p-5">
        {/* Notebook icon */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ backgroundColor: `${notebook.cover_color}20` }}
        >
          <BookOpen 
            className="w-6 h-6" 
            style={{ color: notebook.cover_color }} 
          />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-accent-rose transition-colors">
          {notebook.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {notebook.description || 'No description'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notebook.updated_at), { addSuffix: true })}
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent-rose group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-5 right-3 p-2 rounded-lg bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
