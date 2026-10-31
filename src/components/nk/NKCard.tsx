import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const nkCardVariants = cva(
  'rounded-[var(--nk-radius-lg)] border text-fg-primary transition-[box-shadow,border-color,transform,background-color] ' +
    'duration-[var(--nk-dur-base)] ease-[var(--nk-ease-out)]',
  {
    variants: {
      variant: {
        default: 'border-subtle bg-surface',
        elevated: 'border-subtle bg-surface-elevated shadow-nk-md',
        outline: 'border-active bg-transparent',
        muted: 'border-subtle bg-surface-secondary',
        gradient: 'border-[color:hsl(var(--border-active-hsl)/0.6)] bg-[image:var(--nk-grad-secondary)] text-fg-inverse shadow-nk-md',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3.5',
        md: 'p-5',
        lg: 'p-6 md:p-7',
      },
      interactive: {
        true: 'cursor-pointer hover:-translate-y-0.5 hover:border-active hover:shadow-nk-md focus-visible:shadow-nk-focus',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', padding: 'md', interactive: false },
  },
);

export interface NKCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof nkCardVariants> {}

export const NKCard = React.forwardRef<HTMLDivElement, NKCardProps>(
  ({ className, variant, padding, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(nkCardVariants({ variant, padding, interactive }), className)} {...props} />
  ),
);
NKCard.displayName = 'NKCard';

export const NKCardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex items-start justify-between gap-3', className)} {...props} />
);

export const NKCardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 className={cn('text-[15px] font-semibold tracking-[-0.01em] text-fg-primary', className)} {...props} />
);

export const NKCardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={cn('text-[12.5px] leading-relaxed text-fg-muted', className)} {...props} />
);

/** Deliberately restrained glass — reserved for overlays and hero widgets. */
export const NKGlassCard = React.forwardRef<HTMLDivElement, NKCardProps & { blur?: 'sm' | 'md' | 'lg' }>(
  ({ className, blur = 'md', ...props }, ref) => (
    <NKCard
      ref={ref}
      variant="outline"
      className={cn(
        'border-[color:var(--nk-glass-border)] bg-[color:var(--nk-glass-bg)] shadow-nk-md backdrop-saturate-150',
        blur === 'sm' && 'backdrop-blur-sm',
        blur === 'md' && 'backdrop-blur-md',
        blur === 'lg' && 'backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  ),
);
NKGlassCard.displayName = 'NKGlassCard';

export { nkCardVariants };
