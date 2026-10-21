// ============================================================
// NikNote 4.0 — Handwriting DNA Scanner Engine
// Upload handwriting image → Extract DNA parameters → Reproduce
// Analyzes: slant, pressure, size, spacing, loops, connections, etc.
// ============================================================

import { dnaFromInkImage } from '@/lib/handwritingAnalysis';
import { dnaPreviewCSS, handwritingFontForDNA, noteSettingsForDNA } from '@/lib/handwritingStyle';

export interface HandwritingDNA {
  // Core parameters (0-100 scale)
  slant: number;           // -50 (left) to 50 (right), 0 = upright
  pressure: number;        // 0 (light) to 100 (heavy)
  size: number;            // 0 (tiny) to 100 (large)
  spacing: number;         // 0 (tight) to 100 (wide)
  lineHeight: number;      // 0 (short) to 100 (tall)

  // Style parameters
  connectedness: number;   // 0 (printed) to 100 (cursive)
  loopiness: number;       // 0 (angular) to 100 (loopy)
  roundedness: number;     // 0 (angular) to 100 (round)
  baseline: number;        // -50 (descending) to 50 (ascending)
  consistency: number;     // 0 (variable) to 100 (consistent)

  // Ink parameters
  strokeWidth: number;     // 0 (thin) to 100 (thick)
  inkFlow: number;         // 0 (dry) to 100 (wet/flowing)

  // Derived style name
  styleName: string;
  styleDescription: string;

  // Extended/legacy fields consumed by DNA v2 UI (optional for backwards compat)
  letterSpacing?: number;
  wordSpacing?: number;
  baselineDrift?: number;
  penPressure?: number;       // 0-1 normalized
  strokeThickness?: number;   // 0.5-2.5 multiplier
  strokeSpeed?: number;       // relative speed multiplier
  closestFont?: string;
  /** Pen colour measured from the sample ink. */
  inkColor?: 'black' | 'blue' | 'red' | 'green' | 'purple';
  confidence?: number;        // 0-1 match confidence
  characterSize?: number;
  sampleQuality?: number | string;
  fontModifications?: Record<string, unknown>;
}

// Preset DNA profiles for quick selection
export const DNA_PRESETS: Record<string, HandwritingDNA> = {
  neat_student: {
    slant: 5, pressure: 60, size: 50, spacing: 50, lineHeight: 55,
    connectedness: 30, loopiness: 40, roundedness: 60, baseline: 5,
    consistency: 85, strokeWidth: 45, inkFlow: 50,
    styleName: 'Neat Student',
    styleDescription: 'Clean, consistent handwriting typical of a studious student',
  },
  casual_quick: {
    slant: -10, pressure: 45, size: 60, spacing: 40, lineHeight: 45,
    connectedness: 60, loopiness: 50, roundedness: 55, baseline: -10,
    consistency: 40, strokeWidth: 50, inkFlow: 55,
    styleName: 'Casual Quick',
    styleDescription: 'Fast, slightly messy handwriting from quick note-taking',
  },
  teacher_bold: {
    slant: 0, pressure: 80, size: 70, spacing: 60, lineHeight: 65,
    connectedness: 20, loopiness: 30, roundedness: 70, baseline: 3,
    consistency: 90, strokeWidth: 65, inkFlow: 60,
    styleName: 'Teacher Bold',
    styleDescription: 'Bold, clear handwriting like a teacher writes on the board',
  },
  exam_rush: {
    slant: 15, pressure: 50, size: 40, spacing: 30, lineHeight: 35,
    connectedness: 70, loopiness: 60, roundedness: 50, baseline: -15,
    consistency: 25, strokeWidth: 40, inkFlow: 45,
    styleName: 'Exam Rush',
    styleDescription: 'Quick, cramped handwriting from writing fast in exams',
  },
  elegant_cursive: {
    slant: 20, pressure: 55, size: 55, spacing: 55, lineHeight: 60,
    connectedness: 85, loopiness: 70, roundedness: 80, baseline: 2,
    consistency: 75, strokeWidth: 40, inkFlow: 65,
    styleName: 'Elegant Cursive',
    styleDescription: 'Flowing cursive with beautiful loops and connections',
  },
  boy_scratchy: {
    slant: -5, pressure: 70, size: 65, spacing: 45, lineHeight: 50,
    connectedness: 35, loopiness: 20, roundedness: 30, baseline: -8,
    consistency: 30, strokeWidth: 55, inkFlow: 40,
    styleName: 'Boy Scratchy',
    styleDescription: 'Angular, pressurized handwriting typical of many boys',
  },
  girl_neat: {
    slant: 10, pressure: 45, size: 45, spacing: 55, lineHeight: 50,
    connectedness: 55, loopiness: 65, roundedness: 75, baseline: 3,
    consistency: 70, strokeWidth: 35, inkFlow: 55,
    styleName: 'Girl Neat',
    styleDescription: 'Neat, rounded handwriting with pretty loops',
  },
  doctor_scrawl: {
    slant: -15, pressure: 60, size: 55, spacing: 25, lineHeight: 40,
    connectedness: 80, loopiness: 40, roundedness: 35, baseline: -20,
    consistency: 10, strokeWidth: 50, inkFlow: 45,
    styleName: 'Doctor Scrawl',
    styleDescription: 'Almost illegible scrawl — the classic doctor handwriting',
  },
};

