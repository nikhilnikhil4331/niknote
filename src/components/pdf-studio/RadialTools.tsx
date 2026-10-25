// ============================================================
// RadialTools — circular tool launcher for PDF Editor 2.0.
// One compact button; tapping fans out the primary tools in an
// arc. Reading is the default state — nothing draws until the
// user deliberately picks a tool. Settings for the active tool
// live in the contextual bar (PdfStudio), not in this menu.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  BookOpen, PenLine, Highlighter, Eraser, Type, Shapes,
  PenTool, Image as ImageIcon, X, Wrench,
} from 'lucide-react';
import type { PdfTool } from '@/lib/pdfStudio';
import { SHAPE_TOOLS, TOOL_LABELS } from '@/lib/pdfEditor';

export type FanChoice = PdfTool | 'shapes';

interface FanItem {
  id: FanChoice;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const FAN: FanItem[] = [
  { id: 'select', label: 'Read', icon: BookOpen },
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'highlighter', label: 'Highlight', icon: Highlighter },
  { id: 'eraser', label: 'Erase', icon: Eraser },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'signature', label: 'Sign', icon: PenTool },
  { id: 'image', label: 'Image', icon: ImageIcon },
];

function ActiveIcon({ tool }: { tool: PdfTool }) {
  const cls = 'h-6 w-6';
  switch (tool) {
    case 'pen': return <PenLine className={cls} />;
    case 'highlighter': return <Highlighter className={cls} />;
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
        <div className="pdfs-fan relative h-14 w-14" data-open={open} role="menu" aria-label="Annotation tools">
          {FAN.map((item, i) => {
            const angle = 176 + (i * 96) / Math.max(1, FAN.length - 1); // 176° → 272° arc (up-left)
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="pdfs-fan-item"
                style={{ '--a': `${angle}deg`, '--r': '122px', '--i': i } as React.CSSProperties}
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive(item.id)}
                  aria-label={item.label}
                  data-active={isActive(item.id)}
                  tabIndex={open ? 0 : -1}
                  onClick={() => pick(item.id)}
                  className="pdfs-fan-chip flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full py-2 pl-2.5 pr-3 text-[12px] font-semibold"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {item.label}
                </button>
              </div>
            );
          })}
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
                style={{ background: '#22c55e', borderColor: 'var(--pdfs-surface)' }}
                aria-hidden
              />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
