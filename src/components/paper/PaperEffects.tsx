// Realistic paper effects + pen types for handwritten pages
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { haptic } from '@/hooks/useHaptics';

export type PenType = 'ballpoint' | 'gel' | 'fountain' | 'pencil' | 'marker';
export type PaperTint = 'white' | 'cream' | 'vintage' | 'recycled';
export interface PaperEffects {
  smudges: boolean;
  folds: boolean;
  eraser: boolean;
  coffee: boolean;
  shadow: boolean;
  rotation: boolean;
  tint: PaperTint;
}
export const DEFAULT_EFFECTS: PaperEffects = { smudges: false, folds: false, eraser: false, coffee: false, shadow: false, rotation: false, tint: 'white' };

export const PEN_OPTIONS: { value: PenType; label: string; emoji: string }[] = [
  { value: 'ballpoint', label: 'Ballpoint', emoji: '🖊️' },
  { value: 'gel', label: 'Gel pen', emoji: '✒️' },
  { value: 'fountain', label: 'Fountain', emoji: '🖋️' },
  { value: 'pencil', label: 'Pencil', emoji: '✏️' },
  { value: 'marker', label: 'Marker', emoji: '🖍️' },
];
const TINTS: { value: PaperTint; label: string; color: string }[] = [
  { value: 'white', label: 'White', color: 'transparent' },
  { value: 'cream', label: 'Cream', color: 'hsl(45 80% 90% / 0.55)' },
  { value: 'vintage', label: 'Old', color: 'hsl(35 55% 75% / 0.45)' },
  { value: 'recycled', label: 'Recycled', color: 'hsl(40 12% 78% / 0.5)' },
];
const EFFECT_TOGGLES: { key: keyof Omit<PaperEffects, 'tint'>; label: string; emoji: string }[] = [
  { key: 'smudges', label: 'Ink smudges', emoji: '💧' },
  { key: 'folds', label: 'Fold marks', emoji: '📄' },
  { key: 'eraser', label: 'Eraser marks', emoji: '🧽' },
  { key: 'coffee', label: 'Coffee stain', emoji: '☕' },
  { key: 'shadow', label: 'Shadow', emoji: '🌗' },
  { key: 'rotation', label: 'Slight tilt', emoji: '↩️' },
];

/** Deterministic pseudo-random so a page looks the same in preview and export. */
export function seeded(seed: number) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function pageTilt(fx: PaperEffects | undefined, pageIndex: number) {
  if (!fx?.rotation) return 0;
  return (seeded(pageIndex + 7)() - 0.5) * 1.6; // ±0.8°
}

export const penClass = (pen?: PenType) => `pen-${pen ?? 'ballpoint'}`;

