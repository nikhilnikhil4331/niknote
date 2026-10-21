// ============================================================
// HandwritingPage — the one renderer used for "what will my notes look like".
//
// The DNA preview used to be its own little div with hand-rolled CSS, so it
// never matched the page renderer (that is the "mixap": different leading,
// different face, lines sitting on top of each other). This component renders
// through HandwritingLine — the exact same line renderer the notebook uses —
// so the preview *is* the output.
// ============================================================

import React, { useMemo } from 'react';
import { FONT_OPTIONS, type InkColor, type NoteSettings } from '@/types/notes';
import { HandwritingLine } from '@/components/HandwritingLine';
import { noteSettingsForDNA, paperRuleStyle } from '@/lib/handwritingStyle';
import { LINE_INK_COLORS } from '@/types/noteLine';
import { structuredToNoteLines } from '@/lib/noteStructure';
import type { StructuredLine } from '@/lib/noteStructure';
import type { HandwritingDNA } from './HandwritingDNAEngine';
import type { NoteLine } from '@/types/noteLine';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export interface HandwritingPageProps {
  dna: HandwritingDNA;
  /** Structured note content (headings, bullets, equations keep their shape). */
  lines: StructuredLine[];
  inkColor?: InkColor;
  /** Override the DNA-derived settings (used by the studio's pickers). */
  settingsOverride?: Partial<NoteSettings>;
  /** Paper height in CSS px; content beyond it is clipped like a real page. */
  pageHeight?: number;
  width?: number;
  className?: string;
  /** Scale the whole sheet down, e.g. for thumbnails. */
  scale?: number;
  label?: string;
}

export const HandwritingPage: React.FC<HandwritingPageProps> = ({
  dna,
  lines,
  inkColor = 'blue',
  settingsOverride,
  pageHeight = 560,
  width = 430,
  className = '',
  scale = 1,
  label,
}) => {
  const settings = useMemo<NoteSettings>(() => {
    // Note settings come from the DNA, then any explicit studio override.
    return { ...noteSettingsForDNA(dna, { inkColor, pageStyle: 'ruled' }), ...settingsOverride, inkColor };
  }, [dna, inkColor, settingsOverride]);

  const fontClass = FONT_OPTIONS.find(f => f.value === settings.font)?.className || 'font-handwriting-1';

  const noteLines = useMemo<NoteLine[]>(() => {
    const mapped = structuredToNoteLines(lines, inkColor);
    // Empty lines keep the rhythm; they are already blank NoteLines.
    return mapped.length ? mapped : structuredToNoteLines([{ text: '', blockType: 'text', color: inkColor, indent: 0 }]);
  }, [lines, inkColor]);

  const lineBox = Math.max(settings.lineSpacing, Math.round(settings.fontSize * 1.4));
  const capacity = Math.max(1, Math.floor((pageHeight - 48) / lineBox));
  const visible = noteLines.slice(0, capacity);

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-[hsl(214_32%_86%)] bg-[hsl(38_44%_97%)] shadow-[0_10px_28px_-18px_rgba(23,18,44,0.42)] ${className}`}
      style={{ width, height: pageHeight, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left' }}
      data-handwriting-page="true"
      data-font={settings.font}
      aria-label={label ?? 'Handwritten page preview'}
    >
      {/* margin rule, like a real ruled notebook */}
      <div className="absolute inset-y-0 left-[38px] w-px bg-[hsl(352_70%_80%_/_0.7)]" aria-hidden="true" />
      <div
        className="absolute inset-0"
        style={paperRuleStyle(settings.pageStyle, settings.lineSpacing)}
        aria-hidden="true"
      />
      <div className="relative h-full px-[54px] pt-[26px] pb-6" style={{ color: `hsl(${LINE_INK_COLORS.find(c => c.value === inkColor)?.hsl ?? '220 20% 12%'})` }}>
        {visible.map((line, index) => (
          <HandwritingLine
            key={line.id}
            line={line}
            lineIndex={index}
            settings={settings}
            realPenMode
            fontClass={fontClass}
            dna={dna}
          />
        ))}
      </div>
    </div>
  );
};

/** Small inline sample used by the scanner and the style cards. */
export const DnaSamplePreview: React.FC<{
  dna: HandwritingDNA;
  text?: string;
  inkColor?: InkColor;
  className?: string;
}> = ({ dna, text = 'The quick brown fox jumps over 42 lazy dogs.\nPhotosynthesis turns light into glucose.', inkColor = 'blue', className = '' }) => {
  const lines = useMemo<StructuredLine[]>(
    () => text.split('\n').map(line => ({ text: line, blockType: 'text' as const, color: inkColor, indent: 0 })),
    [text, inkColor],
  );
  return (
    <HandwritingPage
      dna={dna}
      lines={lines}
      inkColor={inkColor}
      pageHeight={Math.max(120, clamp(46 + lines.length * 40 + 46, 140, 260))}
      width={340}
      className={className}
      scale={1}
      label="Handwriting sample preview"
    />
  );
};

export default HandwritingPage;
