import React, { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Mascot as WobnimoMascot, type MascotState } from 'wobnimo';
import niknoteBuddy from '../../../mascots/niknote-buddy';
import { cn } from '@/lib/utils';

interface NikoBuddyProps {
  state?: MascotState;
  label: string;
  size?: number;
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
  onPoke?: () => void;
}

interface EngineBuddyProps {
  state: MascotState;
  compact: boolean;
  onReady: () => void;
  onFailure: () => void;
  onPoke?: () => void;
}

/** Direct engine mount keeps the twenty unrelated built-in characters out of
 * NikNote's bundle. Callback and state refs prevent needless WebGL rebuilds. */
const EngineBuddy: React.FC<EngineBuddyProps> = ({ state, compact, onReady, onFailure, onPoke }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WobnimoMascot | null>(null);
  const latest = useRef({ state, onReady, onFailure, onPoke });
  latest.current = { state, onReady, onFailure, onPoke };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    let engine: WobnimoMascot;
    try {
      engine = new WobnimoMascot(canvas, niknoteBuddy, {
        state: latest.current.state,
        interactive: !compact,
        effects: !compact,
        respectReducedMotion: true,
        maxPixelRatio: compact ? 1.25 : 1.5,
        framing: 1.04,
        floor: compact ? 0.25 : 0.45,
      });
    } catch {
      canvas.remove();
      latest.current.onFailure();
      return;
    }
    engineRef.current = engine;
    engine.canvas.style.cssText = 'display:block;width:100%;height:100%';
    const offPoke = engine.on('poke', () => latest.current.onPoke?.());
    const offReady = engine.on('ready', () => latest.current.onReady());
    return () => {
      offPoke();
      offReady();
      engine.dispose();
      engine.canvas.remove();
      engineRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    engineRef.current?.setState(state);
  }, [state]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
};

/**
 * Niko is a real Wobnimo character, not a looping video or a fake status.
 * The host supplies states from actual app events. WebGL2-less devices get a
 * quiet notebook fallback, while the accessible status remains available.
 */
export const NikoBuddy: React.FC<NikoBuddyProps> = ({
  state = 'idle',
  label,
  size = 144,
  className,
  compact = false,
  showLabel = true,
  onPoke,
}) => {
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Avoid jsdom and older browsers touching canvas APIs they do not implement.
    if (typeof window === 'undefined' || !('WebGL2RenderingContext' in window)) return;
    try {
      setSupported(Boolean(document.createElement('canvas').getContext('webgl2')));
    } catch {
      setSupported(false);
    }
  }, []);

  return (
    <div className={cn('nd-niko', compact && 'nd-niko-compact', className)}>
      <div
        className={cn('nd-niko-art', supported && 'nd-niko-live', ready && 'nd-niko-ready')}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {supported ? (
          <EngineBuddy
            state={state}
            compact={compact}
            onReady={() => setReady(true)}
            onFailure={() => { setReady(false); setSupported(false); }}
            onPoke={onPoke}
          />
        ) : (
          <span className="nd-niko-fallback">
            <NotebookPen size={Math.max(18, Math.round(size * 0.38))} strokeWidth={1.8} />
          </span>
        )}
      </div>
      <span
        className={showLabel ? 'nd-niko-label' : 'sr-only'}
        role="status"
        aria-live="polite"
      >
        {label}
      </span>
    </div>
  );
};

export default NikoBuddy;
