// ============================================================
// NikNote — Sunset Plum Design System (JS tokens)
// ------------------------------------------------------------
// CSS is the source of truth (see src/styles/theme.css). This module
// mirrors the same tokens for canvas/SVG/export code that needs raw
// values and cannot resolve CSS custom properties.
// ============================================================

export const palette = {
  midnight: '#1B1931',
  purple: '#44174E',
  burgundy: '#662249',
  rose: '#A34054',
  amber: '#ED9E59',
  blush: '#E9BCB9',
} as const;

export const niknoteColors = {
  palette,
  plum: {
    50: '#FDF7F5',
    100: '#F7E9E6',
    200: '#E9BCB9',
    300: '#D8A3A6',
    400: '#BF8590',
    500: '#A34054',
    600: '#8C3149',
    700: '#662249',
    800: '#44174E',
    900: '#2A1235',
    950: '#1B1931',
  },
  warm: {
    100: '#FBEAD7',
    200: '#F6D5B4',
    300: '#F2B987',
    400: '#ED9E59',
    500: '#D9822F',
    600: '#C4762F',
    700: '#9A5A14',
  },
  lilac: {
    100: '#F1E8F5',
    200: '#E0CDE8',
    300: '#C0A6DE',
    400: '#A688C9',
    500: '#7C5F9E',
    600: '#5C3A6E',
  },
  // Semantic values for canvas/export contexts (dark theme — the default).
  dark: {
    backgroundPrimary: '#121020',
    backgroundSecondary: '#17152A',
    backgroundTertiary: '#1B1931',
    surfacePrimary: '#1E1A32',
    surfaceElevated: '#262040',
    textPrimary: '#F7EEEC',
    textSecondary: '#D5C0C3',
    textMuted: '#A79BAE',
    borderSubtle: '#322B4A',
    accentPrimary: '#ED9E59',
    accentSecondary: '#C0A6DE',
    primary: '#A34054',
    success: '#6FCF97',
    warning: '#ED9E59',
    error: '#F08A8A',
  },
  light: {
    backgroundPrimary: '#FBF6F4',
    backgroundSecondary: '#F5EAE6',
    backgroundTertiary: '#EFE2DE',
    surfacePrimary: '#FFFDFC',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#241B2E',
    textSecondary: '#584862',
    textMuted: '#6B5A73',
    borderSubtle: '#EADDD9',
    accentPrimary: '#8C3149',
    accentSecondary: '#5C3A6E',
    primary: '#A34054',
    success: '#157F52',
    warning: '#A65E12',
    error: '#A62B36',
  },
  gradients: {
    primary: 'linear-gradient(180deg, #ED9E59 0%, #A34054 40%, #662249 72%, #44174E 100%)',
    secondary: 'linear-gradient(135deg, #1B1931 0%, #44174E 45%, #662249 100%)',
    accent: 'linear-gradient(135deg, #A34054 0%, #ED9E59 100%)',
    soft: 'linear-gradient(135deg, #E9BCB9 0%, #ED9E59 100%)',
  },
} as const;

/** Chart series — coordinated, readable on both themes. */
export const chartPalette = ['#A34054', '#ED9E59', '#E9BCB9', '#662249', '#44174E', '#C0A6DE', '#6FCF97'] as const;

export const niknoteSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
} as const;

export const niknoteRadii = {
  xs: '6px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '24px',
  '2xl': '30px',
  full: '9999px',
} as const;

export const niknoteShadows = {
  xs: '0 1px 2px rgba(36, 27, 46, 0.05)',
  sm: '0 2px 8px -2px rgba(68, 23, 78, 0.1), 0 1px 2px rgba(36, 27, 46, 0.04)',
  md: '0 10px 26px -14px rgba(68, 23, 78, 0.25), 0 2px 6px -2px rgba(36, 27, 46, 0.06)',
  lg: '0 24px 60px -28px rgba(68, 23, 78, 0.32), 0 6px 18px -10px rgba(36, 27, 46, 0.08)',
  focus: '0 0 0 3px rgba(163, 64, 84, 0.35)',
} as const;

export const niknoteTypography = {
  fontFamily: {
    sans: "'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    handwriting: "'Caveat', 'Kalam', 'Indie Flower', cursive",
  },
  fontSize: {
    xs: '11px',
    sm: '12.5px',
    base: '14px',
    md: '15px',
    lg: '17px',
    xl: '21px',
    '2xl': '26px',
    '3xl': '32px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.4,
    normal: 1.6,
  },
  tracking: {
    tight: '-0.015em',
  },
} as const;

export const niknoteMotion = {
  duration: { fast: 0.18, base: 0.22, slow: 0.32, slower: 0.4 },
  easing: {
    out: [0.22, 1, 0.36, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
    spring: [0.34, 1.56, 0.64, 1] as const,
  },
  spring: {
    gentle: { type: 'spring', stiffness: 120, damping: 14, mass: 1 } as const,
    snappy: { type: 'spring', stiffness: 300, damping: 25, mass: 0.8 } as const,
    smooth: { type: 'spring', stiffness: 200, damping: 20, mass: 1 } as const,
  },
  transitions: {
    fast: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const,
    normal: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const,
    slow: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } as const,
  },
  variants: {
    fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
    slideUp: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 10 },
    },
    slideInRight: {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 20 },
    },
    scaleIn: {
      initial: { opacity: 0, scale: 0.97 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.97 },
    },
    staggerContainer: { animate: { transition: { staggerChildren: 0.05 } } },
  },
  interaction: {
    whileHover: { scale: 1.015, transition: { duration: 0.18 } },
    whileTap: { scale: 0.985, transition: { duration: 0.12 } },
    whileHoverLift: { y: -2, transition: { duration: 0.18 } },
  },
} as const;

/** Restrained glass — reserved for overlays and hero widgets. */
export const niknoteGlass = {
  light: {
    background: 'rgba(255, 253, 252, 0.72)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(233, 188, 185, 0.5)',
    boxShadow: '0 10px 26px -14px rgba(68, 23, 78, 0.25)',
  },
  dark: {
    background: 'rgba(30, 26, 50, 0.72)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(233, 188, 185, 0.14)',
    boxShadow: '0 24px 60px -28px rgba(0, 0, 0, 0.75)',
  },
} as const;

export const sidebarTokens = {
  width: '264px',
  widthCollapsed: '72px',
  itemHeight: '34px',
  sectionTitleHeight: '28px',
  padding: '12px',
  itemPadding: '8px 10px',
  indentPerLevel: 16,
} as const;

/** Premium interface surface tokens (dark defaults). */
export const premiumTokens = {
  gradient: niknoteColors.gradients.accent,
  border: 'rgba(237, 158, 89, 0.35)',
  glow: '0 10px 30px -12px rgba(237, 158, 89, 0.45)',
} as const;
