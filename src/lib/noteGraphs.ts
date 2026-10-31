// ============================================================
// noteGraphs — deterministic, accurate function graphs rendered
// as crisp SVG that lives inside a NoteLine (blockType 'graph').
//
// Real coordinate math — no decorative images: sampled curve,
// labelled axes, gridlines, tick marks and a caption. Persists
// as a compact spec string so notes stay editable & portable.
// ============================================================

export type GraphFn = 'sin' | 'cos' | 'tan' | 'x2' | 'x3' | 'sqrt' | 'exp' | 'log' | 'abs' | 'line';

export interface GraphSpec {
  fn: GraphFn;
  amp: number;   // amplitude / slope scale
  freq: number;  // frequency (x multiplier)
  c: number;     // vertical shift
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  label: string; // caption shown under the graph
  color: string; // stroke color
}

export const GRAPH_PRESETS: { id: GraphFn; label: string; formula: string; spec: Partial<GraphSpec> }[] = [
  { id: 'sin',   label: 'Sine wave',    formula: 'y = A·sin(Bx) + C', spec: { fn: 'sin',   amp: 1, freq: 1, c: 0, xMin: -7, xMax: 7, yMin: -3, yMax: 3 } },
  { id: 'cos',   label: 'Cosine wave',  formula: 'y = A·cos(Bx) + C', spec: { fn: 'cos',   amp: 1, freq: 1, c: 0, xMin: -7, xMax: 7, yMin: -3, yMax: 3 } },
  { id: 'x2',    label: 'Parabola',     formula: 'y = A·x² + C',      spec: { fn: 'x2',    amp: 0.5, freq: 1, c: 0, xMin: -5, xMax: 5, yMin: -2, yMax: 8 } },
  { id: 'x3',    label: 'Cubic',        formula: 'y = A·x³',          spec: { fn: 'x3',    amp: 0.2, freq: 1, c: 0, xMin: -4, xMax: 4, yMin: -5, yMax: 5 } },
  { id: 'sqrt',  label: 'Square root',  formula: 'y = A·√x + C',      spec: { fn: 'sqrt',  amp: 2, freq: 1, c: 0, xMin: -1, xMax: 16, yMin: -1, yMax: 9 } },
  { id: 'exp',   label: 'Exponential',  formula: 'y = A·e^(Bx)',      spec: { fn: 'exp',   amp: 1, freq: 0.5, c: 0, xMin: -4, xMax: 4, yMin: -1, yMax: 8 } },
  { id: 'log',   label: 'Logarithm',    formula: 'y = A·ln(x) + C',   spec: { fn: 'log',   amp: 1.5, freq: 1, c: 0, xMin: 0.1, xMax: 10, yMin: -2, yMax: 4 } },
  { id: 'abs',   label: 'Absolute',     formula: 'y = A·|x| + C',     spec: { fn: 'abs',   amp: 1, freq: 1, c: 0, xMin: -5, xMax: 5, yMin: -1, yMax: 6 } },
  { id: 'line',  label: 'Straight line',formula: 'y = A·x + C',       spec: { fn: 'line',  amp: 1, freq: 1, c: 0, xMin: -5, xMax: 5, yMin: -5, yMax: 5 } },
];

export function evalGraphFn(spec: GraphSpec, x: number): number {
  const { fn, amp, freq, c } = spec;
  const u = freq * x;
  switch (fn) {
    case 'sin': return amp * Math.sin(u) + c;
    case 'cos': return amp * Math.cos(u) + c;
    case 'tan': { const v = amp * Math.tan(u) + c; return Math.abs(v) > 40 ? NaN : v; }
    case 'x2': return amp * u * u + c;
    case 'x3': return amp * u * u * u + c;
    case 'sqrt': return u >= 0 ? amp * Math.sqrt(u) + c : NaN;
    case 'exp': return amp * Math.exp(u) + c;
    case 'log': return u > 0 ? amp * Math.log(u) + c : NaN;
    case 'abs': return amp * Math.abs(u) + c;
    case 'line': return amp * u + c;
    default: return NaN;
  }
}

const W = 640;
const H = 360;
const PAD = { l: 46, r: 16, t: 18, b: 40 };

