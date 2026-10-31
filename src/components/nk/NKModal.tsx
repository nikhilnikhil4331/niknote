import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NKIconButton } from './NKIconButton';

export const NKModal = DialogPrimitive.Root;
export const NKModalTrigger = DialogPrimitive.Trigger;
export const NKModalClose = DialogPrimitive.Close;

const sizeMap = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]',
} as const;

export interface NKModalContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof sizeMap;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  hideClose?: boolean;
}

export const NKModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  NKModalContentProps
>(({ className, children, size = 'md', title, description, footer, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-[80] bg-[color:var(--nk-scrim)] backdrop-blur-[3px]',
        'data-[state=open]:animate-[nk-fade_var(--nk-dur-fast)_var(--nk-ease-out)]',
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2',
        'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[var(--nk-radius-xl)] border border-subtle bg-surface-elevated',
        'p-5 text-fg-primary shadow-nk-lg sm:p-6',
        'data-[state=open]:animate-[nk-scale-in_var(--nk-dur-base)_var(--nk-ease-out)]',
        sizeMap[size],
        className,
      )}
      {...props}
    >
      <div className="mb-4 pr-9">
        <DialogPrimitive.Title className="text-[17px] font-semibold tracking-[-0.015em] text-fg-primary">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      {children}
      {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      {!hideClose && (
        <DialogPrimitive.Close asChild>
          <NKIconButton
            aria-label="Close dialog"
            variant="ghost"
            size="sm"
            icon={<X aria-hidden="true" />}
            className="absolute right-3 top-3"
          />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
NKModalContent.displayName = 'NKModalContent';
