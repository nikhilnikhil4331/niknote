// ============================================================
// usePointerMagnify — restrained cursor-aware magnification.
// Only fine pointers (mouse/trackpad) and only when the user has
// not requested reduced motion. Direct style mutations (no re-renders)
// keep it cheap; the CSS class does the eased scaling.
// Scope it to designated NikNote content areas (notes canvas,
// preview) — never the whole page.
// ============================================================

import { useCallback, useMemo, useRef } from 'react';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function usePointerMagnify() {
  const ref = useRef<HTMLDivElement | null>(null);

  const supported = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return (
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = clamp(((e.clientX - r.left) / r.width) * 100, 6, 94);
    const y = clamp(((e.clientY - r.top) / r.height) * 100, 8, 92);
    el.style.setProperty('--mag-x', `${x.toFixed(1)}%`);
    el.style.setProperty('--mag-y', `${y.toFixed(1)}%`);
  }, []);

  const onPointerEnter = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!supported || e.pointerType !== 'mouse') return;
    ref.current?.style.setProperty('--mag-scale', '1.03');
  }, [supported]);

  const onPointerLeave = useCallback(() => {
    ref.current?.style.setProperty('--mag-scale', '1');
  }, []);

  return {
    magnifyRef: ref,
    magnifyHandlers: supported
      ? { onPointerMove, onPointerEnter, onPointerLeave }
      : {},
    supported,
  };
}
