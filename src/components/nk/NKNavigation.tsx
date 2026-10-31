import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKNavigationItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
}

export interface NKNavigationProps {
  items: NKNavigationItem[];
  activeId?: string;
  orientation?: 'horizontal' | 'vertical' | 'bottom';
  ariaLabel?: string;
  className?: string;
}

/**
 * Shared navigation surface for the top bar, in-page tabs and the mobile
 * bottom bar. The active indicator uses Rose Wine on calm surfaces and
 * reserves Amber for the "important action" slot.
 */
export const NKNavigation: React.FC<NKNavigationProps> = ({
  items,
  activeId,
  orientation = 'horizontal',
  ariaLabel = 'Primary',
  className,
}) => (
  <nav
    aria-label={ariaLabel}
    className={cn(
      'flex items-center gap-1',
      orientation === 'horizontal' && 'flex-row',
      orientation === 'vertical' && 'flex-col items-stretch',
      orientation === 'bottom' &&
        'fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 h-[64px] justify-around rounded-[var(--nk-radius-xl)] border border-subtle bg-[color:var(--nk-glass-bg)] px-2 shadow-nk-lg backdrop-blur-xl',
      className,
    )}
  >
    {items.map((item) => {
      const active = item.id === activeId;
      const Tag = item.href ? 'a' : 'button';
      return (
        <Tag
          key={item.id}
          href={item.href}
          onClick={item.onSelect}
          type={item.href ? undefined : 'button'}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'nk-focus-ring group relative flex min-h-[40px] items-center gap-2 rounded-[var(--nk-radius-sm)] px-3 text-[13px] font-semibold',
            'transition-[background-color,color,transform] duration-[var(--nk-dur-fast)] ease-[var(--nk-ease-out)]',
            orientation === 'bottom' && 'min-h-[48px] flex-1 flex-col justify-center gap-0.5 rounded-[var(--nk-radius-md)] px-1 text-[10.5px]',
            active
              ? 'bg-[color:hsl(var(--primary)/0.16)] text-[color:hsl(var(--text-primary-hsl))]'
              : 'text-fg-muted hover:bg-surface-hover hover:text-fg-primary',
            active && orientation === 'vertical' && 'bg-[color:hsl(var(--primary)/0.18)]',
          )}
        >
          {active && orientation !== 'bottom' && (
            <span
              aria-hidden="true"
              className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[image:var(--nk-grad-accent)]"
            />
          )}
          {item.icon && <span className={cn('flex-none', active && 'text-accent-primary')}>{item.icon}</span>}
          <span className="truncate">{item.label}</span>
          {item.badge}
        </Tag>
      );
    })}
  </nav>
);
