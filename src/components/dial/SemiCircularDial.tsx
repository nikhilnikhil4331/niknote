// ============================================================
// SemiCircularDial — the NikNote semi-circular rotating quick nav.
// Same interaction language as the Daily Tracker FAB (radialLayout
// fan anchored to a central action button), extracted into one
// reusable, theme-neutral component so the Home page and Money
// Tracker share the exact same behaviour instead of copies.
//
// - Smooth staggered spring fan-out (respects reduced motion)
// - Mouse, touch, keyboard (Esc, arrow keys) and screen readers
// - Active destination gets a soft glow + slight scale
// - Radius adapts to item count & viewport so bubbles never
//   leave the frame on small screens
// ============================================================

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { createActionGate, radialLayout } from '@/lib/navLayout';
import { haptic } from '@/hooks/useHaptics';

export interface DialItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional restrained accent for the icon (defaults to brand violet). */
  tint?: string;
  onSelect: () => void;
}

interface SemiCircularDialProps {
  items: DialItem[];
  /** ARIA label for the fan menu. */
  menuLabel?: string;
  /** Accessible label for the centre button. */
  centerLabel?: string;
  /** Arc span in degrees (120–180). Wider = flatter fan. */
  span?: number;
  /** Which side of the screen the dial hugs — biases the fan inward. */
  align?: 'left' | 'center' | 'right';
  className?: string;
}

/** Radius grows a little with item count, shrinks on narrow screens. */
function useDialRadius(count: number) {
  const measure = () => {
    const w = typeof window === 'undefined' ? 390 : window.innerWidth;
    const base = w < 360 ? 104 : w < 480 ? 118 : w < 768 ? 128 : 142;
    return base + Math.min(6, Math.max(0, count - 5)) * 6;
  };
  const [radius, setRadius] = useState(measure);
  useEffect(() => {
    const onResize = () => setRadius(measure());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  return radius;
}

const DIAL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.9 };

export const SemiCircularDial: React.FC<SemiCircularDialProps> = ({
  items,
  menuLabel = 'Quick navigation',
  centerLabel = 'Open quick navigation',
  span = 150,
  align = 'right',
  className = '',
}) => {
  const reduced = !!useReducedMotion();
  const radius = useDialRadius(items.length);
  const points = useMemo(() => radialLayout(items.length, radius, span), [items.length, radius, span]);

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const gate = useRef(createActionGate(320)).current;

  const toggle = useCallback(() => {
    haptic('selection');
    setOpen(v => !v);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => fabRef.current?.focus(), 0);
  }, []);

  // Focus the first action as soon as the fan mounts (keyboard users can act immediately).
  useLayoutEffect(() => {
    if (!open || !items.length) return;
    itemRefs.current[items[0].id]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes; arrow keys walk the fan.
  useEffect(() => {
    if (!open) return;
    const ids = items.map(i => i.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const current = ids.findIndex(id => itemRefs.current[id] === document.activeElement);
      let next = current;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = ids.length - 1;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1 + ids.length) % ids.length;
      else next = (current - 1 + ids.length) % ids.length;
      itemRefs.current[ids[next]]?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, close]);

  // A resize/orientation change invalidates the fan geometry — close it.
  useEffect(() => {
    if (!open) return;
    const closeOnResize = () => setOpen(false);
    window.addEventListener('resize', closeOnResize);
    window.addEventListener('orientationchange', closeOnResize);
    return () => {
      window.removeEventListener('resize', closeOnResize);
      window.removeEventListener('orientationchange', closeOnResize);
    };
  }, [open]);

  const pick = (item: DialItem) => {
    if (!gate(item.id)) return;
    haptic('light');
    setActiveId(item.id);
    close(false);
    window.setTimeout(() => item.onSelect(), reduced ? 0 : 130);
  };

  // Bias: 'right' aligned dials push the fan slightly left of the FAB centre
  // so the outermost bubble never clips the screen edge (and vice versa).
  const biasX = align === 'right' ? -14 : align === 'left' ? 14 : 0;

  return (
    <div className={`relative ${className}`} data-testid="semicircular-dial">
      {/* Scrim — dismiss on outside tap */}
      <AnimatePresence>
        {open && (
          <motion.button
            key="scrim"
            type="button"
            tabIndex={-1}
            aria-label={`Close ${menuLabel}`}
            className="fixed inset-0 z-[95] cursor-default bg-[color:var(--nk-scrim)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            onClick={() => close(true)}
          />
        )}
      </AnimatePresence>

      {/* Fan — anchored to the FAB centre, unmounted on close */}
      {open && (
        <div
          role="menu"
          aria-label={menuLabel}
          className="absolute bottom-[52px] left-1/2 z-[96] h-0 w-0"
          style={{ transform: `translateX(${biasX}px)` }}
        >
          {items.map((item, i) => {
            const p = points[i] ?? { x: 0, y: -radius, angle: 0 };
            const Icon = item.icon;
            const active = activeId === item.id;
            const tint = item.tint || '#7C5F9E';
            return (
              <motion.button
                key={item.id}
                ref={el => { itemRefs.current[item.id] = el; }}
                type="button"
                role="menuitem"
                aria-label={item.label}
                onClick={() => pick(item)}
                className="absolute grid h-12 w-12 place-items-center rounded-full border bg-surface/95 shadow-md backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  left: 0,
                  top: 0,
                  marginLeft: -24,
                  marginTop: -24,
                  color: tint,
                  borderColor: `color-mix(in srgb, ${tint} 25%, transparent)`,
                  boxShadow: active
                    ? `0 0 0 3px color-mix(in srgb, ${tint} 22%, transparent), 0 10px 24px -10px color-mix(in srgb, ${tint} 55%, transparent)`
                    : undefined,
                }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.35, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: active ? 1.1 : 1, x: p.x, y: p.y }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                transition={reduced ? { duration: 0.1 } : { ...DIAL_SPRING, delay: open ? 0.03 * i : 0 }}
                whileTap={reduced ? undefined : { scale: 0.9 }}
              >
                <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-full w-[72px] -translate-x-1/2 pt-1 text-center text-[10px] font-bold leading-tight tracking-tight text-fg-primary"
                  style={{ top: Math.abs(p.angle) < 14 ? 'calc(100% + 10px)' : 'calc(100% + 4px)' }}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Centre action */}
      <motion.button
        ref={fabRef}
        type="button"
        aria-label={centerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="relative z-[97] grid h-14 w-14 place-items-center rounded-full border-[3px] border-[color:hsl(var(--background-primary-hsl))] text-white shadow-[0_14px_30px_-10px_rgba(102,34,73,0.55)] transition-shadow hover:shadow-[0_16px_34px_-10px_rgba(163,64,84,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ background: 'linear-gradient(135deg, #44174E 0%, #A34054 55%, #ED9E59 100%)' }}
        whileTap={reduced ? undefined : { scale: 0.9 }}
        whileHover={reduced ? undefined : { scale: 1.05 }}
        transition={DIAL_SPRING}
        data-open={open || undefined}
      >
        <motion.span
          aria-hidden="true"
          animate={open ? { rotate: 45, scale: 0.92 } : { rotate: 0, scale: 1 }}
          transition={reduced ? { duration: 0 } : DIAL_SPRING}
          className="grid place-items-center"
        >
          <Plus size={24} strokeWidth={2.6} />
        </motion.span>
        <span className="sr-only">{menuLabel}</span>
      </motion.button>
    </div>
  );
};

export default SemiCircularDial;
