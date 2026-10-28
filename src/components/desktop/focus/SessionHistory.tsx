// ============================================================
// NikNote — focus session history (real recorded sessions list)
// ============================================================

import React from 'react';
import { Timer, Hourglass, Trash2 } from 'lucide-react';
import { useFocusSessions, FOCUS_CATEGORIES, type NikFocusSession } from '../store';
import { formatMinutesAsHours } from '@/lib/productivity';

const KIND_LABEL = { pomodoro: 'Pomodoro', timer: 'Timer', stopwatch: 'Stopwatch' } as const;

function catColor(name: string): string {
  return FOCUS_CATEGORIES.find((c) => c.name === name)?.color ?? '#766A86';
}

export const SessionHistory: React.FC<{ limit?: number }> = ({ limit = 12 }) => {
  const { sessions, removeSession } = useFocusSessions();

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-[32px] mb-2" aria-hidden>🌱</div>
        <p className="text-[13px] font-bold" style={{ color: 'var(--nd-ink)' }}>No focus sessions yet</p>
        <p className="text-[12px] mt-1 max-w-[300px] mx-auto" style={{ color: 'var(--nd-ink-2)' }}>
          Start the timer above — completed sessions appear here and feed your analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sessions.slice(0, limit).map((s: NikFocusSession) => {
        const start = new Date(s.startedAt);
        return (
          <div
            key={s.id}
            className="flex items-center gap-3 py-2.5 group"
            style={{ borderBottom: '1px solid var(--nd-border-soft)' }}
          >
            <span
              className="flex-none grid place-items-center rounded-xl"
              style={{ width: 34, height: 34, background: `${catColor(s.category)}1a`, color: catColor(s.category) }}
            >
              <Timer size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold truncate" style={{ color: 'var(--nd-ink)' }}>
                  {s.taskTitle || s.category}
                </span>
                <span className="nd-tag" style={{ background: `${catColor(s.category)}1f`, color: catColor(s.category) }}>
                  {s.category}
                </span>
                <span className="nd-tag" style={{ background: '#f2edfb', color: 'var(--nd-ink-2)' }}>
                  {KIND_LABEL[s.kind]}
                </span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--nd-text-3)' }}>
                {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}
                {start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <span className="text-[12.5px] font-extrabold tabular-nums flex-none" style={{ color: 'var(--nd-ink)' }}>
              {formatMinutesAsHours(s.durationSec / 60)}
            </span>
            <button
              className="nd-icon-btn !w-7 !h-7 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete record"
              aria-label={`Delete ${KIND_LABEL[s.kind]} session record`}
              onClick={() => removeSession(s.id)}
            >
              <Trash2 size={13} style={{ color: 'var(--nd-error)' }} />
            </button>
          </div>
        );
      })}
      {sessions.length > limit && (
        <p className="text-[11px] text-center mt-2 font-semibold" style={{ color: 'var(--nd-text-3)' }}>
          + {sessions.length - limit} earlier sessions
        </p>
      )}
    </div>
  );
};

export default SessionHistory;
