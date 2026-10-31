import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NKSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  shortcut?: string;
  containerClassName?: string;
}

export const NKSearch = React.forwardRef<HTMLInputElement, NKSearchProps>(
  ({ value, onValueChange, placeholder = 'Search…', shortcut, className, containerClassName, ...props }, ref) => (
    <div
      role="search"
      className={cn(
        'flex h-10 items-center gap-2 rounded-[var(--nk-radius-sm)] border border-subtle bg-surface-secondary px-3',
        'transition-[border-color,box-shadow,background-color] duration-[var(--nk-dur-fast)]',
        'focus-within:border-[color:hsl(var(--focus-ring-hsl))] focus-within:bg-surface focus-within:shadow-nk-focus',
        containerClassName,
      )}
    >
      <Search size={15} className="flex-none text-fg-muted" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-full w-full min-w-0 bg-transparent text-[13px] text-fg-primary outline-none placeholder:text-fg-muted/70', className)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Clear search"
          className="nk-focus-ring grid h-6 w-6 flex-none place-items-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg-primary"
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : (
        shortcut && (
          <kbd className="flex-none rounded-[5px] border border-subtle bg-surface px-1.5 py-0.5 font-sans text-[10px] font-semibold text-fg-muted">
            {shortcut}
          </kbd>
        )
      )}
    </div>
  ),
);
NKSearch.displayName = 'NKSearch';
