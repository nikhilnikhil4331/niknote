import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKProgressBarProps {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tone?: 'primary' | 'amber' | 'success' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
  className?: string;
}

const toneMap: Record<NonNullable<NKProgressBarProps['tone']>, string> = {
  primary: 'bg-primary',
  amber: 'bg-accent-primary',
  success: 'bg-success',
  brand: 'bg-[image:var(--nk-grad-accent)]',
};

const sizeMap = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' } as const;

export const NKProgressBar: React.FC<NKProgressBarProps> = ({
  value = 0,
  max = 100,
  label,
  showValue = false,
  tone = 'brand',
  size = 'md',
  indeterminate = false,
  className,
}) => {
  const pct = Math.max(0, Math.min(100, (value / (max || 100)) * 100));
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-[11.5px] font-semibold text-fg-secondary">{label}</span>}
          {showValue && <span className="text-[11px] font-semibold tabular-nums text-fg-muted">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className={cn('w-full overflow-hidden rounded-[var(--nk-radius-pill)] bg-[color:hsl(var(--surface-hover-hsl))]', sizeMap[size])}
      >
        <div
          className={cn(
            'h-full rounded-[var(--nk-radius-pill)] transition-[width] duration-[var(--nk-dur-slower)] ease-[var(--nk-ease-out)]',
            toneMap[tone],
            indeterminate && 'w-1/3 animate-[nk-shimmer_1.6s_linear_infinite] bg-[length:200%_100%]',
          )}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
