import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NKCircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'brand' | 'amber' | 'primary' | 'success';
  label?: React.ReactNode;
  sublabel?: string;
  className?: string;
  ariaLabel?: string;
}

const gradients: Record<NonNullable<NKCircularProgressProps['tone']>, { id: string; from: string; to: string }> = {
  brand: { id: 'nk-ring-brand', from: '#a34054', to: '#ed9e59' },
  amber: { id: 'nk-ring-amber', from: '#ed9e59', to: '#e9bcb9' },
  primary: { id: 'nk-ring-primary', from: '#662249', to: '#a34054' },
  success: { id: 'nk-ring-success', from: '#157f52', to: '#6fcf97' },
};

export const NKCircularProgress: React.FC<NKCircularProgressProps> = ({
  value,
  max = 100,
  size = 96,
  strokeWidth = 8,
  tone = 'brand',
  label,
  sublabel,
  className,
  ariaLabel,
}) => {
  const pct = Math.max(0, Math.min(100, (value / (max || 100)) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  const g = gradients[tone];
  const gradientId = `${g.id}-${React.useId().replace(/:/g, '')}`;

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel || `${Math.round(pct)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g.from} />
            <stop offset="100%" stopColor={g.to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--surface-hover-hsl))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset var(--nk-dur-slower) var(--nk-ease-out)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[15px] font-bold leading-none text-fg-primary tabular-nums">{label ?? `${Math.round(pct)}%`}</div>
          {sublabel && <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
};
