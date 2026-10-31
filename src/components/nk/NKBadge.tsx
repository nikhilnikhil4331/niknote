import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const nkBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[var(--nk-radius-pill)] px-2 py-0.5 text-[10.5px] font-semibold leading-[18px] whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-secondary text-fg-secondary border border-subtle',
        brand: 'bg-[color:hsl(var(--primary)/0.16)] text-[color:hsl(var(--text-primary-hsl))] border border-[color:hsl(var(--primary)/0.32)]',
        rose: 'bg-[color:hsl(var(--primary)/0.18)] text-fg-primary border border-[color:hsl(var(--primary)/0.3)]',
        amber: 'bg-[color:hsl(var(--accent-primary-hsl)/0.18)] text-[color:hsl(var(--accent-primary-hsl))] border border-[color:hsl(var(--accent-primary-hsl)/0.32)]',
        blush: 'bg-[color:hsl(var(--accent-primary-hsl)/0.1)] text-accent-primary border border-subtle',
        success: 'bg-[color:hsl(var(--success)/0.16)] text-success border border-[color:hsl(var(--success)/0.32)]',
        warning: 'bg-[color:hsl(var(--warning)/0.16)] text-warning border border-[color:hsl(var(--warning)/0.32)]',
        danger: 'bg-[color:hsl(var(--error)/0.16)] text-error border border-[color:hsl(var(--error)/0.32)]',
        solid: 'bg-primary text-primary-foreground',
        highlight: 'bg-accent-primary text-accent-primary-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface NKBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof nkBadgeVariants> {}

export const NKBadge: React.FC<NKBadgeProps> = ({ className, tone, ...props }) => (
  <span className={cn(nkBadgeVariants({ tone }), className)} {...props} />
);

export { nkBadgeVariants };
