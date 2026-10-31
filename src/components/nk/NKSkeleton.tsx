import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'block' | 'circle';
}

/** Shimmer skeleton — no infinite motion when reduced motion is requested. */
export const NKSkeleton: React.FC<NKSkeletonProps> = ({ className, variant = 'block', ...props }) => (
  <div
    aria-hidden="true"
    className={cn(
      'relative overflow-hidden bg-[color:hsl(var(--surface-hover-hsl))]',
      'after:absolute after:inset-0 after:animate-[nk-shimmer_1.6s_linear_infinite] after:bg-[length:200%_100%]',
      'after:bg-[linear-gradient(90deg,transparent,hsl(var(--surface-elevated-hsl)/0.55),transparent)]',
      variant === 'text' && 'h-3 rounded-full',
      variant === 'block' && 'rounded-[var(--nk-radius-md)]',
      variant === 'circle' && 'rounded-full',
      className,
    )}
    {...props}
  />
);
