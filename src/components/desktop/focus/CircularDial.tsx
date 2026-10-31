// ============================================================
// NikNote — CircularDial (draggable watch-dial timer control)
//
// • Drag the ring to set the duration (mouse + touch, pointer
//   events with capture; touch-action:none so the page never
//   scrolls out from under your finger).
// • Wraparound-safe at 12 o’clock (unwrapDialAngle) — dragging
//   across the top clamps at max/min instead of jumping.
// • Full keyboard support: role=slider, arrows ±1 min (Shift
//   ±5), Home/End jump to min/max.
// • Geometry and selection are the SAME linear mapping
//   (0…120 min over 360°) as the running progress arc, so the
//   idle handle and the counting-down ring always agree.
// • All math lives in src/lib/dialMath.ts (unit tested).
// ============================================================

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  angleToMinutes, minutesToAngle, pointerAngleDeg, unwrapDialAngle, clampDialAngle,
  pointOnDial, clampDuration, DIAL_KEY_STEP, DIAL_KEY_STEP_LARGE,
  DIAL_GEOMETRY_RANGE, DIAL_SELECT_RANGE,
} from '@/lib/dialMath';
import { cn } from '@/lib/utils';

export interface CircularDialProps {
  /** Selected duration in minutes (controlled). */
  minutes: number;
  /** Live change while dragging / using keyboard. */
  onChangeMinutes: (minutes: number) => void;
  /** Fraction of the session remaining 0…1 while running/paused; omit when idle. */
  remainingFrac?: number;
  /** True while the countdown is actively running. */
  running?: boolean;
  /** Fully non-interactive (e.g. stopwatch display mode). */
  disabled?: boolean;
  /** Extra className for the wrapper. */
  className?: string;
  /** Diameter in px. */
  size?: number;
  /** Center overlay content (time readout etc.). */
  children?: React.ReactNode;
  /** aria-label for the slider. */
  label?: string;
}

const TICKS = 60;

