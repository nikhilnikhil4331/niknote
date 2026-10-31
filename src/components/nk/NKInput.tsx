import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

export const NKInput = React.forwardRef<HTMLInputElement, NKInputProps>(
  ({ className, containerClassName, label, hint, error, leadingIcon, trailing, id, disabled, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id || `nk-input-${reactId}`;
    const helpId = `${inputId}-help`;
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
            {label}
          </label>
        )}
        <div
          className={cn(
            'group relative flex items-center gap-2 rounded-[var(--nk-radius-sm)] border bg-surface-secondary px-3',
            'transition-[border-color,box-shadow,background-color] duration-[var(--nk-dur-fast)] ease-[var(--nk-ease-out)]',
            'focus-within:border-[color:hsl(var(--focus-ring-hsl))] focus-within:bg-surface focus-within:shadow-nk-focus',
            error ? 'border-error' : 'border-subtle hover:border-active',
            disabled && 'cursor-not-allowed opacity-55',
          )}
        >
          {leadingIcon && <span className="flex-none text-fg-muted" aria-hidden="true">{leadingIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={hint || error ? helpId : undefined}
            className={cn(
              'h-10 w-full min-w-0 bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-muted/70',
              className,
            )}
            {...props}
          />
          {trailing && <span className="flex flex-none items-center text-fg-muted">{trailing}</span>}
        </div>
        {(hint || error) && (
          <p id={helpId} className={cn('text-[11.5px] leading-snug', error ? 'text-error' : 'text-fg-muted')}>
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);
NKInput.displayName = 'NKInput';
