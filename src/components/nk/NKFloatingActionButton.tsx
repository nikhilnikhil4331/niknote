import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKFloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  extended?: boolean;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  tone?: 'primary' | 'amber' | 'gradient';
}

const positions = {
  'bottom-right': 'right-4 sm:right-6 bottom-[calc(20px+env(safe-area-inset-bottom))]',
  'bottom-center': 'left-1/2 -translate-x-1/2 bottom-[calc(20px+env(safe-area-inset-bottom))]',
  'bottom-left': 'left-4 sm:left-6 bottom-[calc(20px+env(safe-area-inset-bottom))]',
} as const;

const tones = {
  primary: 'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover-hsl))]',
  amber: 'bg-accent-primary text-accent-primary-foreground',
  gradient: 'bg-[image:var(--nk-grad-accent)] text-[#2a1a24]',
} as const;

export const NKFloatingActionButton = React.forwardRef<HTMLButtonElement, NKFloatingActionButtonProps>(
  ({ className, icon, label, extended = false, position = 'bottom-right', tone = 'gradient', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'nk-focus-ring fixed z-40 inline-flex items-center justify-center gap-2 rounded-[var(--nk-radius-lg)] shadow-nk-lg',
        'transition-[transform,box-shadow,filter] duration-[var(--nk-dur-fast)] ease-[var(--nk-ease-out)]',
        'hover:-translate-y-0.5 hover:shadow-nk-lg active:translate-y-0 active:scale-95',
        extended ? 'h-12 px-4 text-[13px] font-bold' : 'h-14 w-14',
        'motion-safe:animate-[nk-scale-in_var(--nk-dur-base)_var(--nk-ease-spring)]',
        positions[position],
        tones[tone],
        className,
      )}
      {...props}
    >
      <span className="[&_svg]:size-5" aria-hidden="true">{icon}</span>
      {extended && <span>{label}</span>}
    </button>
  ),
);
NKFloatingActionButton.displayName = 'NKFloatingActionButton';
