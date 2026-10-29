// ============================================================
// NikNote Desktop — shared UI widgets
// ============================================================

import React from 'react';
import { ArrowRight, Pin, Star } from 'lucide-react';
import type { DNote } from './notes';
import { timeAgo, type TaskStatus } from './store';

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  right,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <h2 className="text-[15px] font-bold tracking-[-0.01em]" style={{ color: 'var(--nd-text)' }}>
        {title}
      </h2>
      {right ??
        (actionLabel && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#6C5CE7] hover:text-[#5A4BD1] transition-colors"
          >
            {actionLabel} <ArrowRight size={13} />
          </button>
        ))}
    </div>
  );
}

export const STATUS_STYLE: Record<TaskStatus, { label: string; bg: string; fg: string }> = {
  todo: { label: 'To Do', bg: '#F1F0F8', fg: '#6F6C8A' },
  doing: { label: 'In Progress', bg: '#E3EDFF', fg: '#2F6FED' },
  done: { label: 'Done', bg: '#DCF5E7', fg: '#149A66' },
};

export function StatusChip({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="nd-chip" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Mini A4 "handwritten paper" preview used on note cards (matches mockup thumbnails). */
export function PaperPreview({
  title,
  preview,
  cover,
  height = 118,
  idSeed,
}: {
  title: string;
  preview?: string;
  cover: string;
  height?: number;
  idSeed: string;
}) {
  const lines = (preview || '')
    .replace(/^#+\s?/gm, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.toLowerCase() !== title.toLowerCase())
    .slice(0, 3)
    .join('\n');
  const h = hashStr(idSeed);
  const barWidths = [62 + (h % 30), 40 + (h % 38), 55 + ((h >> 3) % 28)];

  return (
    <div className="nd-paper" style={{ height }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
          background: `linear-gradient(90deg, ${cover}, ${cover}99)`,
          opacity: 0.85,
        }}
      />
      <div className="nd-paper-title">{title}</div>
      {lines ? (
        <div className="nd-paper-lines" style={{ whiteSpace: 'pre-line' }}>{lines}</div>
      ) : (
        <div style={{ padding: '4px 14px 0 34px' }}>
          {barWidths.map((w, i) => (
            <div
              key={i}
              style={{
                height: 6, borderRadius: 99, width: `${w}%`,
                background: 'rgba(91,102,144,.28)', marginBottom: 10 + (22 - 6 - 10),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteCard({
  note,
  fav,
  pinnedBadge,
  listMode,
  onOpen,
  footerMeta,
}: {
  note: DNote;
  fav?: boolean;
  /** Show the magenta pin badge on the paper preview. */
  pinnedBadge?: boolean;
  /** Horizontal layout for the home list view. */
  listMode?: boolean;
  onOpen: (n: DNote) => void;
  footerMeta?: React.ReactNode;
}) {
  return (
    <button
      className="nd-note-card"
      onClick={() => onOpen(note)}
      title={note.title}
      style={listMode ? { display: 'flex', alignItems: 'stretch' } : undefined}
    >
      <div style={listMode ? { width: 132, flex: 'none', position: 'relative' } : { position: 'relative' }}>
        <PaperPreview title={note.title} preview={note.preview} cover={note.cover} idSeed={note.id} height={listMode ? 92 : 118} />
        {pinnedBadge && (
          <span
            className="grid place-items-center rounded-full"
            style={{
              position: 'absolute', top: 8, left: 8, width: 22, height: 22,
              background: '#fff', boxShadow: '0 2px 8px rgba(217,44,155,0.35)',
            }}
            aria-label="Pinned"
          >
            <Pin size={11} color="#D92C9B" fill="#D92C9B" />
          </span>
        )}
      </div>
      <div className="px-3.5 py-3" style={listMode ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } : undefined}>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[13px] font-semibold truncate"
            style={{ color: 'var(--nd-text)' }}
          >
            {note.title}
          </span>
          {fav && <Star size={12} className="flex-none" fill="#F5A623" color="#F5A623" />}
        </div>
        <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--nd-text-3)' }}>
          {footerMeta ?? timeAgo(note.updatedAt)}
          {note.folder ? ` · ${note.folder}` : ''}
        </div>
      </div>
    </button>
  );
}

/** Circular progress ring (habit tracker, mockup style). */
export function Ring({
  value,
  target,
  color,
  size = 68,
  stroke = 6,
  label,
  onClick,
  title,
}: {
  value: number;
  target: number;
  color: string;
  size?: number;
  stroke?: number;
  label: string;
  onClick?: () => void;
  title?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const done = value >= target && target > 0;
  return (
    <button
      onClick={onClick}
      title={title || `${label}: ${value}/${target} — click to log`}
      className="flex flex-col items-center gap-1.5 group"
      style={{ background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: 0 }}
    >
      <span className="relative inline-flex transition-transform group-hover:scale-105" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle className="nd-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
          <circle
            className="nd-ring-bar"
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[13px] font-bold"
          style={{ color: done ? color : 'var(--nd-text)' }}
        >
          {done ? '✓' : `${value}/${target}`}
        </span>
      </span>
      <span className="text-[12px] font-semibold" style={{ color: 'var(--nd-text-2)' }}>
        {label}
      </span>
    </button>
  );
}

export function EmptyState({
  emoji,
  title,
  sub,
  action,
}: {
  emoji: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="nd-card flex flex-col items-center text-center px-6 py-10">
      <div className="text-[34px] nd-float" aria-hidden>{emoji}</div>
      <div className="mt-2 text-[15px] font-bold" style={{ color: 'var(--nd-text)' }}>{title}</div>
      {sub && <div className="mt-1 text-[13px] max-w-[380px]" style={{ color: 'var(--nd-text-2)' }}>{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
