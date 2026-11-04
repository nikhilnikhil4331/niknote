// ============================================================
// NikNote 4.0 — Calendar View
// Notion-style calendar with event cards, drag, AI scheduling
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, Clock, Sparkles,
  MoreHorizontal, Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  color?: string;
  time?: string;
  type?: 'task' | 'exam' | 'meeting' | 'deadline' | 'study';
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: string) => void;
  onAddEvent?: (date: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EVENT_COLORS: Record<string, string> = {
  task: 'bg-blue-400',
  exam: 'bg-red-400',
  meeting: 'bg-green-400',
  deadline: 'bg-amber-400',
  study: 'bg-purple-400',
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  events, onEventClick, onDateClick, onAddEvent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days: { date: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    
    // Previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      days.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    // Current month
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: true,
        isToday: today.getFullYear() === year && today.getMonth() === month && today.getDate() === d,
      });
    }
    
    // Next month
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      days.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [events]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="calendar-view">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">
            {MONTHS[month]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              Today
            </button>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('month')}
              className={cn(
                "text-[10px] font-medium px-2 py-1 rounded-md transition-colors",
                view === 'month' ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
              )}
            >Month</button>
            <button
              onClick={() => setView('week')}
              className={cn(
                "text-[10px] font-medium px-2 py-1 rounded-md transition-colors",
                view === 'week' ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
              )}
            >Week</button>
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-[#245dcc] bg-[#eaf2ff] hover:bg-[#dceaff] transition-colors">
            <Sparkles className="w-3 h-3" />
            AI Plan
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(day => (
          <div key={day} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border border-gray-200 rounded-xl overflow-hidden">
        {calendarDays.map((day, i) => {
          const dayEvents = eventsByDate[day.date] || [];
          return (
            <div
              key={i}
              onClick={() => onDateClick?.(day.date)}
              className={cn(
                "min-h-[90px] p-1.5 border border-gray-100 transition-colors cursor-pointer group",
                !day.isCurrentMonth && "bg-gray-50/50",
                day.isCurrentMonth && "bg-white hover:bg-[#f6f9ff]",
                day.isToday && "bg-[#eaf2ff]/70"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full",
                  day.isToday && "bg-[#2869d5] text-white",
                  day.isCurrentMonth && !day.isToday && "text-gray-700",
                  !day.isCurrentMonth && "text-gray-300"
                )}>
                  {day.day}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddEvent?.(day.date); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 transition-all"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                    className={cn(
                      "w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate transition-opacity hover:opacity-80 text-white",
                      event.color || EVENT_COLORS[event.type || 'task'] || 'bg-blue-400'
                    )}
                  >
                    {event.time && <span className="opacity-70">{event.time} </span>}
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[8px] text-gray-400 pl-1">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 px-1">
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-[9px] text-gray-400 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
