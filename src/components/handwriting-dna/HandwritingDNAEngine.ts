// ============================================================
// NikNote 4.0 — Handwriting DNA Scanner Engine
// Upload handwriting image → Extract DNA parameters → Reproduce
// Analyzes: slant, pressure, size, spacing, loops, connections, etc.
// ============================================================

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
  confidence?: number;        // 0-1 match confidence
  characterSize?: number;
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

// Analyze a handwriting image and extract DNA
export function analyzeHandwritingImage(imageData: ImageData): HandwritingDNA {
  const { data, width, height } = imageData;
  
  // --- Analysis algorithms ---
  
  // 1. SLANT: Measure average angle of vertical strokes
  let totalSlant = 0;
  let slantCount = 0;
  
  // Scan columns to find ink positions
  const columnCenters: number[] = [];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 50))) {
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < height; y += 2) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const alpha = data[idx + 3];
      if (alpha > 128 && brightness < 128) { // Dark ink pixel
        sumY += y;
        count++;
      }
    }
    if (count > 0) columnCenters.push(sumY / count);
  }
  
  // Calculate slant from center positions
  if (columnCenters.length > 2) {
    const topAvg = columnCenters.slice(0, Math.floor(columnCenters.length * 0.3)).reduce((a, b) => a + b, 0) / Math.floor(columnCenters.length * 0.3);
    const bottomAvg = columnCenters.slice(Math.floor(columnCenters.length * 0.7)).reduce((a, b) => a + b, 0) / (columnCenters.length - Math.floor(columnCenters.length * 0.7));
    totalSlant = ((bottomAvg - topAvg) / height) * 100;
    slantCount = 1;
  }
  
  // 2. PRESSURE: Average darkness of ink pixels
  let totalBrightness = 0;
  let inkPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 128) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      totalBrightness += brightness;
      inkPixels++;
    }
  }
  const avgPressure = inkPixels > 0 ? (1 - totalBrightness / (inkPixels * 255)) * 100 : 50;
  
  // 3. SIZE: Ratio of ink pixels to total
  const inkRatio = inkPixels / (width * height);
  const sizeScore = Math.min(100, Math.max(0, inkRatio * 500));
  
  // 4. SPACING: Measure horizontal gaps between ink clusters
  let totalGaps = 0;
  let gapCount = 0;
  let lastInkX = -1;
  for (let x = 0; x < width; x += 3) {
    let hasInk = false;
    for (let y = 0; y < height; y += 3) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 128) { hasInk = true; break; }
    }
    if (hasInk && lastInkX >= 0) {
      const gap = x - lastInkX;
      if (gap > 5) { // Significant gap
        totalGaps += gap;
        gapCount++;
      }
      lastInkX = x;
    } else if (hasInk) {
      lastInkX = x;
    }
  }
  const avgSpacing = gapCount > 0 ? (totalGaps / gapCount) / (width / 100) : 50;
  
  // 5. CONNECTEDNESS: Measure horizontal continuity
  let connectedStrokes = 0;
  let totalStrokes = 0;
  for (let y = 0; y < height; y += 4) {
    let inStroke = false;
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const isInk = data[idx + 3] > 128;
      if (isInk && !inStroke) { totalStrokes++; inStroke = true; }
      if (isInk) connectedStrokes++;
      if (!isInk) inStroke = false;
    }
  }
  const connectednessScore = totalStrokes > 0 ? Math.min(100, (connectedStrokes / (totalStrokes * 20)) * 100) : 50;
  
  // 6. CONSISTENCY: Measure variance in stroke patterns
  const rowInkCounts: number[] = [];
  for (let y = 0; y < height; y += 4) {
    let count = 0;
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 128) count++;
    }
    rowInkCounts.push(count);
  }
  const meanInk = rowInkCounts.reduce((a, b) => a + b, 0) / rowInkCounts.length;
  const variance = rowInkCounts.reduce((a, b) => a + (b - meanInk) ** 2, 0) / rowInkCounts.length;
  const consistencyScore = Math.min(100, Math.max(0, 100 - (Math.sqrt(variance) / (meanInk || 1)) * 50));
  
  // 7. BASELINE: Measure if writing goes up or down
  let baselineScore = 0;
  if (columnCenters.length > 4) {
    const firstThird = columnCenters.slice(0, Math.floor(columnCenters.length / 3));
    const lastThird = columnCenters.slice(-Math.floor(columnCenters.length / 3));
    const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
    baselineScore = ((avgLast - avgFirst) / height) * 200;
  }
  
  // Build DNA result
  const slant = Math.max(-50, Math.min(50, totalSlant));
  const pressure = Math.max(0, Math.min(100, avgPressure));
  const size = Math.max(0, Math.min(100, sizeScore));
  const spacing = Math.max(0, Math.min(100, avgSpacing));
  const lineHeight = Math.max(0, Math.min(100, size * 0.8 + 20));
  const connectedness = Math.max(0, Math.min(100, connectednessScore));
  const loopiness = Math.max(0, Math.min(100, connectedness * 0.7 + 15));
  const roundedness = Math.max(0, Math.min(100, 100 - Math.abs(slant) - variance * 0.01));
  const baseline = Math.max(-50, Math.min(50, baselineScore));
  const consistency = Math.max(0, Math.min(100, consistencyScore));
  const strokeWidth = Math.max(0, Math.min(100, pressure * 0.8));
  const inkFlow = Math.max(0, Math.min(100, pressure * 0.6 + connectedness * 0.3));
  
  // Determine style name based on DNA
  const styleName = determineStyleName(slant, pressure, size, connectedness, consistency);
  const styleDescription = generateStyleDescription(slant, pressure, size, connectedness, consistency, baseline);
  
  return {
    slant, pressure, size, spacing, lineHeight,
    connectedness, loopiness, roundedness, baseline,
    consistency, strokeWidth, inkFlow,
    styleName, styleDescription,
  };
}

