import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ease } from '@/lib/motion';

const STALL_MS = 12000;

/**
 * Branded loader shown only while the app is genuinely waiting (Suspense / auth).
 * The logo area is an interactive ink lens: drag on touch or move the pointer to magnify.
 * After a real stall it offers retry instead of loading forever.
 */
export function NiknoteLoader({ label = 'Loading your notes', fullScreen = true }: { label?: string; fullScreen?: boolean }) {
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [stalled, setStalled] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const t = window.setTimeout(() => setStalled(true), STALL_MS);
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.clearTimeout(t); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const move = (e: React.PointerEvent) => {
    if (reduced || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    setLens({ x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)) });
  };

  const message = offline ? 'You are offline — waiting for connection' : stalled ? 'This is taking longer than usual' : label;

  return (
    <div role="status" aria-live="polite" className={`nn-loader ${fullScreen ? 'nn-loader-full' : ''}`}>
      <div className="nn-loader-paper" aria-hidden="true" />
      <motion.div
        ref={stage}
        className="nn-loader-logo nn-lens-stage"
        aria-hidden="true"
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setLens(null)}
        onPointerUp={e => { if (e.pointerType !== 'mouse') setLens(null); }}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: ease.out }}
      >
        <motion.img
          src="/niknote-logo.png"
          alt=""
          draggable={false}
          initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.7, ease: ease.inOut }}
        />
        {lens && (
          <span
            className="nn-lens"
            style={{
              left: lens.x, top: lens.y,
              backgroundImage: 'url(/niknote-logo.png)',
              backgroundSize: `${(stage.current?.clientWidth ?? 200) * 2.2}px auto`,
              backgroundPosition: `${-lens.x * 2.2 + 45}px ${-lens.y * 2.2 + 45}px`,
            }}
          />
        )}
      </motion.div>
      {!reduced && !stalled && <div className="nn-loader-ink" aria-hidden="true"><span /></div>}
      <p className="nn-loader-label">{message}{!stalled && !offline && <span className="nn-loader-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>}</p>
      {(stalled || offline) && (
        <button type="button" className="nn-loader-retry" onClick={() => window.location.reload()}>Try again</button>
      )}
    </div>
  );
}
