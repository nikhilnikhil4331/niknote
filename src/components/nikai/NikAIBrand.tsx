import React from 'react';
import { motion } from 'framer-motion';

interface NikAIBrandProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showTagline?: boolean;
  subtitle?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: { starBox: 24, fontSize: 'text-[23px]', badge: 'text-[9px] px-1.5 py-0.5', gap: 'gap-1.5' },
  md: { starBox: 30, fontSize: 'text-[28px]', badge: 'text-[9.5px] px-2 py-0.5', gap: 'gap-2' },
  lg: { starBox: 40, fontSize: 'text-[38px]', badge: 'text-[10px] px-2.5 py-0.5', gap: 'gap-2.5' },
  hero: { starBox: 56, fontSize: 'text-[52px] sm:text-[62px]', badge: 'text-[11px] px-3 py-1', gap: 'gap-3' },
};

/**
 * Authentic NikAI Brand Mark — crafted directly in the visual DNA of /niknote-logo.png:
 * - Signature 3-star golden-amber-to-coral constellation mark on the left
 * - Flowing handwritten script wordmark ("Dancing Script" / "Caveat") in royal violet -> magenta -> coral ink
 */
export const NikAIStarConstellation: React.FC<{ size?: number; animate?: boolean; className?: string }> = ({
  size = 32,
  animate = true,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 select-none overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={`nikai-star-main-${uid}`} x1="18" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="48%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#F45B69" />
        </linearGradient>
        <linearGradient id={`nikai-star-coral-${uid}`} x1="4" y1="32" x2="26" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <filter id={`nikai-glow-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#EC4899" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Main Primary 4-Point Rounded Star */}
      <motion.path
        d="M40 8C41.4 8 42.3 15.8 45.4 18.9C48.5 22 56.2 22.9 56.2 24.3C56.2 25.7 48.5 26.6 45.4 29.7C42.3 32.8 41.4 40.6 40 40.6C38.6 40.6 37.7 32.8 34.6 29.7C31.5 26.6 23.8 25.7 23.8 24.3C23.8 22.9 31.5 22 34.6 18.9C37.7 15.8 38.6 8 40 8Z"
        fill={`url(#nikai-star-main-${uid})`}
        filter={`url(#nikai-glow-${uid})`}
        animate={
          animate
            ? {
                scale: [1, 1.08, 1],
                rotate: [0, 4, 0],
              }
            : undefined
        }
        style={{ transformOrigin: '40px 24.3px' }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Upper-Left Golden Spark Star */}
      <motion.path
        d="M17 9C17.8 9 18.3 13.4 20.1 15.2C21.9 17 26.2 17.5 26.2 18.3C26.2 19.1 21.9 19.6 20.1 21.4C18.3 23.2 17.8 27.6 17 27.6C16.2 27.6 15.7 23.2 13.9 21.4C12.1 19.6 7.8 19.1 7.8 18.3C7.8 17.5 12.1 17 13.9 15.2C15.7 13.4 16.2 9 17 9Z"
        fill="#F59E0B"
        animate={
          animate
            ? {
                scale: [1, 1.18, 1],
                opacity: [0.85, 1, 0.85],
              }
            : undefined
        }
        style={{ transformOrigin: '17px 18.3px' }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />

      {/* Lower-Left Warm Coral Star */}
      <motion.path
        d="M18 34C18.9 34 19.5 39.2 21.6 41.3C23.7 43.4 28.8 44 28.8 44.9C28.8 45.8 23.7 46.4 21.6 48.5C19.5 50.6 18.9 55.8 18 55.8C17.1 55.8 16.5 50.6 14.4 48.5C12.3 46.4 7.2 45.8 7.2 44.9C7.2 44 12.3 43.4 14.4 41.3C16.5 39.2 17.1 34 18 34Z"
        fill={`url(#nikai-star-coral-${uid})`}
        animate={
          animate
            ? {
                scale: [1, 1.14, 1],
                rotate: [0, -6, 0],
              }
            : undefined
        }
        style={{ transformOrigin: '18px 44.9px' }}
        transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />
    </svg>
  );
};

export const NikAIBrand: React.FC<NikAIBrandProps> = ({
  size = 'md',
  showTagline = false,
  subtitle,
  className = '',
}) => {
  const cfg = SIZE_MAP[size];

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className={`inline-flex items-center ${cfg.gap}`}>
        <NikAIStarConstellation size={cfg.starBox} />
        <span
          style={{
            fontFamily: "'Dancing Script', 'Caveat', cursive",
            fontWeight: 700,
            backgroundImage:
              'linear-gradient(96deg, #5B1BC9 0%, #8B1EE0 28%, #DB2777 63%, #F46B55 88%, #F59E0B 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1.05,
            paddingRight: '3px',
          }}
          className={`${cfg.fontSize} tracking-tight select-none drop-shadow-[0_2px_10px_rgba(192,38,211,0.16)]`}
        >
          NikAI
        </span>
        <span
          className={`${cfg.badge} rounded-full border border-fuchsia-500/30 bg-gradient-to-r from-violet-600/12 via-pink-500/12 to-amber-500/15 font-extrabold uppercase tracking-widest text-violet-700 dark:text-violet-300 select-none`}
        >
          Astra
        </span>
      </div>
      {(showTagline || subtitle) && (
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {subtitle || 'Powered by Astra Neural Core · Memory + Smart Notes Engine'}
        </p>
      )}
    </div>
  );
};

/**
 * Signature full-screen / embedded NikAI boot loader matching NikNote's royal gradient & paper aesthetic.
 */
export const NikAILoader: React.FC<{ fullScreen?: boolean; message?: string }> = ({
  fullScreen = true,
  message = 'Awakening NikAI Astra Core…',
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
          'radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.15), transparent 55%), radial-gradient(ellipse at 82% 75%, rgba(236,72,153,0.14), transparent 55%), var(--background, #faf8ff)',
      }}
    >
      {/* Orbiting Neural Ring */}
      <div className="relative flex items-center justify-center mb-5">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="h-28 w-28 rounded-full p-[2px]"
          style={{
            background:
              'conic-gradient(from 0deg, #6D28D9, #DB2777, #F59E0B, transparent 72%, #6D28D9)',
          }}
        >
          <div className="h-full w-full rounded-full bg-background/95 backdrop-blur-md" />
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <NikAIStarConstellation size={52} />
        </div>
      </div>

      <NikAIBrand size="lg" />

      {/* Liquid Ink Progress Ribbon */}
      <div className="mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-violet-500/15">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
          className="h-full w-1/2 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #6D28D9, #DB2777, #F59E0B)',
          }}
        />
      </div>

      <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground">{message}</p>
    </div>
  );
};
