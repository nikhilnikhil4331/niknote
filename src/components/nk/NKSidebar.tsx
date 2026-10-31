import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKSidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const NKSidebar = React.forwardRef<HTMLElement, NKSidebarProps>(
  ({ className, collapsed = false, header, footer, children, ...props }, ref) => (
    <aside
      ref={ref}
      data-collapsed={collapsed || undefined}
      className={cn(
        'flex h-full flex-none flex-col overflow-hidden border-r border-subtle bg-background-secondary',
        'transition-[width] duration-[var(--nk-dur-slow)] ease-[var(--nk-ease-out)]',
        collapsed ? 'w-[72px]' : 'w-[264px]',
        className,
      )}
      {...props}
    >
      {header && <div className="flex-none px-3 pb-2 pt-3">{header}</div>}
      <div className="nk-scrollbar-none flex-1 overflow-y-auto px-2 pb-3">{children}</div>
      {footer && <div className="flex-none border-t border-subtle p-2">{footer}</div>}
    </aside>
  ),
);
NKSidebar.displayName = 'NKSidebar';

export interface NKSidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
  count?: number;
  collapsed?: boolean;
  accent?: boolean;
}

export const NKSidebarItem = React.forwardRef<HTMLButtonElement, NKSidebarItemProps>(
  ({ className, active, icon, label, count, collapsed, accent, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'nk-focus-ring group relative flex w-full items-center gap-2.5 rounded-[var(--nk-radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium',
        'transition-[background-color,color] duration-[var(--nk-dur-fast)] ease-[var(--nk-ease-out)]',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-[color:hsl(var(--primary)/0.18)] font-semibold text-[color:hsl(var(--text-primary-hsl))]'
          : 'text-fg-secondary hover:bg-surface-hover hover:text-fg-primary',
        accent && !active && 'text-accent-primary',
        className,
      )}
      {...props}
    >
      {active && (
        <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[image:var(--nk-grad-accent)]" />
      )}
      {icon && <span className={cn('flex-none [&_svg]:size-[17px]', active ? 'text-accent-primary' : 'text-fg-muted group-hover:text-fg-primary')}>{icon}</span>}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && typeof count === 'number' && count > 0 && (
        <span className="ml-auto rounded-[var(--nk-radius-pill)] bg-surface px-1.5 text-[10.5px] font-bold tabular-nums text-fg-muted">
          {count}
        </span>
      )}
    </button>
  ),
);
NKSidebarItem.displayName = 'NKSidebarItem';

export const NKSidebarSection: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={cn('px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-fg-muted', className)}
    {...props}
  />
);
