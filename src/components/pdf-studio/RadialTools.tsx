// ============================================================
// RadialTools — circular tool launcher for PDF Editor 2.0.
// One round button; tapping opens an airy arc "speed-dial" of
// labelled circular tools rising from the thumb zone — plenty
// of space between targets, names always visible, nothing
// overlaps even on small phones. Reading is the default state.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  BookOpen, PenLine, Highlighter, Eraser, Type, Shapes,
  PenTool, Image as ImageIcon, X, Wrench, TextCursorInput,
} from 'lucide-react';
import type { PdfTool } from '@/lib/pdfStudio';
import { SHAPE_TOOLS, TOOL_LABELS } from '@/lib/pdfEditor';

export type FanChoice = PdfTool | 'shapes';

interface FanItem {
  id: FanChoice;
  label: string;
  icon: React.FC<{ className?: string }>;
}

/** Bottom → top order (closest to the thumb first). */
const FAN: FanItem[] = [
  { id: 'select', label: 'Read', icon: BookOpen },
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'highlighter', label: 'Highlight', icon: Highlighter },
  { id: 'edittext', label: 'Edit text', icon: TextCursorInput },
  { id: 'text', label: 'Add text', icon: Type },
  { id: 'eraser', label: 'Erase', icon: Eraser },
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'signature', label: 'Sign', icon: PenTool },
  { id: 'image', label: 'Image', icon: ImageIcon },
];

function ActiveIcon({ tool }: { tool: PdfTool }) {
  const cls = 'h-6 w-6';
  switch (tool) {
    case 'pen': return <PenLine className={cls} />;
    case 'highlighter': return <Highlighter className={cls} />;
    case 'edittext': return <TextCursorInput className={cls} />;
    case 'eraser': return <Eraser className={cls} />;
    case 'text': return <Type className={cls} />;
    case 'signature': return <PenTool className={cls} />;
    case 'image': return <ImageIcon className={cls} />;
    case 'select': return <Wrench className={cls} />;
    default: return <Shapes className={cls} />;
  }
}

export default function RadialTools({
  tool,
  onSelect,
}: {
  tool: PdfTool;
  onSelect: (choice: FanChoice) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (choice: FanChoice) => {
    setOpen(false);
    onSelect(choice);
  };

  const isActive = (id: FanChoice) =>
    id === 'shapes' ? SHAPE_TOOLS.includes(tool) : tool === id;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close tools"
          className="fixed inset-0 z-30 cursor-default"
          style={{ background: 'transparent' }}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="absolute z-40" style={{ right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div className="relative">
          {/* Rising arc of tools */}
          <div
            className="pdfs-dial absolute bottom-[68px] right-0 flex max-h-[min(68dvh,540px)] flex-col-reverse items-end gap-2.5 overflow-y-auto overscroll-contain pb-1 pr-0.5"
            data-open={open}
            role="menu"
            aria-label="Annotation tools"
          >
            {FAN.map((item, i) => {
              const Icon = item.icon;
              const active = isActive(item.id);
              // Gentle arc: middle rows bulge a few px to the left.
              const bulge = Math.round(12 * Math.sin((Math.PI * (i + 0.5)) / FAN.length));
              return (
                <div
                  key={item.id}
                  className="pdfs-dial-item shrink-0"
                  style={{ '--i': i, marginRight: bulge } as React.CSSProperties}
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    aria-label={item.label}
                    tabIndex={open ? 0 : -1}
                    onClick={() => pick(item.id)}
                    className="group flex items-center gap-2.5"
                  >
                    <span
                      className="pdfs-bar whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
                      style={active ? { color: 'var(--pdfs-accent)', borderColor: 'var(--pdfs-accent)' } : undefined}
                    >
                      {item.label}
                    </span>
                    <span
                      data-active={active}
                      className="pdfs-dial-chip grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform group-active:scale-90"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="pdfs-launcher-btn relative z-10 grid h-14 w-14 place-items-center rounded-full"
            data-open={open}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={open ? 'Close tools' : `Tools — current: ${TOOL_LABELS[tool]}`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <ActiveIcon tool={tool} />}
            {!open && tool !== 'select' && (
              <span
                className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2"
                style={{ background: '#157F52', borderColor: 'var(--pdfs-surface)' }}
                aria-hidden
              />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
