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

export function PaperEffectsOverlay({ fx, pageIndex }: { fx?: PaperEffects; pageIndex: number }) {
  const r = useMemo(() => seeded(pageIndex + 1), [pageIndex]);
  const spots = useMemo(() => Array.from({ length: 6 }, () => ({ x: r() * 85 + 5, y: r() * 85 + 5, s: r() * 10 + 6, a: r() * 360 })), [r]);
  if (!fx) return null;
  const tint = TINTS.find(t => t.value === fx.tint)?.color;
  return (
    <div className="paper-fx absolute inset-0 pointer-events-none z-[1]" aria-hidden>
      {tint && tint !== 'transparent' && <div className="absolute inset-0 mix-blend-multiply" style={{ background: tint }} />}
      {fx.tint === 'recycled' && <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(hsl(30 10% 50% / .5) 0.6px, transparent 0.8px)', backgroundSize: '7px 9px' }} />}
      {fx.folds && (
        <>
          <div className="absolute left-0 right-0" style={{ top: '50%', height: 6, background: 'linear-gradient(to bottom, transparent, hsl(0 0% 0% / .07), hsl(0 0% 100% / .5), transparent)' }} />
          <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 5, background: 'linear-gradient(to right, transparent, hsl(0 0% 0% / .05), hsl(0 0% 100% / .4), transparent)' }} />
        </>
      )}
      {fx.smudges && spots.slice(0, 3).map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s * 3, height: p.s * 1.6, transform: `rotate(${p.a}deg)`, background: 'radial-gradient(ellipse, hsl(220 70% 35% / .18), transparent 70%)', filter: 'blur(2px)' }} />
      ))}
      {fx.eraser && spots.slice(3, 5).map((p, i) => (
        <div key={i} className="absolute rounded-[40%]" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s * 7, height: p.s * 2.4, transform: `rotate(${p.a / 8}deg)`, background: 'radial-gradient(ellipse, hsl(0 0% 60% / .12), transparent 70%)', filter: 'blur(3px)' }} />
      ))}
      {fx.coffee && (
        <div className="absolute rounded-full" style={{ right: `${8 + spots[5].x / 10}%`, bottom: `${6 + spots[5].y / 12}%`, width: 130, height: 130, border: '7px solid hsl(28 55% 35% / .22)', boxShadow: 'inset 0 0 18px hsl(28 55% 35% / .18)', filter: 'blur(1px)', clipPath: 'polygon(0 0,100% 0,100% 78%,62% 100%,0 100%)' }} />
      )}
      {fx.shadow && <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, transparent 55%, hsl(0 0% 0% / .10))' }} />}
    </div>
  );
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
