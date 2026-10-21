// ============================================================
// handwritingAnalysis — what a photo of real handwriting actually contains.
//
// The old analyser measured the whole photo (white margin included) with a
// fixed darkness threshold, so size/spacing/consistency came out noisy and the
// preview looked nothing like the sample. This module measures the ink itself:
//
//   1. Otsu threshold → ink mask (handles dim phone photos, inverted scans)
//   2. shear search → the true writing slant, in degrees
//   3. row projection → line bands (ruled lines excluded)
//   4. run lengths / gaps / band heights → stroke width, x-height, word gaps,
//      line pitch, connectedness and consistency
//   5. regression over line centroids → baseline drift
//
// Every value is mapped into the 0–100 DNA scale the renderer understands, so
// "analyse" is now a measurement instead of a guess. It is still honest: this
// reproduces the *character* of a sample (slant, size, rhythm, weight), it is
// not a forensic per-letter copy.
// ============================================================

import type { HandwritingDNA } from '@/components/handwriting-dna/HandwritingDNAEngine';
import { handwritingFontForDNA } from './handwritingStyle';

export interface InkImage {
  data: Uint8ClampedArray | number[] | Uint8Array;
  width: number;
  height: number;
}

export interface InkMetrics {
  /** Fraction of the frame covered by ink (0–1). */
  inkRatio: number;
  /** Median horizontal stroke width, px. */
  strokeWidth: number;
  /** Writing slant in degrees; positive leans right. */
  slant: number;
  /** Detected text lines. */
  lines: number;
  /** Median line pitch, px. */
  pitch: number;
  /** Median x-height, px. */
  xHeight: number;
  /** Median gap between words, px. */
  wordGap: number;
  /** Baseline drift, percent of one line per line; negative = drifts down. */
  baselineDrift: number;
  /** 0–1, share of letters joined to the next one. */
  connectedness: number;
  /** 0–1, how uniform the lines are. */
  consistency: number;
  /** 0–1, ink darkness. */
  pressure: number;
  /** 0–1, how much we trust the numbers (enough ink, enough lines). */
  confidence: number;
  /** Pen colour read off the ink pixels (blue, black, red, green). */
  inkColor: InkColor;
}

export type InkColor = 'black' | 'blue' | 'red' | 'green' | 'purple';

/** Classify the average ink colour; a phone photo of a blue pen is still blue. */
export function classifyInkColor(r: number, g: number, b: number): InkColor {
  if (b - r > 16 && b - g > 8) return 'blue';
  if (r - b > 28 && r - g > 28) return 'red';
  if (g - r > 14 && g - b > 10) return 'green';
  if (r - g > 10 && b - g > 10) return 'purple';
  return 'black';
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits = 2) => Number(v.toFixed(digits));

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[index];
}

/** Otsu's method on a 64-bin luma histogram. */
export function otsuThreshold(luma: Float32Array): number {
  const bins = 64;
  const histogram = new Float64Array(bins);
  for (let i = 0; i < luma.length; i++) {
    histogram[clamp(Math.floor((luma[i] / 255) * (bins - 1)), 0, bins - 1)]++;
  }
  const total = luma.length;
  let sum = 0;
  for (let b = 0; b < bins; b++) sum += b * histogram[b];

  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let bestVariance = -1;
  for (let b = 0; b < bins; b++) {
    weightB += histogram[b];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += b * histogram[b];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = b;
    }
  }
  return (best / (bins - 1)) * 255;
}

/**
 * Find the shear that makes the writing stand upright, by maximising the
 * variance of the column projection (the classic skew-detection trick).
 */
export function estimateSlant(ink: Uint8Array, width: number, height: number, metrics: { x0: number; y0: number; x1: number; y1: number }): number {
  const points: { x: number; y: number }[] = [];
  const step = Math.max(1, Math.round(Math.max(width, height) / 420));
  for (let y = metrics.y0; y <= metrics.y1; y += step) {
    for (let x = metrics.x0; x <= metrics.x1; x += step) {
      if (ink[y * width + x]) points.push({ x, y });
    }
  }
  if (points.length < 60) return 0;

  const span = metrics.x1 - metrics.x0 + 1;
  const bins = span + Math.ceil((metrics.y1 - metrics.y0) * 0.9) + 4;
  const offset = Math.ceil((metrics.y1 - metrics.y0) * 0.45) + 2;

  let bestK = 0;
  let bestVariance = -1;
  for (let deg = -26; deg <= 26; deg += 2) {
    const k = Math.tan((deg * Math.PI) / 180);
    const histogram = new Float64Array(bins);
    for (const p of points) {
      const shifted = p.x - metrics.x0 - k * (metrics.y1 - p.y) + offset;
      const bin = clamp(Math.round(shifted), 0, bins - 1);
      histogram[bin]++;
    }
    let mean = 0;
    for (let b = 0; b < bins; b++) mean += histogram[b];
    mean /= bins;
    let variance = 0;
    for (let b = 0; b < bins; b++) variance += (histogram[b] - mean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestK = k;
    }
  }
  const angle = round((Math.atan(bestK) * 180) / Math.PI, 1);
  // A tiny shear is noise, not a writing habit.
  return Math.abs(angle) < 2 ? 0 : clamp(angle, -26, 26);
}

