// ============================================================
// PageStage — the page-level motion layer for NikNote.
//
// Two deliberately different transitions:
//   • turn()   — moving between paper pages: the sheet lifts, turns
//                slightly through perspective and the next sheet
//                settles in from the opposite edge.
//   • unfold() — a freshly created page: it opens out from the top
//                edge like a folded sheet being opened flat.
//
// Editing is never remounted by this component — it only animates a
// compositor-only transform layer around whatever the editor renders,
// and navigation commits at the midpoint of the outgoing motion so the
// page never flickers between old and new content.
// ============================================================

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';

export type PageTurnDirection = 'next' | 'prev';

export interface PageStageHandle {
  /** Animate the current sheet out, commit the page change, then settle in. */
  turn: (direction: PageTurnDirection, commit: () => void) => Promise<void>;
  /** Commit a brand new page, then unfold it into place. */
  unfold: (commit: () => void) => Promise<void>;
  isBusy: () => boolean;
}

export interface PageStageProps {
  children: React.ReactNode;
  className?: string;
  /** Handle horizontal swipe gestures on the sheet. */
  swipe?: boolean;
  /** Left/Right + PageUp/PageDown page navigation when nothing is being edited. */
  keyboard?: boolean;
  /** Called when a swipe/keyboard gesture asks for another page. */
  onTurn: (direction: PageTurnDirection) => void;
  /** Gentle unfold when a document is first opened. */
  enter?: boolean;
  /** Disable transitions (e.g. while exporting). */
  disabled?: boolean;
  ariaLabel?: string;
}

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function isLowPowerDevice() {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const slow = typeof window !== 'undefined' && window.matchMedia?.('(update: slow)').matches;
  return !!slow || cores <= 4 || memory <= 2;
}

function isEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return !!el.closest('textarea, input, select, [contenteditable="true"], [data-no-swipe]');
}

