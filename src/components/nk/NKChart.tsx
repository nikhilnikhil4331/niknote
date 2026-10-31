import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKChartPoint {
  label: string;
  value: number;
}

export interface NKChartProps {
  data: NKChartPoint[];
  type?: 'line' | 'area' | 'bar' | 'donut';
  height?: number;
  title: string;
  formatValue?: (value: number) => string;
  color?: string;
  secondaryColors?: string[];
  className?: string;
  showValues?: boolean;
}

/* Coordinated Sunset Plum chart palette (raw brand tokens are allowed here:
   this component *is* part of the design system). */
const DEFAULT_COLORS = ['#A34054', '#ED9E59', '#E9BCB9', '#662249', '#44174E', '#C0A6DE', '#6FCF97'];

/**
 * Lightweight SVG chart with a coordinated palette and readable labels.
 * No external chart library so it stays crisp on mobile and in print.
 */
export const NKChart: React.FC<NKChartProps> = ({
  data,
  type = 'line',
  height = 180,
  title,
  formatValue = (v) => `${v}`,
  color = DEFAULT_COLORS[0],
  secondaryColors = DEFAULT_COLORS,
  className,
  showValues = false,
}) => {
  const width = 480;
  const pad = { top: 14, right: 10, bottom: 24, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const gap = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const summary = `${title}: ${data.map((d) => `${d.label} ${formatValue(d.value)}`).join(', ')}`;
  const gradientId = `nk-chart-${React.useId().replace(/:/g, '')}`;

  if (!data.length) {
    return (
      <div className={cn('grid place-items-center rounded-[var(--nk-radius-md)] bg-surface-secondary text-[12px] text-fg-muted', className)} style={{ height }}>
        No data yet
      </div>
    );
  }

  if (type === 'donut') {
    const radius = Math.min(innerW, innerH) / 2 - 6;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return (
      <div className={cn('flex flex-col items-center gap-3 sm:flex-row sm:justify-center', className)}>
        <svg viewBox="0 0 200 200" width={height} height={height} role="img" aria-label={summary}>
          <title>{summary}</title>
          <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(var(--surface-hover-hsl))" strokeWidth="20" />
          {data.map((d, i) => {
            const fraction = total > 0 ? Math.max(0, d.value) / total : 0;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={d.label}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={secondaryColors[i % secondaryColors.length]}
                strokeWidth="20"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 100 100)"
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-1.5 text-[11.5px] text-fg-secondary">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: secondaryColors[i % secondaryColors.length] }} />
              {d.label}
              <span className="font-semibold tabular-nums text-fg-primary">{formatValue(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const points = data.map((d, i) => ({
    x: pad.left + (data.length === 1 ? innerW / 2 : i * gap),
    y: pad.top + innerH - (d.value / max) * innerH,
    ...d,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${pad.top + innerH} L${points[0].x.toFixed(1)},${pad.top + innerH} Z`;
  const barW = Math.max(6, (innerW / data.length) * 0.52);

  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={summary} preserveAspectRatio="none">
        <title>{summary}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + innerH * t}
            y2={pad.top + innerH * t}
            stroke="hsl(var(--border-subtle-hsl))"
            strokeDasharray={t === 1 ? undefined : '3 5'}
            strokeWidth="1"
          />
        ))}
        {type === 'bar'
          ? points.map((p, i) => (
              <g key={p.label}>
                <rect
                  x={pad.left + (i + 0.5) * (innerW / data.length) - barW / 2}
                  y={p.y}
                  width={barW}
                  height={Math.max(2, pad.top + innerH - p.y)}
                  rx={Math.min(6, barW / 2)}
                  fill={secondaryColors[i % secondaryColors.length]}
                  opacity={0.92}
                />
              </g>
            ))
          : (
              <>
                {type === 'area' && <path d={areaPath} fill={`url(#${gradientId})`} />}
                <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p) => (
                  <circle key={p.label} cx={p.x} cy={p.y} r="3.4" fill="hsl(var(--surface-elevated-hsl))" stroke={color} strokeWidth="2" />
                ))}
              </>
            )}
        {points.map((p, i) => (
          <text
            key={`${p.label}-label`}
            x={type === 'bar' ? pad.left + (i + 0.5) * (innerW / data.length) : p.x}
            y={height - 7}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="600"
            fill="hsl(var(--text-muted-hsl))"
          >
            {p.label}
          </text>
        ))}
        {showValues &&
          points.map((p) => (
            <text key={`${p.label}-value`} x={p.x} y={Math.max(10, p.y - 7)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="hsl(var(--text-secondary-hsl))">
              {formatValue(p.value)}
            </text>
          ))}
      </svg>
    </figure>
  );
};