function determineStyleName(slant: number, pressure: number, size: number, connectedness: number, consistency: number): string {
  if (consistency > 75 && pressure > 55) return 'Neat Formal';
  if (consistency > 75 && pressure <= 55) return 'Neat Light';
  if (connectedness > 65 && slant > 10) return 'Flowing Cursive';
  if (connectedness > 65 && slant <= 10) return 'Connected Print';
  if (consistency < 35 && size > 55) return 'Bold Expressive';
  if (consistency < 35 && size <= 55) return 'Quick Scrawl';
  if (slant < -10) return 'Left-Slant Writer';
  if (pressure > 70) return 'Heavy Pressured';
  if (size > 70) return 'Large & Clear';
  if (size < 35) return 'Tiny & Compact';
  return 'Natural Mixed';
}

function generateStyleDescription(slant: number, pressure: number, size: number, connectedness: number, consistency: number, baseline: number): string {
  const traits: string[] = [];
  
  if (slant > 15) traits.push('right-leaning');
  else if (slant < -15) traits.push('left-leaning');
  else traits.push('upright');
  
  if (pressure > 65) traits.push('heavy pressure');
  else if (pressure < 35) traits.push('light touch');
  
  if (connectedness > 60) traits.push('connected/cursive style');
  else if (connectedness < 30) traits.push('printed/separate letters');
  
  if (consistency > 70) traits.push('very consistent');
  else if (consistency < 30) traits.push('variable/expressive');
  
  if (baseline > 10) traits.push('ascending baseline');
  else if (baseline < -10) traits.push('descending baseline');
  
  return `A ${traits.join(', ')} handwriting style`;
}

// Generate CSS for DNA profile (applied to handwriting text)
export function dnaToCSS(dna: HandwritingDNA): React.CSSProperties {
  return {
    // Font size based on DNA size
    fontSize: `${Math.max(12, Math.min(24, dna.size * 0.2 + 10))}px`,
    
    // Letter spacing based on DNA spacing
    letterSpacing: `${Math.max(-0.5, dna.spacing * 0.03 - 1)}px`,
    
    // Line height based on DNA lineHeight
    lineHeight: `${Math.max(1.2, dna.lineHeight * 0.02 + 1)}px`,
    
    // Transform for slant
    transform: `skewX(${dna.slant * 0.2}deg)`,
    
    // Text shadow for pressure
    textShadow: dna.pressure > 50 
      ? `0 0 ${dna.pressure * 0.02}px rgba(0,0,0,${dna.pressure * 0.003})` 
      : 'none',
    
    // Opacity for ink flow
    opacity: Math.max(0.7, dna.inkFlow * 0.005 + 0.5),
    
    // Font weight for stroke width
    fontWeight: Math.max(300, Math.min(700, dna.strokeWidth * 4 + 300)),
  };
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
  return {
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

export function generateWordVariation(dna: HandwritingDNA, wordIndex: number): Record<string, number> {
  const seed = wordIndex * 73.7;
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
