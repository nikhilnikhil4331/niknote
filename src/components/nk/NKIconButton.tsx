import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const nkIconButtonVariants = cva(
  'nk-focus-ring inline-flex items-center justify-center rounded-[var(--nk-radius-sm)] transition-[background-color,color,border-color,box-shadow,transform] ' +
    'duration-[var(--nk-dur-fast)] ease-[var(--nk-ease-out)] disabled:pointer-events-none disabled:opacity-45 active:scale-95',
  {
    variants: {
      variant: {
        solid: 'bg-primary text-primary-foreground shadow-nk-sm hover:bg-[hsl(var(--primary-hover-hsl))]',
        soft: 'bg-surface-secondary text-fg-secondary border border-subtle hover:bg-surface-hover hover:text-fg-primary',
        ghost: 'bg-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg-primary',
        outline: 'border border-active text-fg-secondary hover:border-strong hover:text-fg-primary',
        highlight: 'bg-accent-primary text-accent-primary-foreground hover:brightness-105',
      },
      size: {
        sm: 'h-8 w-8 [&_svg]:size-4',
        md: 'h-10 w-10 [&_svg]:size-[18px]',
        lg: 'h-12 w-12 rounded-[var(--nk-radius-md)] [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface NKIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof nkIconButtonVariants> {
  /** Required: icon-only controls must expose an accessible name. */
  'aria-label': string;
  loading?: boolean;
  icon: React.ReactNode;
}

export const NKIconButton = React.forwardRef<HTMLButtonElement, NKIconButtonProps>(
  ({ className, variant, size, loading, icon, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(nkIconButtonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
    </button>
  ),
);
NKIconButton.displayName = 'NKIconButton';

export { nkIconButtonVariants };