interface Band { top: number; bottom: number; rows: Float32Array }

export function measureInkImage(image: InkImage): InkMetrics {
  const { width, height } = image;
  const total = Math.max(1, width * height);
  const data = image.data;

  const luma = new Float32Array(total);
  for (let i = 0, p = 0; i < total; i++, p += 4) {
    luma[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  const threshold = clamp(otsuThreshold(luma), 45, 205);
  const ink = new Uint8Array(total);
  let inkCount = 0;
  for (let i = 0; i < total; i++) {
    if (luma[i] < threshold) { ink[i] = 1; inkCount++; }
  }
  // Inverted scan / dark photo of white chalk: flip and re-measure.
  if (inkCount / total > 0.55) {
    inkCount = 0;
    for (let i = 0; i < total; i++) {
      ink[i] = luma[i] >= threshold ? 1 : 0;
      if (ink[i]) inkCount++;
    }
  }

  const empty: InkMetrics = {
    inkRatio: inkCount / total, strokeWidth: 0, slant: 0, lines: 0, pitch: 0,
    xHeight: 0, wordGap: 0, baselineDrift: 0, connectedness: 0,
    consistency: 0, pressure: 0, confidence: 0, inkColor: 'blue',
  };
  if (inkCount / total < 0.002 || inkCount < 200) return empty;

  // Ink bounding box — margins and shadows no longer skew the metrics.
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  let lumaSum = 0, rSum = 0, gSum = 0, bSum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!ink[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const idx = y * width + x;
      lumaSum += luma[idx];
      rSum += data[idx * 4];
      gSum += data[idx * 4 + 1];
      bSum += data[idx * 4 + 2];
    }
  }

  const inkColor = classifyInkColor(rSum / inkCount, gSum / inkCount, bSum / inkCount);

  const slant = estimateSlant(ink, width, height, { x0, y0, x1, y1 });
  const k = Math.tan((slant * Math.PI) / 180);

  // Row projection over the de-skewed frame gives the line bands.
  const rowInk = new Float32Array(height);
  for (let y = y0; y <= y1; y++) {
    let count = 0;
    for (let x = x0; x <= x1; x++) if (ink[y * width + x]) count++;
    rowInk[y] = count;
  }
  let maxRow = 0;
  for (let y = y0; y <= y1; y++) maxRow = Math.max(maxRow, rowInk[y]);
  if (maxRow === 0) return empty;

  const rowCut = Math.max(1.5, maxRow * 0.14);
  const bands: Band[] = [];
  let start = -1;
  for (let y = y0; y <= y1 + 1; y++) {
    const active = y <= y1 && rowInk[y] >= rowCut;
    if (active && start < 0) start = y;
    if (!active && start >= 0) {
      const end = y - 1;
      // Ruled lines are 1–2 px tall and span almost the full width: not text.
      const bandHeight = end - start + 1;
      let bandInk = 0;
      for (let yy = start; yy <= end; yy++) bandInk += rowInk[yy];
      const density = bandInk / Math.max(1, bandHeight * (x1 - x0 + 1));
      if (bandHeight >= 3 && !(bandHeight <= 2 && density > 0.5)) {
        bands.push({ top: start, bottom: end, rows: rowInk.slice(start, end + 1) });
      }
      start = -1;
    }
  }
  if (!bands.length) bands.push({ top: y0, bottom: y1, rows: rowInk.slice(y0, y1 + 1) });

  const strokes: number[] = [];
  const gaps: number[] = [];
  const cores: number[] = [];
  const centroids: number[] = [];
  let joinedLetters = 0;
  let letterSlots = 0;

  for (const band of bands) {
    let bandMax = 0;
    for (let i = 0; i < band.rows.length; i++) bandMax = Math.max(bandMax, band.rows[i]);
    let coreTop = -1;
    let coreBottom = -1;
    let centroidWeight = 0;
    let centroidSum = 0;
    for (let y = band.top; y <= band.bottom; y++) {
      if (band.rows[y - band.top] >= bandMax * 0.5) {
        if (coreTop < 0) coreTop = y;
        coreBottom = y;
      }
      centroidWeight += band.rows[y - band.top] * (y - band.top);
      centroidSum += band.rows[y - band.top];
    }
    if (coreTop >= 0) cores.push(coreBottom - coreTop + 1);
    if (centroidSum > 0) centroids.push(centroidWeight / centroidSum + band.top);

    // Column runs (de-skewed) inside the band: stroke widths and letter gaps.
    const bandWidth = x1 - x0 + 1;
    const colInk = new Float32Array(bandWidth + 1);
    for (let y = band.top; y <= band.bottom; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!ink[y * width + x]) continue;
        const shifted = Math.round(x - x0 - k * (band.bottom - y));
        const col = clamp(shifted, 0, bandWidth);
        colInk[col]++;
      }
    }

    let runStart = -1;
    for (let c = 0; c <= bandWidth; c++) {
      const on = c < bandWidth && colInk[c] > 0;
      if (on && runStart < 0) runStart = c;
      if (!on && runStart >= 0) {
        const length = c - runStart;
        if (length <= bandWidth * 0.35) strokes.push(length);
        runStart = -1;
      }
    }

    // Gaps between ink columns: letter gaps are short, word gaps long.
    let gapStart = -1;
    const bandGaps: number[] = [];
    for (let c = 0; c < bandWidth; c++) {
      const empty = colInk[c] === 0;
      if (empty && gapStart < 0) gapStart = c;
      if (!empty && gapStart >= 0) {
        bandGaps.push(c - gapStart);
        gapStart = -1;
      }
    }
    const inner = bandGaps.filter(g => g > 0 && g < bandWidth * 0.3);
    if (inner.length) {
      const strokeWidth = median(strokes) || 2;
      const letterGap = percentile(inner, 60);
      const wordGap = Math.max(letterGap, percentile(inner, 88));
      gaps.push(wordGap);
      const expectedLetters = Math.max(1, Math.round(bandWidth / Math.max(4, (median(cores) || 8) * 0.62)));
      const letterBreaks = inner.filter(g => g >= Math.max(2, strokeWidth * 1.1) && g < wordGap * 0.95).length;
      joinedLetters += Math.max(0, expectedLetters - letterBreaks);
      letterSlots += expectedLetters;
    }
  }

  const strokeWidth = median(strokes) || Math.max(1, Math.round((x1 - x0) / 400));
  const xHeight = median(cores) || 8;
  const wordGap = median(gaps) || xHeight * 0.6;
  const pitch = bands.length > 1
    ? median(bands.slice(1).map((band, i) => band.top - bands[i].top))
    : (y1 - y0 + 1);

  // Baseline drift: how the line centroids travel from top to bottom.
  let drift = 0;
  if (centroids.length >= 2) {
    const n = centroids.length;
    const meanX = (n - 1) / 2;
    const meanY = centroids.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    centroids.forEach((y, i) => {
      numerator += (i - meanX) * (y - meanY);
      denominator += (i - meanX) ** 2;
    });
    const slope = denominator ? numerator / denominator : 0;
    drift = clamp(-(slope / Math.max(1, pitch)) * 100, -40, 40); // negative = drifts down
  }

  // Consistency: how steady the pitch and the word gaps are.
  const pitches = bands.slice(1).map((band, i) => band.top - bands[i].top);
  const pitchCv = pitches.length > 1
    ? stdDev(pitches) / Math.max(1, median(pitches))
    : 0.35;
  const gapCv = gaps.length > 1 ? stdDev(gaps) / Math.max(1, median(gaps)) : 0.4;
  const consistency = clamp(1 - (pitchCv * 0.7 + gapCv * 0.5), 0, 1);
  const connectedness = letterSlots ? clamp(joinedLetters / letterSlots, 0, 1) : 0.4;
  const pressure = clamp(1 - (lumaSum / Math.max(1, inkCount)) / 255, 0, 1);

  const confidence = clamp(
    0.25
    + Math.min(0.4, bands.length / 12)
    + Math.min(0.2, (inkCount / total) * 6)
    + (xHeight >= 6 ? 0.15 : 0),
    0, 1,
  );

  return {
    inkRatio: inkCount / total,
    strokeWidth,
    slant,
    lines: bands.length,
    pitch,
    xHeight,
    wordGap,
    baselineDrift: round(drift, 1),
    connectedness: round(connectedness, 3),
    consistency: round(consistency, 3),
    pressure: round(pressure, 3),
    confidence: round(confidence, 2),
    inkColor,
  };
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

