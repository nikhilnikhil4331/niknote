import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const NKTooltipProvider = TooltipPrimitive.Provider;

export interface NKTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  className?: string;
}

export const NKTooltip: React.FC<NKTooltipProps> = ({ content, children, side = 'top', delay = 220, className }) => (
  <TooltipPrimitive.Root delayDuration={delay}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={6}
        className={cn(
          'z-[90] max-w-[260px] rounded-[var(--nk-radius-sm)] border border-subtle bg-surface-elevated px-2.5 py-1.5',
          'text-[11.5px] font-medium leading-snug text-fg-primary shadow-nk-md',
          'data-[state=delayed-open]:animate-[nk-fade_var(--nk-dur-fast)_var(--nk-ease-out)]',
          className,
        )}
      >
        {content}
        <TooltipPrimitive.Arrow className="fill-surface-elevated" width={10} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
