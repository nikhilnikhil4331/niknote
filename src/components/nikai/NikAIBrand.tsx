import React from 'react';
import { motion } from 'framer-motion';

/**
 * NikAI brand — the official NikAI logo artwork is the ONLY brand mark used
 * wherever AI is shown in NikNote:
 *   /nikai/nikai-mark.png      → signature "M" brushmark + sparkle (AI mark)
 *   /nikai/nikai-star.png      → sparkle alone (decorative accents)
 *   /nikai/nikai-wordmark.png  → "NikAI" wordmark (violet → magenta → coral)
 *   /nikai/nikai-logo.png      → full stacked lockup
 */

export const NIKAI_MARK_SRC = '/nikai/nikai-mark.png';
const STAR_SRC = '/nikai/nikai-star.png';
const WORDMARK_SRC = '/nikai/nikai-wordmark.png';
/** Aspect ratio of the official mark (w / h). */
export const NIKAI_MARK_RATIO = 1.98;

interface NikAIBrandProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showTagline?: boolean;
  subtitle?: string;
  className?: string;
  /** Hide the small ASTRA capsule (used where space is tight). */
  showBadge?: boolean;
}

const SIZE_MAP = {
  sm: { mark: 22, word: 50, badge: 'text-[9px] px-2 py-[3px]', gap: 'gap-1.5' },
  md: { mark: 27, word: 60, badge: 'text-[9.5px] px-2.5 py-[3px]', gap: 'gap-2' },
  lg: { mark: 33, word: 76, badge: 'text-[10px] px-2.5 py-1', gap: 'gap-2.5' },
  xl: { mark: 42, word: 96, badge: 'text-[10.5px] px-3 py-1', gap: 'gap-3' },
  hero: { mark: 50, word: 115, badge: 'text-[11px] px-3 py-1', gap: 'gap-3' },
};

/**
 * The official NikAI mark — the signature brush "M" with its sparkle.
 * Used everywhere AI is surfaced (nav, buttons, AI panels, AI answers…).
 */
export const NikAILogoMark: React.FC<{
  size?: number;
  className?: string;
  animate?: boolean | 'fast' | 'idle';
  /** Renders the mark inside a soft rounded tile (used for icon slots). */
  tile?: boolean;
  alt?: string;
}> = ({ size = 36, className = '', animate = false, tile = false, alt = 'NikAI' }) => {
  const mark = (
    <motion.img
      key="nikai-mark"
      src={NIKAI_MARK_SRC}
      alt={alt}
      draggable={false}
      className="w-auto select-none"
      style={{ height: tile ? size * 0.66 : size }}
      animate={animate ? { scale: [1, 1.045, 1] } : undefined}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  );

  if (!tile) {
    return <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>{mark}</span>;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] border border-[#F1E9FE] bg-gradient-to-br from-white via-[#FBF7FF] to-[#FDF2FB] shadow-[0_2px_10px_-4px_rgba(124,58,237,0.35)] ${className}`}
      style={{ width: size, height: size }}
    >
      {mark}
    </span>
  );
};

/**
 * Lucide-compatible wrapper so the AI mark can be dropped into any icon slot
 * (`<Icon className="w-4 h-4" />`). No AI surface should fall back to a
 * generic glyph.
 */
export const NikAIMarkIcon: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({
  className = 'w-4 h-4',
  alt = 'NikAI',
  ...rest
}) => (
  <img
    src={NIKAI_MARK_SRC}
    alt={alt}
    draggable={false}
    className={`select-none object-contain ${className}`}
    {...rest}
  />
);

/** Kept for backwards compatibility across the app. */
export const NikAIStarConstellation: React.FC<{
  size?: number;
  animate?: boolean | 'fast' | 'idle';
  className?: string;
}> = ({ size = 32, animate = true, className = '' }) => (
  <NikAILogoMark size={size} animate={animate} className={className} />
);

/** Single spark (used in dense chips / avatars). */
export const NikAIStar: React.FC<{ size?: number; className?: string }> = ({
  size = 14,
  className = '',
}) => (
  <img
    src={STAR_SRC}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`shrink-0 select-none ${className}`}
    style={{ height: size, width: size }}
  />
);

export const NikAIBrand: React.FC<NikAIBrandProps> = ({
  size = 'md',
  showTagline = false,
  subtitle,
  className = '',
  showBadge = true,
}) => {
  const cfg = SIZE_MAP[size] || SIZE_MAP.lg;

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className={`inline-flex items-center ${cfg.gap}`}>
        <NikAILogoMark size={cfg.mark} />
        <img
          src={WORDMARK_SRC}
          alt="NikAI"
          draggable={false}
          className="w-auto select-none"
          style={{ width: cfg.word }}
        />
        <span className="sr-only">NikAI</span>
        {showBadge && (
          <span
            className={`${cfg.badge} rounded-full border border-[#E6DCFB] bg-white/70 font-extrabold uppercase tracking-[0.16em] text-[#7C3AED] select-none`}
          >
            Astra
          </span>
        )}
      </div>
      {(showTagline || subtitle) && (
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {subtitle || 'Powered by Astra Neural Core · Memory + Smart Notes Engine'}
        </p>
      )}
    </div>
  );
};

/** Gradient defs used to tint line icons with the brand gradient. */
export const NikAIIconGradients: React.FC = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
    <defs>
      <linearGradient id="nikai-grad-violet" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="55%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
      <linearGradient id="nikai-grad-pink" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="60%" stopColor="#DB2777" />
        <stop offset="100%" stopColor="#FB7185" />
      </linearGradient>
      <linearGradient id="nikai-grad-blue" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Signature full-screen / embedded NikAI boot loader matching the pastel brand aesthetic.
 */
export const NikAILoader: React.FC<{ fullScreen?: boolean; message?: string; label?: string }> = ({
  fullScreen = true,
  message = 'Awakening NikAI Astra Core…',
  label,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative flex flex-col items-center justify-center overflow-hidden px-6 text-center ${
        fullScreen ? 'min-h-[100dvh] w-full' : 'py-16 w-full'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.12), transparent 55%), radial-gradient(ellipse at 82% 75%, rgba(236,72,153,0.10), transparent 55%), #FBF9FE',
      }}
    >
      <div className="relative flex items-center justify-center mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="h-24 w-24 rounded-full p-[2px]"
          style={{
            background: 'conic-gradient(from 0deg, #8B5CF6, #DB2777, #FB923C, transparent 72%, #8B5CF6)',
          }}
        >
          <div className="h-full w-full rounded-full bg-[#FBF9FE]/95 backdrop-blur-md" />
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <NikAILogoMark size={54} animate />
        </div>
      </div>

      <NikAIBrand size="lg" showBadge={false} />

      <div className="mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-[#EFE9FA]">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
          className="h-full w-1/2 rounded-full"
          style={{ background: 'linear-gradient(90deg, #8B5CF6, #DB2777, #FB923C)' }}
        />
      </div>

      <p className="mt-3 text-xs font-medium tracking-wide text-[#8B8AA0]">{label || message}</p>
    </div>
  );
};