export const CircularDial: React.FC<CircularDialProps> = ({
  minutes,
  onChangeMinutes,
  remainingFrac,
  running = false,
  disabled = false,
  className,
  size = 216,
  children,
  label = 'Timer duration',
}) => {
  const gradId = useId();
  const glowId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ pointerId: number; angle: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const adjustable = !disabled && !running && remainingFrac === undefined;

  // ---- geometry ----
  const C = 100; // viewBox centre
  const R = 78; // track radius
  const TRACK_W = 10;

  /** Angle the ring currently points at. */
  const arcAngle = useMemo(() => {
    if (remainingFrac !== undefined) return clampDialAngle(remainingFrac * 360);
    return minutesToAngle(minutes, DIAL_GEOMETRY_RANGE);
  }, [remainingFrac, minutes]);

  const arcLen = (arcAngle / 360) * 2 * Math.PI * R;

  const handlePos = pointOnDial(C, C, R, arcAngle);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, i) => {
        const major = i % 5 === 0;
        const outer = pointOnDial(C, C, R + TRACK_W / 2 + (major ? 9 : 7), i * (360 / TICKS));
        const inner = pointOnDial(C, C, R + TRACK_W / 2 + 2, i * (360 / TICKS));
        return { key: i, major, x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
      }),
    [],
  );

  // ---- pointer handling ----
  const pointFromEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // map client coords → viewBox coords
    const x = ((e.clientX - rect.left) / rect.width) * 200;
    const y = ((e.clientY - rect.top) / rect.height) * 200;
    return { x, y };
  }, []);

  const applyPointerAngle = useCallback(
    (rawAngle: number) => {
      const prev = dragState.current?.angle ?? minutesToAngle(minutes, DIAL_GEOMETRY_RANGE);
      const unwrapped = unwrapDialAngle(prev, rawAngle);
      const clamped = clampDialAngle(unwrapped);
      if (dragState.current) dragState.current.angle = clamped;
      const mins = clampDuration(angleToMinutes(clamped, DIAL_GEOMETRY_RANGE), DIAL_SELECT_RANGE);
      onChangeMinutes(mins);
    },
    [minutes, onChangeMinutes],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!adjustable) return;
      const pt = pointFromEvent(e);
      if (!pt) return;
      // Only start a drag from the ring band (not the center readout),
      // unless the press lands near the handle itself.
      const dist = Math.hypot(pt.x - C, pt.y - C);
      const nearHandle = Math.hypot(pt.x - handlePos.x, pt.y - handlePos.y) < 20;
      const onRing = dist > R - 20 && dist < R + 30;
      if (!onRing && !nearHandle) return;
      e.preventDefault();
      // Click-to-set: the press itself lands exactly on the clicked angle
      // (no unwrap — continuity only matters for the moves that follow).
      const raw = pointerAngleDeg(C, C, pt.x, pt.y);
      dragState.current = { pointerId: e.pointerId, angle: raw };
      setDragging(true);
      wrapRef.current?.setPointerCapture?.(e.pointerId);
      onChangeMinutes(clampDuration(angleToMinutes(raw, DIAL_GEOMETRY_RANGE), DIAL_SELECT_RANGE));
    },
    [adjustable, pointFromEvent, handlePos.x, handlePos.y, onChangeMinutes],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current || dragState.current.pointerId !== e.pointerId) return;
      const pt = pointFromEvent(e);
      if (!pt) return;
      applyPointerAngle(pointerAngleDeg(C, C, pt.x, pt.y));
    },
    [pointFromEvent, applyPointerAngle],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragState.current || dragState.current.pointerId !== e.pointerId) return;
    dragState.current = null;
    setDragging(false);
    try {
      wrapRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  // If the component is re-rendered into non-adjustable mode mid-drag, cancel.
  useEffect(() => {
    if (!adjustable && dragState.current) {
      dragState.current = null;
      setDragging(false);
    }
  }, [adjustable]);

  // ---- keyboard ----
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!adjustable) return;
      const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? DIAL_KEY_STEP_LARGE : DIAL_KEY_STEP;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
        case 'PageUp':
          next = clampDuration(minutes + step, DIAL_SELECT_RANGE);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
        case 'PageDown':
          next = clampDuration(minutes - step, DIAL_SELECT_RANGE);
          break;
        case 'Home':
          next = DIAL_SELECT_RANGE.min;
          break;
        case 'End':
          next = DIAL_SELECT_RANGE.max;
          break;
        default:
          return;
      }
      e.preventDefault();
      onChangeMinutes(next);
    },
    [adjustable, minutes, onChangeMinutes],
  );

  const pctText = remainingFrac !== undefined ? `${Math.round(remainingFrac * 100)}% remaining` : `${minutes} minutes selected`;

  return (
    <div
      ref={wrapRef}
      className={cn('nd-dial', dragging && 'nd-dragging', running && 'nd-dial-running', className)}
      style={{ width: size, height: size, cursor: adjustable ? 'grab' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <svg ref={svgRef} viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ED9E59" />
            <stop offset="38%" stopColor="#A34054" />
            <stop offset="68%" stopColor="#A34054" />
            <stop offset="100%" stopColor="#662249" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* minute/second tick marks */}
        {ticks.map((t) => (
          <line
            key={t.key}
            className={cn('nd-dial-tick', t.major && 'nd-tick-major')}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            opacity={hovered || dragging ? 1 : 0.65}
          />
        ))}

        {/* track */}
        <circle className="nd-dial-ring-track" cx={C} cy={C} r={R} fill="none" strokeWidth={TRACK_W} />

        {/* progress arc: starts at 12 o'clock, runs clockwise */}
        <g transform={`rotate(-90 ${C} ${C})`}>
          <circle
            className="nd-dial-progress-glow"
            cx={C} cy={C} r={R} fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={TRACK_W}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${2 * Math.PI * R}`}
            filter={running ? `url(#${glowId})` : undefined}
            style={{ transition: dragging ? 'none' : 'stroke-dasharray 180ms linear' }}
          />
        </g>

        {/* zero marker */}
        <circle cx={C} cy={C - R} r={2.2} fill="#b7a6d8" />

        {/* handle (idle) / position dot (running) */}
        {adjustable ? (
          <circle
            className="nd-dial-handle"
            cx={handlePos.x} cy={handlePos.y} r={dragging ? 11 : 9.5}
          />
        ) : (
          arcAngle > 0 && (
            <circle cx={handlePos.x} cy={handlePos.y} r={5.5} fill="#fff" stroke="#A34054" strokeWidth={2.4} />
          )
        )}
      </svg>

      {/* invisible native-focus slider control for AT + keyboard users */}
      <div
        role="slider"
        tabIndex={adjustable ? 0 : -1}
        aria-label={label}
        aria-valuemin={DIAL_SELECT_RANGE.min}
        aria-valuemax={DIAL_SELECT_RANGE.max}
        aria-valuenow={Math.round(minutes)}
        aria-valuetext={pctText}
        aria-disabled={!adjustable}
        onKeyDown={onKeyDown}
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', outline: 'none' }}
      />

      {/* center content overlays the dial */}
      <div
        style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default CircularDial;
