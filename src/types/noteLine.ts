export type LineInkColor = 'black' | 'blue' | 'red' | 'green' | 'purple' | 'brown' | 'teal' | 'orange' | 'pink' | 'navy' | 'burgundy' | 'gold';

export interface NoteLine {
  id: string;
  text: string;
  color: LineInkColor;
  timestamp: number;
  // Block type info for preview styling
  blockType?: string;
  fontSize?: number;   // Override font size for headings
  fontWeight?: string; // Override font weight for headings
  indent?: number;     // Indentation level
}

export interface LineHistory {
  past: NoteLine[];
  future: NoteLine[];
}

export interface RealPenVariation {
  opacity: number;
  thickness: number;
  hueShift: number;
}

export const LINE_INK_COLORS: { value: LineInkColor; label: string; hex: string; hsl: string }[] = [
  // Classic
  { value: 'black', label: 'Black', hex: '#1a1a2e', hsl: '220 20% 12%' },
  { value: 'blue', label: 'Blue', hex: '#1565c0', hsl: '215 85% 40%' },
  { value: 'red', label: 'Red', hex: '#d32f2f', hsl: '0 72% 50%' },
  { value: 'green', label: 'Green', hex: '#2e7d32', hsl: '145 65% 38%' },
  // Extended
  { value: 'purple', label: 'Purple', hex: '#7b1fa2', hsl: '265 60% 50%' },
  { value: 'brown', label: 'Brown', hex: '#795548', hsl: '25 55% 38%' },
  { value: 'teal', label: 'Teal', hex: '#00897b', hsl: '175 60% 38%' },
  { value: 'orange', label: 'Orange', hex: '#ef6c00', hsl: '28 92% 52%' },
  // Premium
  { value: 'pink', label: 'Pink', hex: '#d81b60', hsl: '340 82% 48%' },
  { value: 'navy', label: 'Navy', hex: '#1a237e', hsl: '230 70% 30%' },
  { value: 'burgundy', label: 'Burgundy', hex: '#880e4f', hsl: '340 85% 30%' },
  { value: 'gold', label: 'Gold', hex: '#ff8f00', hsl: '38 95% 50%' },
];

export const generateLineId = (): string => {
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const getDefaultColorForLine = (lineIndex: number): LineInkColor => {
  // First line black, second line blue, then alternate
  if (lineIndex === 0) return 'black';
  if (lineIndex === 1) return 'blue';
  return lineIndex % 2 === 0 ? 'black' : 'blue';
};

export const generateRealPenVariation = (lineIndex: number, realPenMode: boolean): RealPenVariation => {
  if (!realPenMode) {
    return { opacity: 1, thickness: 1, hueShift: 0 };
  }
  
  // Generate deterministic but natural-looking variations based on line index
  const seed = lineIndex * 7919; // Prime number for pseudo-randomness
  const random1 = Math.sin(seed) * 0.5 + 0.5;
  const random2 = Math.sin(seed + 1) * 0.5 + 0.5;
  const random3 = Math.sin(seed + 2) * 0.5 + 0.5;
  
  return {
    opacity: 0.85 + random1 * 0.15, // 0.85 to 1.0
    thickness: 0.95 + random2 * 0.1, // 0.95 to 1.05
    hueShift: (random3 - 0.5) * 10, // -5 to +5 degrees
  };
};

// Types for inline content (images/diagrams)
export interface InlineImage {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  rotation: number;
}

export interface InlineDiagram {
  id: string;
  type: 'diagram';
  shape: 'rectangle' | 'circle' | 'arrow' | 'line' | 'freedraw';
  points?: { x: number; y: number }[];
  width: number;
  height: number;
  position: { x: number; y: number };
  rotation: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
}

export type InlineContent = InlineImage | InlineDiagram;

/**
 * A freehand mark drawn directly on a paper page.
 * Strokes are stored as structured points (page pixel space), never as a
 * screenshot, so they survive resizes and stay editable/erasable.
 */
export interface StrokePoint { x: number; y: number }

export interface PageStroke {
  id: string;
  tool: 'pen' | 'highlighter';
  color: string;
  width: number;
  points: StrokePoint[];
}

export const strokeToPath = (stroke: PageStroke): string => {
  const pts = stroke.points;
  if (!pts.length) return '';
  if (pts.length === 1) {
    // A tap should still leave a dot.
    return `M ${pts[0].x} ${pts[0].y} l 0.01 0.01`;
  }
  // Quadratic smoothing keeps handwriting-like strokes from looking faceted.
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${midX} ${midY}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

export const generateContentId = (): string => {
  return `content-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};
