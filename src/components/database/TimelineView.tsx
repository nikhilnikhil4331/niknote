// ============================================================
// NikNote 4.0 — Timeline View
// Notion-style Gantt/timeline for project tracking
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, Sparkles,
  Calendar, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  color?: string;
  progress?: number; // 0-100
  assignee?: string;
  type?: 'task' | 'milestone' | 'exam' | 'project';
}

interface TimelineViewProps {
  items: TimelineItem[];
  onItemClick?: (item: TimelineItem) => void;
  onAddItem?: () => void;
}

const TIMELINE_COLORS = [
  'bg-[color:hsl(var(--accent-cool-solid-hsl))]', 'bg-primary', 'bg-success',
  'bg-nk-amber', 'bg-error', 'bg-[color:hsl(var(--accent-cool-solid-hsl))]',
  'bg-primary', 'bg-primary',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  items, onItemClick, onAddItem
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate the date range (3 months centered on current month)
  const rangeStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [currentDate]);

  const rangeEnd = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + 3);
    d.setDate(0);
    return d;
  }, [currentDate]);

  const totalDays = daysBetween(rangeStart, rangeEnd);
  const today = new Date();

  // Generate month headers
  const months = useMemo(() => {
    const result: { label: string; width: number; offset: number }[] = [];
    let d = new Date(rangeStart);
    while (d <= rangeEnd) {
      const monthStart = new Date(d);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const startOffset = daysBetween(rangeStart, monthStart);
      const width = daysBetween(monthStart, monthEnd) + 1;
      result.push({
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        width: (width / totalDays) * 100,
        offset: (startOffset / totalDays) * 100,
      });
      d.setMonth(d.getMonth() + 1);
    }
    return result;
  }, [rangeStart, rangeEnd, totalDays]);

  const prevRange = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextRange = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const todayOffset = daysBetween(rangeStart, today) / totalDays * 100;

  return (
    <div className="timeline-view">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent-cool" />
          <h3 className="text-sm font-bold text-fg-primary">Timeline</h3>
          <span className="text-[10px] text-fg-muted/70">{items.length} items</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={prevRange} className="p-1 rounded-lg hover:bg-muted text-fg-muted/70">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-fg-secondary bg-muted hover:bg-surface-hover"
          >
            Today
          </button>
          <button onClick={nextRange} className="p-1 rounded-lg hover:bg-muted text-fg-muted/70">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-accent-cool bg-[color:hsl(var(--primary)/0.12)] hover:bg-[color:hsl(var(--primary)/0.12)]">
            <Sparkles className="w-3 h-3" /> AI Schedule
          </button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="border border-subtle rounded-xl overflow-hidden">
        {/* Month headers */}
        <div className="flex bg-muted border-b border-subtle">
          <div className="w-48 flex-shrink-0 px-3 py-2 text-[10px] font-semibold text-fg-muted/70 border-r border-subtle">
            Item
          </div>
          <div className="flex-1 relative h-8">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 flex items-center px-2 text-[10px] font-medium text-fg-muted border-r border-subtle"
                style={{ left: `${m.offset}%`, width: `${m.width}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Today line + items */}
        <div className="relative">
          {/* Today indicator */}
          {todayOffset >= 0 && todayOffset <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-error z-10"
              style={{ left: `calc(192px + ${todayOffset}% * (100% - 192px) / 100)` }}
            >
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-b text-[8px] font-bold text-white bg-error">
                Today
              </div>
            </div>
          )}

          {/* Rows */}
          {items.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Calendar className="w-8 h-8 text-fg-muted/70 mx-auto mb-2" />
              <p className="text-sm text-fg-muted/70">No timeline items</p>
              <button
                onClick={onAddItem}
                className="mt-2 px-3 py-1.5 rounded-lg text-[10px] font-medium text-accent-cool bg-[color:hsl(var(--primary)/0.12)] hover:bg-[color:hsl(var(--primary)/0.12)]"
              >
                <Plus className="w-3 h-3 inline mr-1" /> Add item
              </button>
            </div>
          ) : (
            items.map((item, i) => {
              const start = parseDate(item.startDate);
              const end = parseDate(item.endDate);
              const startOffset = daysBetween(rangeStart, start) / totalDays * 100;
              const width = Math.max(1, daysBetween(start, end) / totalDays * 100);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => onItemClick?.(item)}
                  className="flex items-center hover:bg-muted transition-colors cursor-pointer border-b border-subtle last:border-b-0"
                >
                  {/* Label */}
                  <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-subtle">
                    <div className="text-[11px] font-medium text-fg-primary truncate">{item.title}</div>
                    {item.assignee && (
                      <div className="text-[9px] text-fg-muted/70">{item.assignee}</div>
                    )}
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative h-9">
                    {/* Bar */}
                    <div
                      className={cn(
                        "absolute top-1.5 h-5 rounded-md transition-opacity hover:opacity-80",
                        item.color || TIMELINE_COLORS[i % TIMELINE_COLORS.length]
                      )}
                      style={{ left: `${startOffset}%`, width: `${width}%`, minWidth: '4px' }}
                    >
                      {/* Progress */}
                      {item.progress !== undefined && (
                        <div
                          className="absolute inset-0 rounded-md bg-surface/30"
                          style={{ width: `${item.progress}%` }}
                        />
                      )}
                      {/* Label on bar */}
                      {width > 8 && (
                        <span className="absolute inset-0 flex items-center px-2 text-[8px] font-medium text-white truncate">
                          {item.title}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