export function styleNameFor(metrics: InkMetrics): string {
  const slant = metrics.slant;
  const connected = metrics.connectedness * 100;
  const consistency = metrics.consistency * 100;
  const pressure = metrics.pressure * 100;
  if (consistency > 72 && connected > 65) return 'Flowing Cursive';
  if (consistency > 70 && pressure > 55) return 'Neat Formal';
  if (consistency > 68) return 'Neat Regular';
  if (connected > 62) return 'Connected Hand';
  if (slant >= 12) return 'Right-Leaning Writer';
  if (slant <= -8) return 'Left-Leaning Writer';
  if (consistency < 32) return 'Quick Scrawl';
  if (pressure > 65) return 'Heavy Pressured';
  return 'Natural Hand';
}

export function describeStyle(metrics: InkMetrics): string {
  const traits: string[] = [];
  const slant = Math.abs(metrics.slant);
  if (metrics.slant >= 8) traits.push('right-leaning');
  else if (metrics.slant <= -6) traits.push('left-leaning');
  else traits.push('upright');
  if (slant >= 18) traits.push('strong slant');
  if (metrics.pressure > 0.62) traits.push('heavy pressure');
  else if (metrics.pressure < 0.32) traits.push('light touch');
  if (metrics.connectedness > 0.6) traits.push('joined letters');
  else if (metrics.connectedness < 0.28) traits.push('separate letters');
  if (metrics.consistency > 0.7) traits.push('very steady lines');
  else if (metrics.consistency < 0.35) traits.push('loose, expressive lines');
  if (metrics.baselineDrift < -6) traits.push('lines drift downward');
  else if (metrics.baselineDrift > 6) traits.push('lines climb upward');
  return `Measured from your sample: ${traits.join(', ')}.`;
}

