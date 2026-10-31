import * as React from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDarkMode } from '@/hooks/useDarkMode';

/** App-wide toast surface, themed with Sunset Plum tokens. */
export const NKToaster: React.FC = () => {
  const { isDark } = useDarkMode();
  return (
    <Toaster
      theme={isDark ? 'dark' : 'light'}
      position="top-center"
      closeButton
      toastOptions={{
        style: { pointerEvents: 'auto' },
        classNames: {
          toast:
            'group nk-toast !rounded-[var(--nk-radius-md)] !border !border-[color:hsl(var(--border-subtle-hsl))] !bg-[hsl(var(--surface-elevated-hsl))] !text-[hsl(var(--text-primary-hsl))] !shadow-[var(--nk-shadow-lg)] !font-sans',
          title: '!text-[13px] !font-semibold',
          description: '!text-[12px] !text-[hsl(var(--text-muted-hsl))]',
          actionButton: '!bg-[hsl(var(--primary))] !text-[hsl(var(--primary-foreground))] !rounded-[var(--nk-radius-xs)]',
          cancelButton: '!bg-[hsl(var(--surface-hover-hsl))] !text-[hsl(var(--text-secondary-hsl))] !rounded-[var(--nk-radius-xs)]',
          closeButton: '!border-[color:hsl(var(--border-subtle-hsl))] !bg-[hsl(var(--surface-elevated-hsl))] !text-[hsl(var(--text-muted-hsl))]',
        },
      }}
    />
  );
};

export interface NKToastProps {
  title: string;
  description?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
  className?: string;
}

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const toneClass = {
  info: 'text-accent-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
} as const;

/** Static toast card (used by design-system previews and inline status). */
export const NKToast: React.FC<NKToastProps> = ({ title, description, tone = 'info', className }) => {
  const Icon = toneIcon[tone];
  return (
    <div
      role="status"
      className={cn(
        'flex w-full items-start gap-2.5 rounded-[var(--nk-radius-md)] border border-subtle bg-surface-elevated p-3 shadow-nk-md',
        className,
      )}
    >
      <Icon size={16} className={cn('mt-0.5 flex-none', toneClass[tone])} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-fg-primary">{title}</p>
        {description && <p className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">{description}</p>}
      </div>
    </div>
  );
};

/** Tokened helpers so call sites never hand-roll toast styling. */
export const nkToast = {
  ...sonnerToast,
  success: (message: string, description?: string) => sonnerToast.success(message, { description }),
  error: (message: string, description?: string) => sonnerToast.error(message, { description }),
  warning: (message: string, description?: string) => sonnerToast.warning(message, { description }),
  info: (message: string, description?: string) => sonnerToast.info(message, { description }),
};
