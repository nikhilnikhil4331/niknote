// ============================================================
// SemiCircularDial — the NikNote semi-circular quick nav.
//
// Geometry is measured, never guessed: before the fan opens we read
// the centre button's real position, the viewport and the safe-area
// insets, then let `computeDialGeometry` pick an arc + radius that
// keeps every bubble fully on screen. If a circular fan physically
// cannot fit, the dial degrades to a compact grid instead of
// clipping actions off the edge.
//
// - Staggered spring fan-out (respects reduced motion)
// - Mouse, touch, keyboard (Esc, arrows, Home/End) and screen readers
// - Single active label so bubbles never overlap their captions
// - Live geometry re-measured on resize / orientation change
// ============================================================

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { computeDialGeometry, type DialAlign } from '@/lib/dialGeometry';
import { createActionGate } from '@/lib/navLayout';
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
  /** Which side of the screen the dial hugs — biases the fan inward. */
  align?: DialAlign;
  className?: string;
  /** Unused legacy prop kept for call-sites that still pass it. */
  span?: number;
}

const DIAL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.9 };

function readSafeInsets() {
  if (typeof window === 'undefined' || !document.body) return { top: 0, right: 0, bottom: 0, left: 0 };
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;inset:0;pointer-events:none;visibility:hidden;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

export const SemiCircularDial: React.FC<SemiCircularDialProps> = ({
  items,
  menuLabel = 'Quick navigation',
  centerLabel = 'Open quick navigation',
  align = 'right',
  className = '',
}) => {
  const reduced = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [measured, setMeasured] = useState(false);
  const [geometry, setGeometry] = useState(() =>
    computeDialGeometry({
      count: items.length,
      anchor: { x: 0, y: 0 },
      viewport: { width: 0, height: 0 },
      align,
    }),
  );

  const fabRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const gate = useRef(createActionGate(320)).current;

  const measure = useCallback(() => {
    if (typeof window === 'undefined') return;
    const rect = fabRef.current?.getBoundingClientRect();
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const anchor = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: viewport.width - 56, y: viewport.height - 120 };
    setGeometry(computeDialGeometry({
      count: items.length,
      anchor,
      viewport,
      align,
      padding: 10,
      safe: readSafeInsets(),
    }));
    setMeasured(true);
  }, [align, items.length]);

  // Measure synchronously before paint so the fan never flashes off-screen.
  useLayoutEffect(() => {
    if (!open) return;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resize / orientation changes invalidate the geometry (cheap, rAF throttled).
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [open, measure]);

  const toggle = useCallback(() => {
    haptic('selection');
    setOpen(v => !v);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setActiveId(null);
    setMeasured(false);
    if (restoreFocus) window.setTimeout(() => fabRef.current?.focus({ preventScroll: true }), 0);
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

  const pick = (item: DialItem) => {
    if (!gate(item.id)) return;
    haptic('light');
    setActiveId(item.id);
    close(false);
    window.setTimeout(() => item.onSelect(), reduced ? 0 : 120);
  };

  const compact = geometry.compact;
  const bubble = geometry.bubble;
  const activeItem = useMemo(() => items.find(i => i.id === activeId) ?? null, [items, activeId]);
  const activeIndex = useMemo(() => items.findIndex(i => i.id === activeId), [items, activeId]);

  return (
    <div className={`relative ${className}`} data-testid="semicircular-dial" data-compact={compact || undefined}>
      {/* Scrim — dismiss on outside tap */}
      <AnimatePresence>
        {open && (
          <motion.button
            key="scrim"
            type="button"
            tabIndex={-1}
            aria-label={`Close ${menuLabel}`}
            className="fixed inset-0 z-[95] cursor-default bg-black/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            onClick={() => close(true)}
          />
        )}
      </AnimatePresence>

      {/* Fan — anchored to the FAB centre, unmounted on close */}
      {open && measured && !compact && (
        <div
          role="menu"
          aria-label={menuLabel}
          className="absolute bottom-[52px] left-1/2 z-[96] h-0 w-0"
          style={{ transform: `translate(${geometry.offset.x}px, ${geometry.offset.y}px)` }}
          data-dial-radius={Math.round(geometry.radius)}
          data-dial-offset={JSON.stringify({ x: Math.round(geometry.offset.x), y: Math.round(geometry.offset.y) })}
          data-dial-points={JSON.stringify(geometry.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })))}
        >
          {items.map((item, i) => {
            const p = geometry.points[i] ?? { x: 0, y: -100, angle: 0 };
            const Icon = item.icon;
            const active = activeId === item.id;
            const tint = item.tint || '#7c3aed';
            return (
              <motion.button
                key={item.id}
                ref={el => { itemRefs.current[item.id] = el; }}
                type="button"
                role="menuitem"
                aria-label={item.label}
                title={item.label}
                onClick={() => pick(item)}
                onFocus={() => setActiveId(item.id)}
                onPointerEnter={() => setActiveId(item.id)}
                onPointerLeave={() => setActiveId(current => (current === item.id ? null : current))}
                className="absolute grid place-items-center rounded-full border bg-white/95 shadow-md backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                style={{
                  left: 0,
                  top: 0,
                  width: bubble,
                  height: bubble,
                  marginLeft: -bubble / 2,
                  marginTop: -bubble / 2,
                  color: tint,
                  borderColor: `color-mix(in srgb, ${tint} 25%, transparent)`,
                  boxShadow: active
                    ? `0 0 0 3px color-mix(in srgb, ${tint} 22%, transparent), 0 10px 24px -10px color-mix(in srgb, ${tint} 55%, transparent)`
                    : undefined,
                  willChange: 'transform',
                }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.35, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: active ? 1.08 : 1, x: p.x, y: p.y }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                transition={reduced ? { duration: 0.1 } : { ...DIAL_SPRING, delay: 0.028 * i }}
                whileTap={reduced ? undefined : { scale: 0.92 }}
              >
                <Icon size={bubble >= 48 ? 20 : 18} strokeWidth={2.2} aria-hidden="true" />
              </motion.button>
            );
          })}

          {/* One shared caption: no captions colliding with neighbouring bubbles. */}
          <AnimatePresence>
            {activeItem && activeIndex >= 0 && (() => {
              const point = geometry.points[activeIndex] ?? { x: 0, y: -bubble, angle: 0 };
              const placeRight = point.x > 0;
              return (
                <motion.span
                  key={activeItem.id}
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.14 }}
                  className="pointer-events-none absolute whitespace-nowrap rounded-full bg-zinc-900/90 px-2.5 py-1 text-[11px] font-semibold leading-none text-white shadow-lg"
                  style={{
                    left: point.x + (placeRight ? bubble * 0.85 : -bubble * 0.85),
                    top: point.y,
                    transform: placeRight ? 'translateY(-50%)' : 'translate(-100%, -50%)',
                  }}
                >
                  {activeItem.label}
                </motion.span>
              );
            })()}
          </AnimatePresence>
        </div>
      )}

      {/* Compact fallback — every action reachable when a fan cannot fit */}
      <AnimatePresence>
        {open && measured && compact && (
          <motion.div
            role="menu"
            aria-label={menuLabel}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[96] grid max-h-[60vh] grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-black/5 bg-white/95 p-2 shadow-2xl backdrop-blur-md"
            style={{
              right: `max(${geometry.bubble / 3}px, env(safe-area-inset-right, 0px) + 8px)`,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
            }}
          >
            {items.map(item => {
              const Icon = item.icon;
              const tint = item.tint || '#7c3aed';
              return (
                <button
                  key={item.id}
                  ref={el => { itemRefs.current[item.id] = el; }}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(item)}
                  className="flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <Icon size={16} strokeWidth={2.2} style={{ color: tint }} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centre action */}
      <motion.button
        ref={fabRef}
        type="button"
        aria-label={centerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="relative z-[97] grid h-14 w-14 place-items-center rounded-full border-[3px] border-white text-white shadow-[0_14px_30px_-10px_rgba(109,40,217,0.55)] transition-shadow hover:shadow-[0_16px_34px_-10px_rgba(109,40,217,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #ec4899 100%)' }}
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
