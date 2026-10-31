import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const nkButtonVariants = cva(
  'nk-focus-ring inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--nk-radius-sm)] font-semibold ' +
    'transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--nk-dur-fast)] ease-[var(--nk-ease-out)] ' +
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ' +
    'active:translate-y-px active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-nk-sm hover:bg-[hsl(var(--primary-hover-hsl))] hover:shadow-nk-md',
        secondary:
          'bg-surface-secondary text-fg-primary border border-subtle hover:bg-surface-hover hover:border-active',
        outline:
          'border border-active bg-transparent text-fg-primary hover:bg-surface-hover hover:border-strong',
        ghost: 'bg-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg-primary',
        highlight:
          'bg-accent-primary text-accent-primary-foreground shadow-nk-sm hover:brightness-[1.04] hover:shadow-nk-md',
        gradient:
          'bg-[image:var(--nk-grad-accent)] text-[#2a1a24] shadow-nk-sm hover:shadow-nk-md hover:brightness-[1.03]',
        destructive:
          'bg-error text-error-foreground shadow-nk-xs hover:brightness-[1.05]',
        link: 'text-accent-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 rounded-[var(--nk-radius-xs)] px-2.5 text-[11.5px]',
        sm: 'h-9 px-3.5 text-[12.5px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px] rounded-[var(--nk-radius-md)]',
        icon: 'h-10 w-10 p-0',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export interface NKButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof nkButtonVariants> {
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const NKButton = React.forwardRef<HTMLButtonElement, NKButtonProps>(
  ({ className, variant, size, fullWidth, loading = false, leadingIcon, trailingIcon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(nkButtonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  ),
);
NKButton.displayName = 'NKButton';

export { nkButtonVariants };