/** Turn measured ink into the DNA the renderer consumes. */
export function dnaFromMetrics(metrics: InkMetrics): HandwritingDNA {
  const size = clamp((metrics.xHeight / 34) * 100, 0, 100);
  const spacing = clamp(((metrics.wordGap / Math.max(4, metrics.xHeight)) - 0.35) / 1.15 * 100, 0, 100);
  const lineHeight = clamp(((metrics.pitch / Math.max(6, metrics.xHeight + metrics.strokeWidth)) - 1.05) / 1.5 * 100, 0, 100);
  const strokeWidthScore = clamp((metrics.strokeWidth / 6) * 100, 0, 100);
  const pressure = clamp(metrics.pressure * 115, 0, 100);
  const connectedness = clamp(metrics.connectedness * 100, 0, 100);
  const consistency = clamp(metrics.consistency * 100, 0, 100);
  const slant = clamp(metrics.slant, -30, 30);

  const dna: HandwritingDNA = {
    slant,
    pressure,
    size,
    spacing,
    lineHeight,
    connectedness,
    loopiness: clamp(connectedness * 0.6 + size * 0.2, 0, 100),
    roundedness: clamp(100 - Math.abs(slant) * 1.4 - consistency * 0.12, 20, 100),
    baseline: clamp(metrics.baselineDrift, -50, 50),
    consistency,
    strokeWidth: strokeWidthScore,
    inkFlow: clamp(pressure * 0.6 + connectedness * 0.35, 0, 100),
    styleName: styleNameFor(metrics),
    styleDescription: describeStyle(metrics),
    // Extended fields the page renderer reads directly — previously left empty
    // after an analysis, so every "scanned" style rendered like the default.
    letterSpacing: round(0.2 + (spacing / 100) * 2.2, 2),
    wordSpacing: Math.round(clamp(3 + (spacing / 100) * 6, 3, 9)),
    baselineDrift: round(clamp(0.6 + (100 - consistency) / 40, 0.6, 3), 2),
    penPressure: round(metrics.pressure, 2),
    strokeThickness: round(clamp(0.75 + strokeWidthScore / 70, 0.75, 2.2), 2),
    strokeSpeed: round(1 + (100 - consistency) / 120, 2),
    characterSize: Math.round(metrics.xHeight),
    sampleQuality: metrics.confidence >= 0.7 ? 'good' : metrics.confidence >= 0.45 ? 'fair' : 'poor',
    confidence: metrics.confidence,
    inkColor: metrics.inkColor,
    fontModifications: {},
  };

  dna.closestFont = handwritingFontForDNA(dna);
  return dna;
}

/** Full pipeline: an ImageData-like object → DNA. */
export function dnaFromInkImage(image: InkImage): HandwritingDNA {
  return dnaFromMetrics(measureInkImage(image));
}