/** Builds all paper effects as one SVG image so they look identical on screen and in PDF/PNG exports. */
export function buildEffectsSvg(fx: PaperEffects, pageIndex: number, w = 595, h = 842) {
  const r = seeded(pageIndex + 1);
  const p = Array.from({ length: 6 }, () => ({ x: r() * 0.85 + 0.05, y: r() * 0.85 + 0.05, s: r() * 10 + 6, a: r() * 360 }));
  const tint = TINTS.find(t => t.value === fx.tint)?.color;
  const parts: string[] = [
    '<defs><filter id="b2"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="b1"><feGaussianBlur stdDeviation="1"/></filter>',
    '<radialGradient id="ink"><stop offset="0" stop-color="hsl(220,70%,35%)" stop-opacity=".22"/><stop offset="1" stop-color="hsl(220,70%,35%)" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="er"><stop offset="0" stop-color="#999" stop-opacity=".16"/><stop offset="1" stop-color="#999" stop-opacity="0"/></radialGradient>',
    '<linearGradient id="sh" x1="0" y1="0" x2="1" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>',
    '<linearGradient id="fh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".45" stop-color="#000" stop-opacity=".09"/><stop offset=".55" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>',
    '<linearGradient id="fv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".45" stop-color="#000" stop-opacity=".07"/><stop offset=".55" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>',
  ];
  if (tint && tint !== 'transparent') parts.push(`<rect width="${w}" height="${h}" fill="${tint.replace(/ \/ ([\d.]+)\)/, ')').replace(/hsl\((\d+) (\d+)% (\d+)%\)/, 'hsl($1,$2%,$3%)')}" opacity="${fx.tint === 'white' ? 0 : 0.45}"/>`);
  if (fx.tint === 'recycled') for (let k = 0; k < 260; k++) parts.push(`<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(r() * 0.9 + 0.3).toFixed(2)}" fill="#7a6f60" opacity=".35"/>`);
  if (fx.folds) parts.push(`<rect x="0" y="${h / 2 - 8}" width="${w}" height="16" fill="url(#fh)"/><rect x="${w / 2 - 8}" y="0" width="16" height="${h}" fill="url(#fv)"/>`);
  if (fx.smudges) p.slice(0, 3).forEach(q => parts.push(`<ellipse cx="${q.x * w}" cy="${q.y * h}" rx="${q.s * 1.8}" ry="${q.s}" transform="rotate(${q.a} ${q.x * w} ${q.y * h})" fill="url(#ink)" filter="url(#b1)"/>`));
  if (fx.eraser) p.slice(3, 5).forEach(q => parts.push(`<ellipse cx="${q.x * w}" cy="${q.y * h}" rx="${q.s * 4}" ry="${q.s * 1.3}" transform="rotate(${q.a / 8} ${q.x * w} ${q.y * h})" fill="url(#er)" filter="url(#b2)"/>`));
  if (fx.coffee) {
    const cx = w * (0.78 - p[5].x / 12), cy = h * (0.82 - p[5].y / 14);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="58" fill="hsl(28,55%,45%)" opacity=".06"/><path d="M ${cx + 58} ${cy} A 58 58 0 1 1 ${cx + 10} ${cy - 57}" fill="none" stroke="hsl(28,55%,35%)" stroke-width="6" opacity=".28" filter="url(#b1)"/>`);
  }
  if (fx.shadow) parts.push(`<rect width="${w}" height="${h}" fill="url(#sh)"/>`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${parts.join('')}</svg>`)}`;
}

/** Layer the effects SVG on top of the paper's own background (works in html2canvas exports). */
export function effectsBackground(fx: PaperEffects | undefined, pageIndex: number, paper: React.CSSProperties): React.CSSProperties {
  if (!fx) return {};
  const any = fx.tint !== 'white' || fx.smudges || fx.folds || fx.eraser || fx.coffee || fx.shadow;
  if (!any) return {};
  const svg = `url("${buildEffectsSvg(fx, pageIndex)}")`;
  const base = paper.backgroundImage as string | undefined;
  return {
    backgroundImage: base ? `${svg}, ${base}` : svg,
    backgroundSize: base ? `100% 100%, ${paper.backgroundSize ?? 'auto'}` : '100% 100%',
    backgroundRepeat: base ? 'no-repeat, repeat' : 'no-repeat',
  };
}

export function PaperEffectsControls({ fx = DEFAULT_EFFECTS, pen = 'ballpoint', onChange }: {
  fx?: PaperEffects; pen?: PenType; onChange: (u: { paperEffects?: PaperEffects; penType?: PenType }) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pen type</p>
        <div className="grid grid-cols-5 gap-1.5">
          {PEN_OPTIONS.map(p => (
            <motion.button key={p.value} type="button" whileTap={{ scale: 0.9 }} onClick={() => { haptic('selection'); onChange({ penType: p.value }); }}
              className={cn('flex flex-col items-center py-2 rounded-xl border-2 text-[10px] font-medium transition', pen === p.value ? 'border-primary bg-primary/5' : 'border-border/50')}>
              <span className="text-lg">{p.emoji}</span>{p.label}
            </motion.button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Paper texture</p>
        <div className="grid grid-cols-4 gap-1.5">
          {TINTS.map(t => (
            <button key={t.value} type="button" onClick={() => { haptic('selection'); onChange({ paperEffects: { ...fx, tint: t.value } }); }}
              className={cn('py-2 rounded-xl border-2 text-[11px] font-medium', fx.tint === t.value ? 'border-primary' : 'border-border/50')}
              style={{ background: t.color === 'transparent' ? undefined : t.color }}>{t.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Realistic effects</p>
        <div className="grid grid-cols-2 gap-1.5">
          {EFFECT_TOGGLES.map(e => (
            <button key={e.key} type="button" onClick={() => { haptic('light'); onChange({ paperEffects: { ...fx, [e.key]: !fx[e.key] } }); }}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-medium text-left transition', fx[e.key] ? 'border-primary bg-primary/5' : 'border-border/50')}>
              <span>{e.emoji}</span>{e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
