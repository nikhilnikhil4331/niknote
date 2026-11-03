// NikNote signature motion: brand intro, floating doodles, task star, celebrate.
// All animations are CSS-driven (GPU-friendly transforms/opacity) and respect
// prefers-reduced-motion. No new dependencies: confetti reuses canvas-confetti.
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

const INTRO_KEY = 'nn-brand-intro-seen';

/** Logo reveal: disc → squiggle draw → star sparkle → wordmark settle. Skippable, once per session. */
export function BrandIntro() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(INTRO_KEY); } catch { return false; }
  });
  useEffect(() => {
    if (!show) return;
    const done = () => {
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
      setShow(false);
    };
    const t = setTimeout(done, 2100);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && done();
    window.addEventListener('keydown', key);
    return () => { clearTimeout(t); window.removeEventListener('keydown', key); };
  }, [show]);
  if (!show || reduced) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(var(--brand-cream))]"
      onClick={() => setShow(false)}
      role="presentation"
    >
      <button type="button" className="sr-only" onClick={() => setShow(false)}>Skip intro</button>
      <svg viewBox="0 0 480 128" className="w-[min(90vw,480px)]" aria-label="NikNote">
        <g className="nn-pop" style={{ transformOrigin: '64px 64px' }}>
          <circle cx="64" cy="64" r="60" fill="#FF858F" />
          <path d="M38 46 L84 40 L90 92 L44 98 Z" fill="#FFFDF5" stroke="#171313" strokeWidth="4" strokeLinejoin="round" />
        </g>
        <path
          d="M48 74 C52 62 56 62 58 70 C60 78 64 78 66 68 C68 58 72 58 74 66"
          fill="none" stroke="#347FF0" strokeWidth="7" strokeLinecap="round" className="nn-draw"
        />
        <circle cx="52" cy="86" r="4" fill="#171313" className="nn-pop" style={{ animationDelay: '500ms', transformOrigin: '52px 86px' }} />
        <rect x="60" y="83" width="15" height="5" rx="2.5" fill="#171313" className="nn-pop" style={{ animationDelay: '600ms', transformOrigin: '67px 85px' }} />
        <path
          d="M92 10 Q96 32 118 36 Q96 40 92 62 Q88 40 66 36 Q88 32 92 10 Z"
          fill="#FFE45C" stroke="#171313" strokeWidth="4" strokeLinejoin="round"
          className="nn-sparkle" style={{ animationDelay: '700ms', transformOrigin: '92px 36px' }}
        />
        <image href="/brand/wordmark.svg" x="148" y="20" width="331.4" height="88" className="nn-pop" style={{ animationDelay: '900ms', transformOrigin: '313px 64px' }} />
      </svg>
    </div>
  );
}

/** Slow-floating decorative doodles. Pure ambience: hidden from AT, never captures clicks. */
export function FloatingDoodles({ count = 6, className = '' }: { count?: number; className?: string }) {
  const reduced = useReducedMotion();
  const items = [
    { d: 'M12 1 Q14 10 23 12 Q14 14 12 23 Q10 14 1 12 Q10 10 12 1 Z', f: '#FFE45C', x: '6%', y: '12%', s: 26, r: 0 },
    { d: 'M12 1 Q14 10 23 12 Q14 14 12 23 Q10 14 1 12 Q10 10 12 1 Z', f: '#FF858F', x: '88%', y: '22%', s: 18, r: 2 },
    { d: '', f: '#347FF0', x: '12%', y: '72%', s: 12, r: 4 },
    { d: '', f: '#FFE45C', x: '80%', y: '78%', s: 16, r: 1 },
    { d: 'M12 1 Q14 10 23 12 Q14 14 12 23 Q10 14 1 12 Q10 10 12 1 Z', f: '#347FF0', x: '48%', y: '6%', s: 14, r: 3 },
    { d: '', f: '#FF858F', x: '60%', y: '88%', s: 10, r: 5 },
  ].slice(0, count);
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {items.map((it, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={it.s}
          height={it.s}
          className={reduced ? 'absolute opacity-70' : 'absolute nn-float opacity-70'}
          style={{ left: it.x, top: it.y, animationDelay: `${it.r * 0.7}s`, animationDuration: `${6 + it.r}s` }}
        >
          {it.d
            ? <path d={it.d} fill={it.f} />
            : <circle cx="12" cy="12" r="9" fill="none" stroke={it.f} strokeWidth="4" />}
        </svg>
      ))}
    </div>
  );
}

/** Small star that pops when a task is checked. Mount next to the checkbox with a key bump. */
export function TaskStar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <svg viewBox="0 0 24 24" className="nn-sparkle pointer-events-none absolute -right-2 -top-3 h-5 w-5" aria-hidden="true">
      <path d="M12 1 Q14 10 23 12 Q14 14 12 23 Q10 14 1 12 Q10 10 12 1 Z" fill="#FFE45C" stroke="#171313" strokeWidth="1.5" />
    </svg>
  );
}

/** Brand-coloured confetti for milestones. No-op under reduced motion. */
export function useCelebrate() {
  const reduced = useReducedMotion();
  return () => {
    if (reduced) return;
    confetti({
      particleCount: 60,
      spread: 70,
      colors: ['#FF858F', '#347FF0', '#FFE45C', '#171313'],
      disableForReducedMotion: true,
    });
  };
}