export const PageStage = forwardRef<PageStageHandle, PageStageProps>(({
  children,
  className = '',
  swipe = true,
  keyboard = true,
  onTurn,
  enter = false,
  disabled = false,
  ariaLabel = 'Note page',
}, ref) => {
  const reduced = !!useReducedMotion();
  const controls = useAnimationControls();
  const busy = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const entered = useRef(false);
  const lite = useRef(isLowPowerDevice());

  // Live swipe feedback without a React render per frame.
  const dragX = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 520, damping: 42, mass: 0.7 });
  const gesture = useRef<{ x: number; y: number; active: boolean; horizontal: boolean; lastX: number; lastT: number; velocity: number; pointerType: string } | null>(null);

  const settle = useCallback(() => {
    dragX.set(0);
  }, [dragX]);

  const turn = useCallback((direction: PageTurnDirection, commit: () => void): Promise<void> => {
    const run = async () => {
      if (busy.current) { commit(); return; }
      busy.current = true;
      try {
        settle();
        if (disabled || reduced) { commit(); return; }
        const dir = direction === 'next' ? -1 : 1;
        if (lite.current) {
          await controls.start({ opacity: 0.35, x: dir * 16, transition: { duration: 0.12, ease: 'easeIn' } });
          commit();
          await nextFrame();
          controls.set({ opacity: 0.5, x: -dir * 12 });
          await controls.start({ opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } });
          return;
        }
        await controls.start({
          rotateY: dir * 23,
          x: dir * 26,
          z: -26,
          opacity: 0.42,
          boxShadow: dir < 0
            ? '18px 22px 44px -18px rgba(23, 18, 44, 0.35)'
            : '-18px 22px 44px -18px rgba(23, 18, 44, 0.35)',
          transition: { duration: 0.17, ease: [0.42, 0, 0.9, 0.62] },
        });
        commit();
        await nextFrame();
        await nextFrame();
        controls.set({ rotateY: -dir * 15, x: -dir * 16, z: -14, opacity: 0.55, boxShadow: '0 12px 30px -18px rgba(23, 18, 44, 0.3)' });
        await controls.start({
          rotateY: 0,
          x: 0,
          z: 0,
          opacity: 1,
          boxShadow: '0 0 0 rgba(0,0,0,0)',
          transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
        });
      } finally {
        busy.current = false;
      }
    };
    // Never let two transitions fight: queue instead of dropping the tap.
    queue.current = queue.current.then(run).catch(() => {});
    return queue.current;
  }, [controls, disabled, reduced, settle]);

  const unfold = useCallback((commit: () => void): Promise<void> => {
    const run = async () => {
      if (busy.current) { commit(); return; }
      busy.current = true;
      try {
        settle();
        commit();
        if (disabled || reduced) return;
        await nextFrame();
        if (lite.current) {
          controls.set({ opacity: 0.4, scale: 0.985 });
          await controls.start({ opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } });
          return;
        }
        controls.set({
          rotateX: -58,
          y: 4,
          scaleY: 0.72,
          opacity: 0.2,
          transformOrigin: 'top center',
          transformPerspective: 1500,
        });
        await nextFrame();
        await controls.start({
          rotateX: 0,
          y: 0,
          scaleY: 1,
          opacity: 1,
          transition: { duration: 0.52, ease: [0.16, 1, 0.3, 1] },
        });
      } finally {
        busy.current = false;
      }
    };
    queue.current = queue.current.then(run).catch(() => {});
    return queue.current;
  }, [controls, disabled, reduced, settle]);

  useImperativeHandle(ref, () => ({
    turn,
    unfold,
    isBusy: () => busy.current,
  }), [turn, unfold]);

  // Opening a document: settle the sheet into place once.
  useEffect(() => {
    if (!enter || entered.current || disabled) return;
    entered.current = true;
    if (reduced) return;
    controls.set({ opacity: 0.6, scale: lite.current ? 1 : 0.985, y: 6 });
    void controls.start({ opacity: 1, scale: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] } });
  }, [enter, controls, reduced, disabled]);

  // ---- gestures ---------------------------------------------------
  const startGesture = (e: React.PointerEvent) => {
    if (!swipe || disabled || busy.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isEditingTarget(e.target)) return;
    if (typeof window !== 'undefined' && window.getSelection?.()?.toString()) return;
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      active: true,
      horizontal: false,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      pointerType: e.pointerType || 'mouse',
    };
  };

  const moveGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g?.active) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.horizontal) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.25) {
        if (Math.abs(dy) > 24) g.active = false; // clearly a vertical scroll
        return;
      }
      g.horizontal = true;
    }
    const now = performance.now();
    g.velocity = (e.clientX - g.lastX) / Math.max(1, now - g.lastT);
    g.lastX = e.clientX;
    g.lastT = now;
    if (!reduced) dragX.set(Math.max(-120, Math.min(120, dx * 0.5)));
  };

  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const offset = dragX.get();
    settle();
    if (!g.horizontal) return;
    // Never steal a text selection: if the gesture selected words, leave the page.
    if (typeof window !== 'undefined' && window.getSelection?.()?.toString().trim()) return;
    const threshold = g.pointerType === 'mouse' ? 110 : 58;
    const flick = Math.abs(g.velocity) > 0.55 && Math.abs(offset) > 26;
    if (Math.abs(offset) > threshold || flick) {
      onTurn(offset < 0 ? 'next' : 'prev');
    }
  };

  // Trackpad: horizontal wheel only, never hijack vertical scrolling.
  const wheelAcc = useRef(0);
  const wheelTimer = useRef<number | null>(null);
  const onWheel = (e: React.WheelEvent) => {
    if (!swipe || disabled) return;
    if (Math.abs(e.deltaX) < 2 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.15) return;
    wheelAcc.current += e.deltaX;
    if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => { wheelAcc.current = 0; }, 240);
    if (Math.abs(wheelAcc.current) > 90) {
      const dir: PageTurnDirection = wheelAcc.current > 0 ? 'next' : 'prev';
      wheelAcc.current = 0;
      onTurn(dir);
    }
  };

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (disabled || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditingTarget(e.target)) return;
      if (typeof window !== 'undefined' && window.getSelection?.()?.toString()) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { onTurn('next'); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { onTurn('prev'); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, disabled, onTurn]);

  return (
    <div
      className={`nn-page-stage ${className}`}
      style={{ perspective: lite.current ? undefined : 1600, perspectiveOrigin: '50% 36%' }}
      aria-label={ariaLabel}
      onPointerDown={startGesture}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onWheel={onWheel}
    >
      <motion.div
        animate={controls}
        initial={false}
        style={{
          transformStyle: lite.current ? undefined : 'preserve-3d',
          transformOrigin: '50% 34%',
          willChange: 'transform, opacity',
        }}
        className="nn-page-sheet"
        data-page-sheet="true"
      >
        <motion.div style={{ x: springX }}>{children}</motion.div>
      </motion.div>
    </div>
  );
});

PageStage.displayName = 'PageStage';

export default PageStage;
