import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export const NKEmptyState: React.FC<NKEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-[var(--nk-radius-lg)] border border-dashed border-active bg-surface-secondary/60 px-6 py-10 text-center',
      className,
    )}
  >
    <span
      aria-hidden="true"
      className="grid h-12 w-12 place-items-center rounded-[var(--nk-radius-md)] bg-[color:hsl(var(--primary)/0.14)] text-accent-primary [&_svg]:size-5"
    >
      {icon}
    </span>
    <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg-primary">{title}</h3>
    {description && <p className="max-w-[42ch] text-[12.5px] leading-relaxed text-fg-muted">{description}</p>}
    {(action || secondaryAction) && (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {action}
        {secondaryAction}
      </div>
    )}
  </div>
);
