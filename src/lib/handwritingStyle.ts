// ============================================================
// handwritingStyle — one source of truth for "what does this DNA look like?"
//
// The DNA scanner produced numbers, but nothing translated them into the
// typeface, size, rhythm and ink the notes are actually drawn with. Each
// screen guessed its own mapping, which is why the DNA preview never matched
// the notes and looked like a jumble of overlapping lines.
//
// Everything here is pure and deterministic: the same DNA always yields the
// same face, the same leading and the same preview, on every screen.
// ============================================================

import type { HandwritingDNA } from '@/components/handwriting-dna/HandwritingDNAEngine';
import type { StructuredLine } from '@/lib/noteStructure';
import { DEFAULT_SETTINGS, type HandwritingFont, type NoteSettings } from '@/types/notes';

/** Ruled / graph / dotted paper, aligned to the same leading as the text. */
export function paperRuleStyle(pageStyle: NoteSettings['pageStyle'], lineSpacing: number): React.CSSProperties {
  const gap = Math.max(20, Math.round(lineSpacing));
  const rule = 'hsl(213 60% 82% / 0.75)';
  switch (pageStyle) {
    case 'ruled':
      return {
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${gap - 1}px, ${rule} ${gap - 1}px, ${rule} ${gap}px)`,
      };
    case 'graph':
      return {
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${gap - 1}px, ${rule} ${gap - 1}px, ${rule} ${gap}px), repeating-linear-gradient(to right, transparent 0, transparent ${gap - 1}px, ${rule} ${gap - 1}px, ${rule} ${gap}px)`,
      };
    case 'dotted':
      return {
        backgroundImage: `radial-gradient(${rule} 1px, transparent 1px)`,
        backgroundSize: `${gap}px ${gap}px`,
      };
    default:
      return {};
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const num = (value: unknown, fallback = 50) =>
  (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export interface DnaPresetMeta {
  key: string;
  emoji: string;
  label: string;
  description: string;
  /** Short Hinglish line used on the DNA cards. */
  hint: string;
}

/**
 * Every preset that exists in DNA_PRESETS, with a label that always matches.
 * The old selector hard-coded `messy_fast` / `girly_neat`, which don't exist,
 * so those cards rendered raw snake_case keys.
 */
export const DNA_PRESET_META: Record<string, DnaPresetMeta> = {
  neat_student: { key: 'neat_student', emoji: '✨', label: 'Neat Student', description: 'Clean, consistent, exam-ready', hint: 'Saaf aur consistent' },
  casual_quick: { key: 'casual_quick', emoji: '⚡', label: 'Fast Writer', description: 'Rushed, connected, quick strokes', hint: 'Jaldi likhi hui' },
  teacher_bold: { key: 'teacher_bold', emoji: '🖊️', label: 'Bold Clear', description: 'Bold, board-writing clarity', hint: 'Mota aur saaf' },
  exam_rush: { key: 'exam_rush', emoji: '📝', label: 'Exam Rush', description: 'Cramped, exam-pressure writing', hint: 'Exam wali handwriting' },
  elegant_cursive: { key: 'elegant_cursive', emoji: '🌸', label: 'Elegant Flow', description: 'Flowing cursive with loops', hint: 'Cursive flow' },
  boy_scratchy: { key: 'boy_scratchy', emoji: '🪶', label: 'Scratchy', description: 'Angular, pressurised print', hint: 'Angular strokes' },
  girl_neat: { key: 'girl_neat', emoji: '🌼', label: 'Round Neat', description: 'Rounded letters, pretty loops', hint: 'Gol-gol neat' },
  doctor_scrawl: { key: 'doctor_scrawl', emoji: '🩺', label: 'Scrawl', description: 'Fast, barely-separated letters', hint: 'Doctor wali scrawl' },
};

export const dnaPresetMeta = (key: string): DnaPresetMeta =>
  DNA_PRESET_META[key] ?? {
    key,
    emoji: '✍️',
    label: key.replace(/_/g, ' '),
    description: 'Handwriting style',
    hint: 'Custom style',
  };

// ── Face selection ───────────────────────────────────────────
// Ordered from flowing to scratchy. The first match wins, so the order is the
// priority: a very connected sample must never fall through to a print face.
const FACE_RULES: { font: HandwritingFont; test: (d: HandwritingDNA) => boolean }[] = [
  { font: 'la-belle-aurore', test: d => d.connectedness >= 80 && d.slant >= 16 && d.pressure < 55 },
  { font: 'satisfy', test: d => d.connectedness >= 78 && d.roundedness >= 62 },
  { font: 'dancing-script', test: d => d.connectedness >= 70 },
  { font: 'homemade-apple', test: d => d.connectedness >= 55 && d.slant >= 10 && d.consistency >= 55 },
  { font: 'indie-flower', test: d => d.loopiness >= 62 && d.size <= 60 },
  { font: 'covered-by-your-grace', test: d => d.consistency <= 30 && d.roundedness >= 50 },
  { font: 'rock-salt', test: d => d.consistency <= 32 && d.strokeWidth >= 55 },
  { font: 'shadows-into-light', test: d => d.consistency <= 45 && d.size >= 55 },
  { font: 'architects-daughter', test: d => d.size >= 66 },
  { font: 'patrick-hand', test: d => d.roundedness >= 68 },
  { font: 'kalam', test: d => d.consistency >= 74 },
  { font: 'gloria-hallelujah', test: d => d.letterSpacing != null && d.letterSpacing >= 2 },
  { font: 'caveat', test: () => true },
];

const KNOWN_FONTS = new Set<HandwritingFont>([
  'caveat', 'kalam', 'patrick-hand', 'architects-daughter', 'gloria-hallelujah',
  'shadows-into-light', 'indie-flower', 'covered-by-your-grace', 'reenie-beanie',
  'rock-salt', 'dancing-script', 'satisfy', 'homemade-apple', 'nothing-you-could-do',
  'cedarville-cursive', 'la-belle-aurore',
]);

/** The typeface that best carries this DNA. Sticky: a stored face wins. */
export function handwritingFontForDNA(dna: HandwritingDNA): HandwritingFont {
  const stored = dna.closestFont as HandwritingFont | undefined;
  if (stored && KNOWN_FONTS.has(stored)) return stored;
  return FACE_RULES.find(rule => rule.test(dna))?.font ?? 'caveat';
}

/** CSS class for the face (the app styles handwriting through classes). */
export function handwritingClassForDNA(dna: HandwritingDNA): string {
  const font = handwritingFontForDNA(dna);
  const map: Partial<Record<HandwritingFont, string>> = {
    'caveat': 'font-handwriting-1',
    'kalam': 'font-handwriting-2',
    'patrick-hand': 'font-handwriting-3',
    'shadows-into-light': 'font-handwriting-4',
    'indie-flower': 'font-handwriting-5',
    'dancing-script': 'font-handwriting-6',
    'architects-daughter': 'font-handwriting-7',
    'satisfy': 'font-handwriting-8',
    'gloria-hallelujah': 'font-handwriting-9',
    'covered-by-your-grace': 'font-handwriting-10',
    'rock-salt': 'font-handwriting-11',
    'reenie-beanie': 'font-handwriting-12',
    'homemade-apple': 'font-handwriting-13',
    'nothing-you-could-do': 'font-handwriting-14',
    'cedarville-cursive': 'font-handwriting-15',
    'la-belle-aurore': 'font-handwriting-16',
  };
  return map[font] ?? 'font-handwriting-1';
}

// ── DNA → note settings ─────────────────────────────────────

/**
 * Turn DNA into the settings the page renderer consumes. The hard rule is that
 * written lines can never collide: leading is always at least 1.38 × font size,
 * which is what keeps a "large, cramped" DNA from printing text on top of text.
 */
export function noteSettingsForDNA(dna: HandwritingDNA, base: Partial<NoteSettings> = {}): NoteSettings {
  const size = clamp(num(dna.size), 0, 100);
  const spacing = clamp(num(dna.spacing), 0, 100);
  const lineHeight = clamp(num(dna.lineHeight), 0, 100);
  const consistency = clamp(num(dna.consistency, 70), 0, 100);

  const fontSize = Math.round(clamp(16 + (size / 100) * 12, 16, 30));
  const leading = 1.38 + (lineHeight / 100) * 0.5; // 1.38 – 1.88
  const lineSpacing = Math.round(fontSize * leading);
  const wordSpacing = Math.round(clamp(3 + (spacing / 100) * 6, 3, 9));

  return {
    ...DEFAULT_SETTINGS,
    ...base,
    font: handwritingFontForDNA(dna),
    fontSize,
    lineSpacing,
    wordSpacing,
    baselineJitter: consistency < 74,
    strokeRandomness: consistency < 84,
  };
}

// ── DNA → preview CSS ───────────────────────────────────────
// Kept for the small inline previews. Deliberately conservative: no fixed
// pixel line-height (that bug stacked three lines on top of each other), and
// transforms stay small so nothing overlaps its neighbour.
export function dnaPreviewCSS(dna: HandwritingDNA): React.CSSProperties {
  const size = clamp(num(dna.size), 0, 100);
  const lineHeight = clamp(num(dna.lineHeight), 0, 100);
  const spacing = clamp(num(dna.spacing), 0, 100);
  const pressure = clamp(num(dna.pressure), 0, 100);
  const strokeWidth = clamp(num(dna.strokeWidth), 0, 100);
  const slant = clamp(num(dna.slant, 0), -30, 30);

  return {
    fontSize: `${Math.round(clamp(14 + (size / 100) * 12, 14, 26))}px`,
    lineHeight: 1.4 + (lineHeight / 100) * 0.45,
    letterSpacing: `${((spacing - 50) * 0.035).toFixed(2)}px`,
    transform: `skewX(${clamp(-slant * 0.18, -6, 6).toFixed(2)}deg)`,
    transformOrigin: 'left top',
    fontWeight: Math.round(clamp(300 + (pressure / 100) * 260 + (strokeWidth / 100) * 90, 300, 700)),
    WebkitTextStroke: strokeWidth > 62 ? '0.25px currentColor' : undefined,
    opacity: 0.9 + (clamp(num(dna.inkFlow, 55), 0, 100) / 100) * 0.1,
  };
}

// ── Human-readable summary ──────────────────────────────────

export function dnaTraits(dna: HandwritingDNA): { label: string; value: number }[] {
  return [
    { label: 'Slant', value: Math.round(clamp(num(dna.slant) + 50, 0, 100)) },
    { label: 'Pressure', value: Math.round(clamp(num(dna.pressure), 0, 100)) },
    { label: 'Size', value: Math.round(clamp(num(dna.size), 0, 100)) },
    { label: 'Spacing', value: Math.round(clamp(num(dna.spacing), 0, 100)) },
    { label: 'Flow', value: Math.round(clamp(num(dna.connectedness), 0, 100)) },
    { label: 'Consistency', value: Math.round(clamp(num(dna.consistency, 70), 0, 100)) },
  ];
}

/** Words a student would actually use, in the order the sample is measured. */
export const DNA_SAMPLE_TEXT =
  'The quick brown fox jumps over the lazy dog.\nPhotosynthesis converts light into glucose.\nBharat mera desh hai — 15 August 1947.';

/**
 * Split structured notes into pages, never leaving a heading stranded at the
 * bottom of a page — a real writer starts the section on the next sheet.
 */
export function paginateStructured(lines: StructuredLine[], perPage: number): StructuredLine[][] {
  const capacity = Math.max(4, Math.floor(perPage));
  const pages: StructuredLine[][] = [];
  let current: StructuredLine[] = [];

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
  };

  for (const line of lines) {
    const isHeading = line.blockType === 'h1' || line.blockType === 'h2' || line.blockType === 'h3';
    const roomLeft = capacity - current.length;

    if (roomLeft <= 0) {
      if (isHeading) {
        flush();
      } else {
        // Keep one line of context with the previous paragraph.
        const carry = current.pop();
        flush();
        if (carry) current.push(carry);
      }
    } else if (isHeading && roomLeft === 1) {
      // A heading alone on the last rule of a sheet is a widow; the writer
      // would start the section on the next page instead.
      flush();
    }

    current.push(line);
  }
  flush();
  return pages.length ? pages : [[]];
}

// ============================================================
// Per-word lean
//
// A real hand does not hold one angle: the pen leans a little differently on
// every word, and each line drifts. A single global skew (what we had) reads
// as a font that was italicised. This is deterministic — the same word in the
// same position always gets the same lean, so nothing flickers on re-render.
// ============================================================

function hash01(a: number, b: number, salt = 1): number {
  let h = Math.imul(a + salt * 374761393, 668265263) ^ Math.imul(b + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const centered = (v: number) => v - 0.5;

/** Lean for one line, in degrees (deviation from the writer's mean). */
export function lineSlantDeviation(consistency: number, lineIndex: number): number {
  const calm = Math.max(0.2, Math.min(1, 1 - consistency / 140));
  return centered(hash01(lineIndex, 0, 31)) * 1.1 * calm;
}

/**
 * Lean for a single word in degrees: mean lean + line drift + word wobble.
 * Bounded so text never becomes unreadable.
 */
export function wordSlant(
  baseSlant: number,
  lineIndex: number,
  wordIndex: number,
  consistency = 70,
): number {
  const calm = Math.max(0.2, Math.min(1, 1 - consistency / 140));
  const wobble = centered(hash01(lineIndex, wordIndex, 17)) * 2.4 * calm;
  const value = baseSlant + lineSlantDeviation(consistency, lineIndex) + wobble;
  return Math.round(Math.max(-18, Math.min(18, value)) * 100) / 100;
}
