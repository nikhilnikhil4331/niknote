import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const NKDropdown = DropdownMenuPrimitive.Root;
export const NKDropdownTrigger = DropdownMenuPrimitive.Trigger;
export const NKDropdownGroup = DropdownMenuPrimitive.Group;

export const NKDropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[70] min-w-[200px] overflow-hidden rounded-[var(--nk-radius-md)] border border-subtle bg-surface-elevated p-1.5',
        'text-fg-primary shadow-nk-lg',
        'data-[state=open]:animate-[nk-scale-in_var(--nk-dur-fast)_var(--nk-ease-out)]',
        'data-[state=closed]:opacity-0',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
NKDropdownContent.displayName = 'NKDropdownContent';

export const NKDropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--nk-radius-xs)] px-2.5 py-2 text-[13px] font-medium outline-none',
      'transition-colors duration-[var(--nk-dur-fast)]',
      'data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg-primary',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
      destructive ? 'text-error data-[highlighted]:bg-[color:hsl(var(--error)/0.12)]' : 'text-fg-secondary',
      className,
    )}
    {...props}
  />
));
NKDropdownItem.displayName = 'NKDropdownItem';

export const NKDropdownCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--nk-radius-xs)] py-2 pl-7 pr-2.5 text-[13px] text-fg-secondary outline-none',
      'data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg-primary',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 grid h-4 w-4 place-items-center text-accent-primary">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check size={13} aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
NKDropdownCheckboxItem.displayName = 'NKDropdownCheckboxItem';

export const NKDropdownLabel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Label
    className={cn('px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-fg-muted', className)}
    {...props}
  />
);

export const NKDropdownSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Separator className={cn('my-1 h-px bg-[color:hsl(var(--border-subtle-hsl))]', className)} {...props} />
);

export const NKDropdownSubTrigger: React.FC<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>> = ({
  className,
  children,
  ...props
}) => (
  <DropdownMenuPrimitive.SubTrigger
    className={cn('flex cursor-pointer items-center gap-2 rounded-[var(--nk-radius-xs)] px-2.5 py-2 text-[13px] text-fg-secondary data-[state=open]:bg-surface-hover', className)}
    {...props}
  >
    {children}
    <ChevronRight size={13} className="ml-auto" aria-hidden="true" />
  </DropdownMenuPrimitive.SubTrigger>
);
