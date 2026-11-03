export type PlaygroundChartType = 'bar' | 'line' | 'area';

export interface PlaygroundChartDatum {
  id: string;
  label: string;
  value: number;
}

export interface PlaygroundChartLayout {
  width: number;
  height: number;
  left: number;
  top: number;
  plotWidth: number;
  plotHeight: number;
  zeroY: number;
  grids: { y: number; value: number }[];
  bars: (PlaygroundChartDatum & { x: number; y: number; width: number; height: number })[];
  points: (PlaygroundChartDatum & { x: number; y: number })[];
  labels: { id: string; x: number; y: number; text: string }[];
  linePath: string;
  areaPath: string;
}

export function normalizeChartType(value: unknown): PlaygroundChartType {
  return value === 'line' || value === 'area' ? value : 'bar';
}

export function normalizeChartData(value: unknown): PlaygroundChartDatum[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry, index) => {
      const proposed = typeof entry.id === 'string' && entry.id ? entry.id : `point-${index + 1}`;
      const id = ids.has(proposed) ? `${proposed}-${index + 1}` : proposed;
      ids.add(id);
      return {
        id,
        label: typeof entry.label === 'string' ? entry.label : `Point ${index + 1}`,
        value: typeof entry.value === 'number' && Number.isFinite(entry.value) ? entry.value : 0,
      };
    });
}

export function formatChartValue(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}m`;
  if (Math.abs(value) >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return String(Number(value.toFixed(2)));
}

/** Pure geometry shared by the React graphic and SVG export. */
export function buildChartLayout(
  input: PlaygroundChartDatum[],
  width = 400,
  height = 220,
): PlaygroundChartLayout {
  const data = normalizeChartData(input);
  const left = 42;
  const top = 12;
  const right = 12;
  const bottom = 34;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const values = data.map((datum) => datum.value);
  let maximum = data.length ? Math.max(0, ...values) : 1;
  const minimum = data.length ? Math.min(0, ...values) : 0;
  if (maximum === minimum) maximum = minimum + 1;
  const range = maximum - minimum;
  const yFor = (value: number) => top + (maximum - value) / range * plotHeight;
  const zeroY = Math.max(top, Math.min(top + plotHeight, yFor(0)));
  const grids = Array.from({ length: 5 }, (_, index) => ({
    y: top + plotHeight * index / 4,
    value: maximum - range * index / 4,
  }));
  const band = data.length ? plotWidth / data.length : plotWidth;
  const points = data.map((datum, index) => ({
    ...datum,
    x: left + band * (index + 0.5),
    y: yFor(datum.value),
  }));
  const bars = points.map((point) => {
    const barWidth = Math.max(1, Math.min(42, band * 0.62));
    return {
      ...point,
      x: point.x - barWidth / 2,
      y: Math.min(point.y, zeroY),
      width: barWidth,
      height: Math.abs(zeroY - point.y),
    };
  });
  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const labels = points.filter((_, index) => index % labelStep === 0).map((point) => ({
    id: point.id,
    x: point.x,
    y: top + plotHeight + 21,
    text: point.label.length > 12 ? `${point.label.slice(0, 11)}…` : point.label || '—',
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`
    : '';
  return { width, height, left, top, plotWidth, plotHeight, zeroY, grids, bars, points, labels, linePath, areaPath };
}

const escapeSvg = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]!));

interface ChartSvgOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  data?: PlaygroundChartDatum[];
  type?: PlaygroundChartType;
  dark?: boolean;
}

/** Export the same real data as a self-contained vector chart. */
export function chartSvgMarkup({ x, y, width, height, title, data = [], type = 'bar', dark = false }: ChartSvgOptions) {
  const panel = dark ? '#151219' : '#FFFFFF';
  const text = dark ? '#F8F5FA' : '#17131B';
  const muted = dark ? '#A79EAD' : '#77717C';
  const grid = dark ? '#29232D' : '#EAE7ED';
  const chartWidth = Math.max(120, width - 24);
  const chartHeight = Math.max(80, height - 54);
  const layout = buildChartLayout(data, chartWidth, chartHeight);
  const labelText = (value: string) => escapeSvg(value);
  const gridMarkup = layout.grids.map((line) => `<line x1="${layout.left}" y1="${line.y}" x2="${layout.left + layout.plotWidth}" y2="${line.y}" stroke="${grid}" stroke-width="1"/><text x="${layout.left - 7}" y="${line.y + 3}" text-anchor="end" fill="${muted}" font-size="8">${formatChartValue(line.value)}</text>`).join('');
  const labels = layout.labels.map((label) => `<text x="${label.x}" y="${label.y}" text-anchor="middle" fill="${muted}" font-size="9">${labelText(label.text)}</text>`).join('');
  let dataMarkup = '';
  if (type === 'bar') {
    dataMarkup = layout.bars.map((bar) => `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="3" fill="#8020A2"><title>${labelText(bar.label)}: ${bar.value}</title></rect>`).join('');
  } else {
    if (type === 'area' && layout.areaPath) dataMarkup += `<path d="${layout.areaPath}" fill="#CB289D" fill-opacity=".14"/>`;
    if (layout.linePath) dataMarkup += `<path d="${layout.linePath}" fill="none" stroke="#CB289D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    dataMarkup += layout.points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${panel}" stroke="#CB289D" stroke-width="2"><title>${labelText(point.label)}: ${point.value}</title></circle>`).join('');
  }
  const empty = data.length ? '' : `<text x="${chartWidth / 2}" y="${chartHeight / 2}" text-anchor="middle" fill="${muted}" font-size="12">No chart data yet</text>`;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${panel}" stroke="${grid}"/><text x="${x + 16}" y="${y + 25}" fill="${text}" font-family="Inter, sans-serif" font-size="14" font-weight="650">${labelText(title || 'Untitled chart')}</text><g transform="translate(${x + 12} ${y + 42})" font-family="Inter, sans-serif">${gridMarkup}<line x1="${layout.left}" y1="${layout.zeroY}" x2="${layout.left + layout.plotWidth}" y2="${layout.zeroY}" stroke="${muted}" stroke-width="1"/>${dataMarkup}${labels}${empty}</g>`;
}
