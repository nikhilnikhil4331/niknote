// ============================================================
// studyPlan — study tasks, session planning and calendar export.
//
// Design notes (Cal.com / OpenProject as references, no code copied):
//  - A task is small and self-contained: subject, topic, minutes, deadline,
//    priority, done. That is the OpenProject "work package" idea, trimmed to
//    what a student actually fills in.
//  - Sessions are scheduled by a transparent greedy rule (earliest deadline
//    first, high priority first, never more than the daily budget).
//  - Export is a standards-compliant .ics file. We do not claim an event was
//    created in someone's calendar: the user (or their calendar app) imports
//    it. A Google Calendar *link* is offered as an explicit user action.
// ============================================================

export type TaskPriority = 'low' | 'normal' | 'high';

export interface StudyTask {
  id: string;
  subject: string;
  topic: string;
  /** Estimated focused minutes. */
  minutes: number;
  /** ISO date (YYYY-MM-DD) the task should be finished by. */
  dueDate: string;
  priority: TaskPriority;
  done: boolean;
  /** Local hour (0-23) preferred for study sessions. */
  preferredHour?: number;
  notes?: string;
}

export interface PlanSession {
  taskId: string;
  title: string;
  date: string;
  startHour: number;
  minutes: number;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

function toDateOnly(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function sortTasks(tasks: StudyTask[]): StudyTask[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (PRIORITY_WEIGHT[a.priority] !== PRIORITY_WEIGHT[b.priority]) {
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    }
    return b.minutes - a.minutes;
  });
}

/**
 * Spread the remaining work across days, respecting the daily budget and each
 * task's deadline. A task that cannot fit before its deadline is scheduled on
 * the deadline day anyway — the caller surfaces that overflow instead of
 * silently moving the date.
 */
export function planSessions(
  tasks: StudyTask[],
  options: { startDate?: string; dailyMinutes?: number; minBlock?: number } = {},
): PlanSession[] {
  const { startDate = new Date().toISOString().slice(0, 10), dailyMinutes = 90, minBlock = 25 } = options;
  const pending = sortTasks(tasks.filter(task => !task.done));
  if (!pending.length) return [];

  const sessions: PlanSession[] = [];
  const usedByDate = new Map<string, number>();
  const lastDate = pending.reduce((max, task) => (task.dueDate > max ? task.dueDate : max), startDate);

  let date = startDate;
  let guard = 0;
  while (pending.some(task => task.minutes > 0) && guard < 400) {
    guard += 1;
    const remaining = dailyMinutes - (usedByDate.get(date) || 0);
    if (remaining >= minBlock) {
      for (const task of pending) {
        if (task.minutes <= 0) continue;
        if (task.dueDate < date) continue; // already late: handled below
        const slot = Math.min(task.minutes, remaining - (usedByDate.get(date) || 0));
        if (slot < minBlock) continue;
        sessions.push({
          taskId: task.id,
          title: `${task.subject}: ${task.topic}`,
          date,
          startHour: task.preferredHour ?? 18,
          minutes: slot,
        });
        usedByDate.set(date, (usedByDate.get(date) || 0) + slot);
        task.minutes -= slot;
        break;
      }
    }
    if (date >= lastDate && !pending.some(task => task.minutes > 0)) break;
    date = addDays(date, 1);
    if (date > addDays(lastDate, 365)) break;
  }

  // Anything left over (deadline already passed) lands on the start date.
  for (const task of pending) {
    if (task.minutes <= 0) continue;
    sessions.push({
      taskId: task.id,
      title: `${task.subject}: ${task.topic} (overdue)`,
      date: startDate,
      startHour: task.preferredHour ?? 18,
      minutes: task.minutes,
    });
    task.minutes = 0;
  }

  return sessions;
}

// ── ICS ──────────────────────────────────────────────────────────────

/** RFC 5545 TEXT escaping. */
export function escapeIcsText(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold a content line at 75 octets (UTF-8 safe) per RFC 5545 §3.1. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines carry a leading space, so they hold 74 octets.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = char;
      bytes = size;
    } else {
      current += char;
      bytes += size;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`;
}

/** Local date + hour → UTC instant (handles the device timezone). */
function localToUtc(date: string, hour: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour, 0, 0, 0);
}

export interface IcsOptions {
  calendarName?: string;
  /** Minutes before the start for the reminder alarm. */
  reminderMinutes?: number;
  now?: Date;
}

export function tasksToIcs(tasks: StudyTask[], options: IcsOptions = {}): string {
  const { calendarName = 'NikNote study plan', reminderMinutes = 15, now = new Date() } = options;
  const stamp = utcStamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NikNote//Study Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const task of sortTasks(tasks.filter(t => !t.done))) {
    const start = localToUtc(toDateOnly(task.dueDate), task.preferredHour ?? 18);
    const end = new Date(start.getTime() + Math.max(15, task.minutes) * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@niknote.online`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeIcsText(`${task.subject}: ${task.topic}`)}`,
      `DESCRIPTION:${escapeIcsText(
        [
          `Estimated ${task.minutes} min.`,
          `Priority: ${task.priority}.`,
          task.notes || '',
          'Created in NikNote.',
        ].filter(Boolean).join('\n'),
      )}`,
      `CATEGORIES:${escapeIcsText(task.subject)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Study: ${task.topic}`)}`,
      `TRIGGER:-PT${Math.max(0, reminderMinutes)}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** A per-task Google Calendar template link (user clicks it; we never auto-create). */
export function googleCalendarUrl(task: StudyTask): string {
  const start = localToUtc(toDateOnly(task.dueDate), task.preferredHour ?? 18);
  const end = new Date(start.getTime() + Math.max(15, task.minutes) * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${task.subject}: ${task.topic}`,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: `Estimated ${task.minutes} min. Priority: ${task.priority}. Created in NikNote.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function newTask(partial: Partial<StudyTask> = {}): StudyTask {
  return {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    subject: partial.subject?.trim() || 'General',
    topic: partial.topic?.trim() || 'Untitled topic',
    minutes: Math.max(10, Math.round(partial.minutes ?? 45)),
    dueDate: toDateOnly(partial.dueDate || new Date().toISOString().slice(0, 10)),
    priority: partial.priority ?? 'normal',
    done: partial.done ?? false,
    preferredHour: partial.preferredHour ?? 18,
    notes: partial.notes,
  };
}