/**
 * Analyse a handwriting photo.
 *
 * The measurement work lives in `@/lib/handwritingAnalysis` (Otsu ink mask,
 * shear-based slant, line bands, stroke widths, word gaps, baseline drift) and
 * the face/leading mapping lives in `@/lib/handwritingStyle`, so the DNA
 * preview, the notes and the studio all render from one description.
 */
export function analyzeHandwritingImage(imageData: ImageData): HandwritingDNA {
  return dnaFromInkImage(imageData);
}

// Generate CSS for DNA profile (applied to handwriting text)
export function dnaToCSS(dna: HandwritingDNA): React.CSSProperties {
  return dnaPreviewCSS(dna);
}

// Merge DNA with modifications (for user adjustments)
export function mergeDNA(base: HandwritingDNA, modifications: Partial<HandwritingDNA>): HandwritingDNA {
  return {
    ...base,
    ...modifications,
    styleName: modifications.styleName || base.styleName,
    styleDescription: modifications.styleDescription || base.styleDescription,
  };
}

// Find closest preset to a given DNA
export function findClosestPreset(dna: HandwritingDNA): string {
  let closestName = 'neat_student';
  let closestDistance = Infinity;
  
  for (const [name, preset] of Object.entries(DNA_PRESETS)) {
    const distance = Math.sqrt(
      (dna.slant - preset.slant) ** 2 +
      (dna.pressure - preset.pressure) ** 2 +
      (dna.size - preset.size) ** 2 +
      (dna.spacing - preset.spacing) ** 2 +
      (dna.connectedness - preset.connectedness) ** 2 +
      (dna.consistency - preset.consistency) ** 2
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestName = name;
    }
  }
  
  return closestName;
}

// ============================================================
// Backward Compatibility — old exports that other files use
// ============================================================

// Old name for DNA_PRESETS (used by DNAProfileSelector, HandwritingDNAContext, etc.)
export const DNA_PROFILES = DNA_PRESETS;

// Default DNA profile
export function getDefaultDNA(): HandwritingDNA {
  const base: HandwritingDNA = {
    ...DNA_PRESETS.neat_student,
    letterSpacing: 0.5,
    wordSpacing: 6,
    baselineDrift: 2,
    penPressure: 0.6,
    strokeThickness: 1,
    strokeSpeed: 1,
    closestFont: 'font-handwriting-1',
    confidence: 0,
    characterSize: 16,
    fontModifications: {},
  };
  base.closestFont = base.closestFont ?? handwritingFontForDNA(base);
  return base;
}

/** Note settings (face, size, leading) implied by a DNA profile. */
export function noteSettingsForDNAExport(dna: HandwritingDNA) {
  return noteSettingsForDNA(dna);
}

// Legacy analyzeHandwriting function (for HandwritingAnalyzer.tsx)
export async function analyzeHandwriting(imageBase64: string): Promise<HandwritingDNA> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(getDefaultDNA()); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(analyzeHandwritingImage(imageData));
    };
    img.onerror = () => resolve(getDefaultDNA());
    img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
  });
}

// Legacy functions used by HandwritingDNAContext
export function generateLineVariation(dna: HandwritingDNA, lineIndex: number): Record<string, number> {
  const seed = lineIndex * 137.5;
  return {
    offsetX: Math.sin(seed) * dna.spacing * 0.1,
    offsetY: Math.cos(seed) * 2,
    rotation: (dna.slant * 0.1 + Math.sin(seed * 0.5) * (100 - dna.consistency) * 0.05),
    scale: 1 + Math.sin(seed * 0.3) * (100 - dna.consistency) * 0.002,
  };
}

export function generateWordVariation(dna: HandwritingDNA, lineIndex: number, wordIndex?: number): Record<string, number> {
  const idx = wordIndex ?? lineIndex;
  const seed = idx * 73.7 + lineIndex * 11.3;
  return {
    offsetX: Math.sin(seed) * dna.spacing * 0.05,
    offsetY: Math.cos(seed) * 1,
    rotation: Math.sin(seed * 0.7) * (100 - dna.consistency) * 0.03,
  };
}

export function calculateSimilarity(dna1: HandwritingDNA, dna2: HandwritingDNA): number {
  const distance = Math.sqrt(
    (dna1.slant - dna2.slant) ** 2 +
    (dna1.pressure - dna2.pressure) ** 2 +
    (dna1.size - dna2.size) ** 2 +
    (dna1.spacing - dna2.spacing) ** 2 +
    (dna1.connectedness - dna2.connectedness) ** 2 +
    (dna1.consistency - dna2.consistency) ** 2
  );
  return Math.max(0, 1 - distance / 250);
}