function fmtTick(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

/**
 * Build a standalone SVG string for the given spec.
 * Pure function — safe to memoize & re-render.
 */
export function graphToSVG(spec: GraphSpec): string {
  const { xMin, xMax, yMin, yMax } = spec;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const sx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * iw;
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * ih;

  // grid + ticks
  const xTicks = niceTicks(xMin, xMax, 8);
  const yTicks = niceTicks(yMin, yMax, 6);
  let grid = '';
  for (const t of xTicks) {
    grid += `<line x1="${sx(t).toFixed(1)}" y1="${PAD.t}" x2="${sx(t).toFixed(1)}" y2="${PAD.t + ih}" stroke="#e4e1ef" stroke-width="1"/>`;
    grid += `<text x="${sx(t).toFixed(1)}" y="${PAD.t + ih + 16}" font-size="11" fill="#8a86a3" text-anchor="middle">${fmtTick(t)}</text>`;
  }
  for (const t of yTicks) {
    grid += `<line x1="${PAD.l}" y1="${sy(t).toFixed(1)}" x2="${PAD.l + iw}" y2="${sy(t).toFixed(1)}" stroke="#e4e1ef" stroke-width="1"/>`;
    grid += `<text x="${PAD.l - 8}" y="${(sy(t) + 4).toFixed(1)}" font-size="11" fill="#8a86a3" text-anchor="end">${fmtTick(t)}</text>`;
  }

  // axes (only inside range)
  let axes = '';
  if (yMin < 0 && yMax > 0) axes += `<line x1="${PAD.l}" y1="${sy(0).toFixed(1)}" x2="${PAD.l + iw}" y2="${sy(0).toFixed(1)}" stroke="#4c4869" stroke-width="1.5"/>`;
  if (xMin < 0 && xMax > 0) axes += `<line x1="${sx(0).toFixed(1)}" y1="${PAD.t}" x2="${sx(0).toFixed(1)}" y2="${PAD.t + ih}" stroke="#4c4869" stroke-width="1.5"/>`;

  // curve — sampled, broken on NaN so asymptotes render cleanly
  const N = 480;
  let path = '';
  let pen = false;
  for (let i = 0; i <= N; i++) {
    const x = xMin + ((xMax - xMin) * i) / N;
    const y = evalGraphFn(spec, x);
    if (!Number.isFinite(y) || y < yMin - (yMax - yMin) || y > yMax + (yMax - yMin)) { pen = false; continue; }
    const py = Math.max(PAD.t, Math.min(PAD.t + ih, sy(y)));
    path += pen ? `L${sx(x).toFixed(1)} ${py.toFixed(1)}` : `M${sx(x).toFixed(1)} ${py.toFixed(1)}`;
    pen = true;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(spec.label)}" style="width:100%;height:auto;font-family:ui-sans-serif,system-ui,sans-serif">
  <rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="#fbfaff"/>
  <rect x="${PAD.l}" y="${PAD.t}" width="${iw}" height="${ih}" fill="none" stroke="#d9d5e8" stroke-width="1"/>
  ${grid}${axes}
  <path d="${path}" fill="none" stroke="${spec.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${PAD.l}" y="${H - 10}" font-size="13" font-weight="600" fill="#3f3b5c">${escapeXml(spec.label)}</text>
</svg>`;
}

/** Reasonably spaced "nice" tick values across [min, max]. */
export function niceTicks(min: number, max: number, target: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rawStep = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  return ticks;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- persistence encoding: graph line text <-> spec -------------------

export function encodeGraphSpec(spec: GraphSpec): string {
  return `graph:${JSON.stringify(spec)}`;
}

export function decodeGraphSpec(text: string): GraphSpec | null {
  if (!text.startsWith('graph:')) return null;
  try {
    const raw = JSON.parse(text.slice(6));
    const preset = GRAPH_PRESETS.find(p => p.id === raw.fn)?.spec;
    return {
      fn: raw.fn ?? 'sin',
      amp: raw.amp ?? preset?.amp ?? 1,
      freq: raw.freq ?? preset?.freq ?? 1,
      c: raw.c ?? preset?.c ?? 0,
      xMin: raw.xMin ?? preset?.xMin ?? -5,
      xMax: raw.xMax ?? preset?.xMax ?? 5,
      yMin: raw.yMin ?? preset?.yMin ?? -5,
      yMax: raw.yMax ?? preset?.yMax ?? 5,
      label: raw.label || 'Graph',
      color: raw.color || '#7C5F9E',
    };
  } catch {
    return null;
  }
}

/** Default label for a spec, derived from the active formula. */
export function graphLabel(spec: Pick<GraphSpec, 'fn' | 'amp' | 'freq' | 'c'>): string {
  const A = spec.amp === 1 ? '' : String(spec.amp);
  const B = spec.freq === 1 ? 'x' : `${spec.freq}x`;
  const C = spec.c === 0 ? '' : spec.c > 0 ? ` + ${spec.c}` : ` − ${Math.abs(spec.c)}`;
  switch (spec.fn) {
    case 'sin': return `y = ${A}sin(${B})${C}`;
    case 'cos': return `y = ${A}cos(${B})${C}`;
    case 'tan': return `y = ${A}tan(${B})${C}`;
    case 'x2': return `y = ${A}x²${C}`;
    case 'x3': return `y = ${A}x³${C}`;
    case 'sqrt': return `y = ${A}√x${C}`;
    case 'exp': return `y = ${A}e^${B === 'x' ? 'x' : `(${B})`}${C}`;
    case 'log': return `y = ${A}ln(x)${C}`;
    case 'abs': return `y = ${A}|x|${C}`;
    case 'line': return `y = ${A}x${C}`;
    default: return 'Graph';
  }
}
