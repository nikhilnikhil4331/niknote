// ============================================================
// SketchToolbar — compact in-page drawing controls for Smart Notes.
// Draws directly on the paper page (see NotebookPreview.DrawingSurface),
// so a diagram, underline or margin note lives with the page instead of
// in a separate tool that has to be exported and re-imported.
// ============================================================

import React from 'react';
import { PenLine, Highlighter, Eraser, Undo2, Redo2, Trash2, X, PencilRuler } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SketchSettings {
  enabled: boolean;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  width: number;
}

const SKETCH_COLORS = [
  { value: '#1e2a78', label: 'Navy ink' },
  { value: '#111827', label: 'Black ink' },
  { value: '#b91c1c', label: 'Red ink' },
  { value: '#15803d', label: 'Green ink' },
];

const WIDTHS = [
  { value: 1.6, label: 'Fine' },
  { value: 2.6, label: 'Medium' },
  { value: 4.2, label: 'Bold' },
];

interface SketchToolbarProps {
  value: SketchSettings;
  onChange: (patch: Partial<SketchSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  className?: string;
}

export const SketchToolbar: React.FC<SketchToolbarProps> = ({
  value,
  onChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  disabled,
  className,
}) => {
  const tools = [
    { id: 'pen' as const, label: 'Pen', icon: PenLine },
    { id: 'highlighter' as const, label: 'Highlighter', icon: Highlighter },
    { id: 'eraser' as const, label: 'Eraser', icon: Eraser },
  ];

  if (!value.enabled) {
    return (
      <button
        type="button"
        onClick={() => onChange({ enabled: true })}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
          className,
        )}
        aria-pressed={false}
      >
        <PencilRuler className="h-3 w-3" aria-hidden="true" /> Draw
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-xl border border-violet-200/70 bg-white/85 px-1.5 py-1 shadow-sm backdrop-blur',
        className,
      )}
      role="toolbar"
      aria-label="Draw on page"
    >
      {tools.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange({ tool: id })}
          aria-label={label}
          aria-pressed={value.tool === id}
          className={cn(
            'grid h-6 w-6 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
            value.tool === id ? 'bg-violet-600 text-white' : 'text-zinc-600 hover:bg-violet-100',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}

      <span className="mx-0.5 h-4 w-px bg-violet-200" aria-hidden="true" />

      {SKETCH_COLORS.map(colour => (
        <button
          key={colour.value}
          type="button"
          onClick={() => onChange({ color: colour.value, tool: 'pen' })}
          aria-label={colour.label}
          aria-pressed={value.color === colour.value}
          className={cn(
            'h-4 w-4 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-violet-400',
            value.color === colour.value ? 'border-white ring-2 ring-violet-400' : 'border-black/10',
          )}
          style={{ background: colour.value }}
        />
      ))}

      <span className="mx-0.5 h-4 w-px bg-violet-200" aria-hidden="true" />

      {WIDTHS.map(width => (
        <button
          key={width.value}
          type="button"
          onClick={() => onChange({ width: width.value })}
          aria-label={`${width.label} stroke`}
          aria-pressed={value.width === width.value}
          className={cn(
            'grid h-6 w-5 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
            value.width === width.value ? 'bg-violet-100' : 'hover:bg-violet-50',
          )}
        >
          <span
            className="block rounded-full bg-zinc-700"
            style={{ width: 12, height: Math.max(1.5, width.value - 0.4) }}
          />
        </button>
      ))}

      <span className="mx-0.5 h-4 w-px bg-violet-200" aria-hidden="true" />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || disabled}
        aria-label="Undo drawing"
        className="grid h-6 w-6 place-items-center rounded-md text-zinc-600 hover:bg-violet-100 disabled:opacity-40"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo || disabled}
        aria-label="Redo drawing"
        className="grid h-6 w-6 place-items-center rounded-md text-zinc-600 hover:bg-violet-100 disabled:opacity-40"
      >
        <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear this page's drawing"
        className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange({ enabled: false, tool: 'pen' })}
        aria-label="Finish drawing"
        className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default SketchToolbar;
