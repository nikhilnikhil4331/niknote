// ============================================================
// NikNote 4.0 — Design System
// Premium, colorful, modern — inspired by Notion + Apple + Linear
// Every color, spacing, animation, and typography token
// ============================================================

export const niknoteColors = {
  // Blue-led NikNote colors; the accessible action shade is used for smaller text and controls.
  primary: {
    50: '#f4f8ff',
    100: '#eaf2ff',
    200: '#dceaff',
    300: '#b9d2f6',
    400: '#6ea1ef',
    500: '#347ff0',
    600: '#2869d5',
    700: '#245dcc',
    800: '#173a71',
    900: '#10294e',
  },
  // Accent — NikNote's signature blue, supported by a restrained coral finish.
  accent: {
    gradient: 'linear-gradient(135deg, #347ff0, #2869d5, #c83f58)',
    gradientHover: 'linear-gradient(135deg, #2869d5, #245dcc, #b92d48)',
    glow: '0 0 20px rgba(52, 127, 240, 0.3)',
    glowHover: '0 0 30px rgba(52, 127, 240, 0.45)',
  },
  // Semantic colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#2869d5',
  // Surface colors
  surface: {
    primary: '#ffffff',
    secondary: '#fffdf5',
    tertiary: '#f4f8ff',
    elevated: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
    blur: 'rgba(255, 253, 245, 0.82)',
  },
  // Text colors
  text: {
    primary: '#171313',
    secondary: '#68636c',
    tertiary: '#89838c',
    inverse: '#ffffff',
    link: '#2869d5',
  },
  // Border
  border: {
    default: '#e0e6f0',
    hover: '#c9d8ec',
    active: '#347ff0',
    subtle: '#f4f8ff',
  },
  // Feature-specific gradients
  gradients: {
    ai: 'linear-gradient(135deg, #347ff0, #2869d5)',
    aiGlow: '0 0 20px rgba(52, 127, 240, 0.3)',
    dna: 'linear-gradient(135deg, #10b981, #14b8a6)',
    dnaGlow: '0 0 16px rgba(16, 185, 129, 0.3)',
    premium: 'linear-gradient(135deg, #ffe45c, #c83f58)',
    premiumGlow: '0 0 16px rgba(255, 133, 143, 0.3)',
    workspace: 'linear-gradient(135deg, #347ff0, #2869d5)',
    workspaceGlow: '0 0 20px rgba(52, 127, 240, 0.3)',
  },
} as const;

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
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
} as const;

export const niknoteShadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  glow: '0 0 20px rgba(52, 127, 240, 0.16)',
  glass: '0 8px 32px rgba(0, 0, 0, 0.06)',
} as const;

export const niknoteTypography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    handwriting: "'Caveat', 'Kalam', 'Indie Flower', cursive",
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '22px',
    '3xl': '28px',
    '4xl': '36px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// Animation presets (for Framer Motion)
export const niknoteMotion = {
  // Spring physics
  spring: {
    gentle: { type: 'spring', stiffness: 120, damping: 14, mass: 1 } as const,
    snappy: { type: 'spring', stiffness: 300, damping: 25, mass: 0.8 } as const,
    bouncy: { type: 'spring', stiffness: 400, damping: 15, mass: 0.6 } as const,
    smooth: { type: 'spring', stiffness: 200, damping: 20, mass: 1 } as const,
  },
  // Common transitions
  transitions: {
    fast: { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] } as const,
    normal: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } as const,
    slow: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } as const,
  },
  // Common animation variants
  variants: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slideUp: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 10 },
    },
    slideDown: {
      initial: { opacity: 0, y: -10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
    },
    slideInRight: {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 20 },
    },
    slideInLeft: {
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
    },
    scaleIn: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    },
    staggerContainer: {
      animate: {
        transition: { staggerChildren: 0.05 },
      },
    },
  },
  // Hover/tap interaction
  interaction: {
    whileHover: { scale: 1.02, transition: { duration: 0.15 } },
    whileTap: { scale: 0.98, transition: { duration: 0.1 } },
    whileHoverLift: { y: -2, transition: { duration: 0.15 } },
  },
} as const;

// Glass morphism presets
export const niknoteGlass = {
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
  },
  medium: {
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  heavy: {
    background: 'rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(32px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12)',
  },
} as const;

// Sidebar design tokens
export const sidebarTokens = {
  width: '260px',
  widthCollapsed: '0px',
  itemHeight: '32px',
  sectionTitleHeight: '28px',
  padding: '12px',
  itemPadding: '6px 8px',
  indentPerLevel: 16,
} as const;
