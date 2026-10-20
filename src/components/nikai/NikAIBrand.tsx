// ============================================================
// NikAI — Official Brand Identity System
// Renders the official calligraphic "N✦" ribbon emblem + "NikAI"
// wordmark (public/nikai-logo.png, nikai-mark.png, nikai-wordmark.png)
// cleanly across sidebars, hero screens, avatars, and loaders.
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';

export interface NikAIBrandProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  stacked?: boolean;
  subtitle?: string;
  badge?: string;
  animateStars?: boolean;
  className?: string;
}

const INLINE_MARK_HEIGHT: Record<NonNullable<NikAIBrandProps['size']>, number> = {
  sm: 24,
  md: 30,
  lg: 42,
  xl: 56,
  hero: 68,
};

const INLINE_WORD_HEIGHT: Record<NonNullable<NikAIBrandProps['size']>, number> = {
  sm: 17,
  md: 21,
  lg: 28,
  xl: 36,
  hero: 44,
};

const STACKED_LOGO_WIDTH: Record<NonNullable<NikAIBrandProps['size']>, number> = {
  sm: 72,
  md: 96,
  lg: 132,
  xl: 168,
  hero: 196,
};

/**
 * 3-Star Sparkling Constellation matching the official NikAI Astra palette
 */
export const NikAIStarConstellation: React.FC<{
  size?: number;
  animate?: boolean | 'fast' | 'idle';
  className?: string;
}> = ({ size = 28, animate = 'idle', className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  const isFast = animate === 'fast' || animate === true;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 select-none overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={`nikai-star-a-${uid}`} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B3DFF" />
          <stop offset="52%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#FF934F" />
        </linearGradient>
        <linearGradient id={`nikai-star-b-${uid}`} x1="12" y1="4" x2="44" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="60%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#FDBA74" />
        </linearGradient>
      </defs>

      <motion.path
        d="M20 7C20.5 15.2 22.8 17.5 31 18C22.8 18.5 20.5 20.8 20 29C19.5 20.8 17.2 18.5 9 18C17.2 17.5 19.5 15.2 20 7Z"
        fill={`url(#nikai-star-a-${uid})`}
        animate={
          animate
            ? {
                scale: isFast ? [0.92, 1.12, 0.92] : [0.97, 1.05, 0.97],
                opacity: [0.9, 1, 0.9],
              }
            : undefined
        }
        transition={{
          duration: isFast ? 1.0 : 2.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ transformOrigin: '20px 18px' }}
      />

      <motion.path
        d="M36 5C36.3 9.8 37.7 11.2 42.5 11.5C37.7 11.8 36.3 13.2 36 18C35.7 13.2 34.3 11.8 29.5 11.5C34.3 11.2 35.7 9.8 36 5Z"
        fill={`url(#nikai-star-b-${uid})`}
        animate={
          animate
            ? {
                scale: isFast ? [0.85, 1.18, 0.85] : [0.94, 1.08, 0.94],
                opacity: [0.8, 1, 0.8],
              }
            : undefined
        }
        transition={{
          duration: isFast ? 0.9 : 2.2,
          delay: 0.25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ transformOrigin: '36px 11.5px' }}
      />

      <motion.path
        d="M33 27C33.25 30.8 34.2 31.8 38 32C34.2 32.2 33.25 33.2 33 37C32.75 33.2 31.8 32.2 28 32C31.8 31.8 32.75 30.8 33 27Z"
        fill={`url(#nikai-star-b-${uid})`}
        animate={
          animate
            ? {
                scale: isFast ? [0.85, 1.16, 0.85] : [0.94, 1.08, 0.94],
                opacity: [0.75, 1, 0.75],
              }
            : undefined
        }
        transition={{
          duration: isFast ? 1.1 : 2.8,
          delay: 0.45,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ transformOrigin: '33px 32px' }}
      />
    </svg>
  );
};

/**
 * Compact NikAI mark image (calligraphic N ribbon + sparkle) —
 * drop-in logo for buttons, menus, chips & headers anywhere the app invokes NikAI.
 */
export const NikAIMark: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
  className = '',
}) => (
  <img
    src="/nikai-mark.png"
    alt=""
    aria-hidden="true"
    style={{ height: size, width: 'auto' }}
    className={`object-contain shrink-0 select-none pointer-events-none ${className}`}
  />
);

/**
 * Official NikAI Logo Component (supports both Horizontal Inline & Stacked Hero layouts)
 */
export const NikAIBrand: React.FC<NikAIBrandProps> = ({
  size = 'md',
  stacked = false,
  subtitle,
  badge,
  className = '',
}) => {
  if (stacked) {
    return (
      <div className={`inline-flex flex-col items-center select-none ${className}`}>
        <img
          src="/nikai-logo.png"
          alt="NikAI"
          style={{ width: STACKED_LOGO_WIDTH[size], height: 'auto' }}
          className="object-contain select-none pointer-events-none"
        />
        <span className="sr-only">NikAI</span>
        {badge && (
          <span className="mt-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-[#F4F1FC] text-[#5C4E8E] border border-[#E7E2F7]">
            {badge}
          </span>
        )}
        {subtitle && (
          <p className="text-xs font-medium text-[#6C6688] mt-1 tracking-tight text-center">
            {subtitle}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className="inline-flex items-center gap-2">
        <img
          src="/nikai-mark.png"
          alt=""
          aria-hidden="true"
          style={{ height: INLINE_MARK_HEIGHT[size], width: 'auto' }}
          className="object-contain shrink-0 select-none pointer-events-none"
        />
        <img
          src="/nikai-wordmark.png"
          alt="NikAI"
          style={{ height: INLINE_WORD_HEIGHT[size], width: 'auto' }}
          className="object-contain shrink-0 select-none pointer-events-none"
        />
        <span className="sr-only">NikAI</span>
        {badge && (
          <span className="ml-0.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-[#F4F1FC] text-[#5C4E8E] border border-[#E7E2F7]">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <span className="text-[11px] font-medium text-[#6C6688] -mt-0.5 tracking-tight">
          {subtitle}
        </span>
      )}
    </div>
  );
};

/**
 * Full-screen / inline animated NikAI loader
 */
export const NikAILoader: React.FC<{ label?: string }> = ({
  label = 'Awakening NikAI Neural Engine…',
}) => {
  return (
    <div
      role="status"
      aria-label="Loading NikAI"
      className="flex flex-col items-center justify-center gap-3.5 py-12 px-6 select-none"
    >
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
          className="w-24 h-24 rounded-full p-[2px]"
          style={{
            background:
              'conic-gradient(from 0deg, #8B3DFF, #EC4899, #FF934F, #C084FC, #8B3DFF)',
          }}
        >
          <div className="w-full h-full rounded-full bg-white" />
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/nikai-mark.png"
            alt=""
            aria-hidden="true"
            className="w-14 h-auto object-contain"
          />
        </div>
      </div>

      <NikAIBrand size="md" badge="ASTRA" />

      <div className="w-40 h-1.5 rounded-full overflow-hidden bg-purple-100">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
          className="w-full h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #8B3DFF, #EC4899, #FF934F)',
          }}
        />
      </div>

      <p className="text-xs font-semibold text-[#5E577C]">{label}</p>
    </div>
  );
};

export default NikAIBrand;
