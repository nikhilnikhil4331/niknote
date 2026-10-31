import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NKCalendarProps {
  /** Any date inside the month to display. */
  month?: Date;
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  /** yyyy-mm-dd → marker value. Numbers render a count dot, true renders a plain dot. */
  markers?: Record<string, number | boolean>;
  className?: string;
  ariaLabel?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const NKCalendar: React.FC<NKCalendarProps> = ({
  month: monthProp,
  selected,
  onSelect,
  onMonthChange,
  markers,
  className,
  ariaLabel = 'Calendar',
}) => {
  const initial = monthProp ?? selected ?? new Date();
  const [view, setView] = React.useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  React.useEffect(() => {
    if (monthProp) setView(new Date(monthProp.getFullYear(), monthProp.getMonth(), 1));
  }, [monthProp]);

  const todayKey = keyOf(new Date());
  const selectedKey = selected ? keyOf(selected) : null;

  const shift = (delta: number) => {
    const next = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    setView(next);
    onMonthChange?.(next);
  };

  // Monday-first grid
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={cn('w-full rounded-[var(--nk-radius-lg)] border border-subtle bg-surface p-3', className)} aria-label={ariaLabel}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="nk-focus-ring grid h-8 w-8 place-items-center rounded-[var(--nk-radius-xs)] text-fg-muted hover:bg-surface-hover hover:text-fg-primary"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <div aria-live="polite" className="text-[13px] font-semibold text-fg-primary">
          {view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="nk-focus-ring grid h-8 w-8 place-items-center rounded-[var(--nk-radius-xs)] text-fg-muted hover:bg-surface-hover hover:text-fg-primary"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <abbr
            key={d}
            title={d}
            className="py-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-fg-muted no-underline"
          >
            {d}
          </abbr>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`empty-${i}`} aria-hidden="true" />;
          const k = keyOf(date);
          const isToday = k === todayKey;
          const isSelected = k === selectedKey;
          const marker = markers?.[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect?.(startOfDay(date))}
              aria-pressed={isSelected}
              aria-label={`${date.toDateString()}${marker ? ', has activity' : ''}`}
              className={cn(
                'nk-focus-ring relative grid h-8 place-items-center rounded-[var(--nk-radius-xs)] text-[12px] font-semibold tabular-nums',
                'transition-[background-color,color,box-shadow] duration-[var(--nk-dur-fast)]',
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-nk-sm'
                  : isToday
                    ? 'text-accent-primary ring-1 ring-inset ring-[color:hsl(var(--accent-primary-hsl)/0.55)]'
                    : 'text-fg-secondary hover:bg-surface-hover hover:text-fg-primary',
              )}
            >
              {date.getDate()}
              {marker !== undefined && !isSelected && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute bottom-[3px] h-1 w-1 rounded-full',
                    typeof marker === 'number' && marker >= 3 ? 'bg-primary' : 'bg-accent-primary',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
