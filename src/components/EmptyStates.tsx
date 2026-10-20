// ============================================================
// EmptyStates — Friendly empty states with illustrations
// Use when lists/views have no data
// ============================================================

import { FileText, BookOpen, Search, Pen } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className || ''}`}>
      {/* Animated icon container */}
      <div className="w-20 h-20 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-5 animate-float">
        {icon || <FileText className="w-9 h-9 text-primary/60" />}
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">{description}</p>
      
      {action && (
        <button
          onClick={action.onClick}
          className="btn-press btn-pill bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary-soft"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================
// Specific Empty States
// ============================================================

export function EmptyEditor() {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <Pen className="w-9 h-9 text-primary/60" />
          <div className="absolute -right-1 -top-1 w-3 h-3 bg-primary/20 rounded-full animate-pen-flow" />
        </div>
      }
      title="Start Writing"
      description="Type in the editor to see your text transformed into beautiful handwritten notes ✍️"
    />
  );
}

export function EmptyPreview() {
  return (
    <EmptyState
      icon={<BookOpen className="w-9 h-9 text-primary/60" />}
      title="Your Notes Will Appear Here"
      description="Write something on the left and watch your handwriting come to life on this paper"
    />
  );
}

export function EmptyNotebooks({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <EmptyState
      icon={<FileText className="w-9 h-9 text-primary/60" />}
      title="No Notebooks Yet"
      description="Create your first notebook and start writing beautiful handwritten notes"
      action={{
        label: "✨ Create Notebook",
        onClick: onCreateNew,
      }}
    />
  );
}

export function EmptySearchResult({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Search className="w-9 h-9 text-primary/60" />}
      title="No Results Found"
      description={`We couldn't find anything matching "${query}". Try a different search term.`}
    />
  );
}

export function EmptyAI() {
  return (
    <EmptyState
      icon={
        <img
          src="/nikai-mark.png"
          alt=""
          aria-hidden="true"
          className="h-12 w-auto object-contain select-none pointer-events-none"
        />
      }
      title="AI Writing Assistant"
      description="Ask NikAI to help write, solve, or improve your notes. Type a question or paste content to get started!"
    />
  );
}

// ============================================================
// CSS Animation for floating icon
// ============================================================
const style = document.createElement('style');
style.textContent = `
  @keyframes animate-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  .animate-float {
    animation: animate-float 3s ease-in-out infinite;
  }
`;
if (!document.querySelector('style[data-empty-states]')) {
  style.setAttribute('data-empty-states', '');
  document.head.appendChild(style);
}
