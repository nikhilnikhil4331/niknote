// ============================================================
// NikNote 4.0 — UI Theme System
// 10 Design Systems: Skeuomorphism, Neomorphism, Glassmorphism,
// Claymorphism, Minimalism, Maximalism, Brutalism,
// Liquid Glass, Bento Grid, Spatial UI
// ============================================================

export type UITheme =
  | 'glassmorphism'   // Default — current NikNote style
  | 'skeuomorphism'   // Realistic textures, leather, wood
  | 'neomorphism'     // Soft shadows, embossed look
  | 'claymorphism'    // Puffy, clay-like, rounded
  | 'minimalism'      // Clean, white space, subtle
  | 'maximalism'      // Bold, colorful, layered
  | 'brutalism'       // Raw, bold borders, monospace
  | 'liquid-glass'    // Frosted glass with liquid effects
  | 'bento-grid'      // Grid-based, card layout
  | 'spatial-ui'      // 3D depth, parallax
  | 'niknote-paper';  // Signature warm paper, compass blue and hand-drawn accents

export const UI_THEMES: { value: UITheme; label: string; emoji: string; desc: string }[] = [
  { value: 'glassmorphism', label: 'Glassmorphism', emoji: '🪟', desc: 'Frosted glass, blur, transparency' },
  { value: 'skeuomorphism', label: 'Skeuomorphism', emoji: '📓', desc: 'Realistic notebook textures' },
  { value: 'neomorphism', label: 'Neomorphism', emoji: '🫧', desc: 'Soft shadows, embossed' },
  { value: 'claymorphism', label: 'Claymorphism', emoji: '🎨', desc: 'Puffy clay-like shapes' },
  { value: 'minimalism', label: 'Minimalism', emoji: '⬜', desc: 'Clean, white, subtle' },
  { value: 'maximalism', label: 'Maximalism', emoji: '🌈', desc: 'Bold, colorful, layered' },
  { value: 'brutalism', label: 'Brutalism', emoji: '🧱', desc: 'Raw, bold, monospace' },
  { value: 'liquid-glass', label: 'Liquid Glass', emoji: '💧', desc: 'Apple-like frosted liquid' },
  { value: 'bento-grid', label: 'Bento Grid', emoji: '📦', desc: 'Card-based grid layout' },
  { value: 'spatial-ui', label: 'Spatial UI', emoji: '🌐', desc: '3D depth, parallax' },
  { value: 'niknote-paper', label: 'Compass & Paper', emoji: '🧭', desc: 'Warm paper, compass blue, coral and playful type' },
];

// Generate CSS variables per theme
export function getThemeCSS(theme: UITheme): React.CSSProperties {
  switch (theme) {
    case 'niknote-paper':
      return {
        '--theme-bg': 'radial-gradient(circle at 94% 14%, rgba(255,228,92,.28) 0 8px, transparent 9px), linear-gradient(145deg, #f4ecd9 0%, #fff8e9 56%, #eaf2ff 100%)',
        '--theme-surface': '#fffaf0',
        '--theme-surface-border': 'rgba(41,39,37,.65)',
        '--theme-surface-shadow': '4px 4px 0 rgba(41,39,37,.82)',
        '--theme-blur': '0px',
        '--theme-text': '#171313',
        '--theme-accent': '#2869d5',
        '--theme-radius': '18px',
        '--theme-outline': '#292725',
        '--theme-coral': '#c83f58',
        '--theme-yellow': '#ffe45c',
        '--theme-display-font': "'Fredoka', 'Plus Jakarta Sans', sans-serif",
        '--theme-handwriting-font': "'Caveat', cursive",
        '--background': '44 100% 97%',
        '--foreground': '230 10% 9%',
        '--primary': '217 68% 50%',
        '--primary-foreground': '0 0% 100%',
        '--accent': '350 55% 52%',
        '--accent-foreground': '0 0% 100%',
        '--border': '220 34% 88%',
        '--input': '220 34% 88%',
        '--ring': '217 68% 50%',
      } as React.CSSProperties;

    case 'glassmorphism':
      return {
        '--theme-bg': 'linear-gradient(135deg, #fffdf5 0%, #eef4ff 62%, #fff0f0 100%)',
        '--theme-surface': 'rgba(255,255,255,0.72)',
        '--theme-surface-border': 'rgba(52,127,240,0.16)',
        '--theme-surface-shadow': '0 8px 32px rgba(38,78,140,0.1)',
        '--theme-blur': '20px',
        '--theme-text': '#171313',
        '--theme-accent': '#2869d5',
        '--theme-radius': '16px',
      } as React.CSSProperties;

    case 'skeuomorphism':
      return {
        '--theme-bg': '#d4c5a9',
        '--theme-surface': '#f5f0e1',
        '--theme-surface-border': '#b8a88a',
        '--theme-surface-shadow': '4px 4px 8px rgba(0,0,0,0.3), -2px -2px 4px rgba(255,255,255,0.4)',
        '--theme-blur': '0px',
        '--theme-text': '#2c1810',
        '--theme-accent': '#2869d5',
        '--theme-radius': '8px',
      } as React.CSSProperties;

    case 'neomorphism':
      return {
        '--theme-bg': '#e0e5ec',
        '--theme-surface': '#e0e5ec',
        '--theme-surface-border': 'transparent',
        '--theme-surface-shadow': '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff',
        '--theme-blur': '0px',
        '--theme-text': '#2d3436',
        '--theme-accent': '#2869d5',
        '--theme-radius': '20px',
      } as React.CSSProperties;

    case 'claymorphism':
      return {
        '--theme-bg': '#eef4ff',
        '--theme-surface': '#fffdf5',
        '--theme-surface-border': 'rgba(52,127,240,0.18)',
        '--theme-surface-shadow': '0 8px 24px rgba(38,78,140,0.14), inset 0 -4px 12px rgba(0,0,0,0.04), inset 0 4px 12px rgba(255,255,255,0.7)',
        '--theme-blur': '0px',
        '--theme-text': '#171313',
        '--theme-accent': '#c83f58',
        '--theme-radius': '24px',
      } as React.CSSProperties;

    case 'minimalism':
      return {
        '--theme-bg': '#fafafa',
        '--theme-surface': '#ffffff',
        '--theme-surface-border': '#f0f0f0',
        '--theme-surface-shadow': '0 1px 3px rgba(0,0,0,0.04)',
        '--theme-blur': '0px',
        '--theme-text': '#111111',
        '--theme-accent': '#2869d5',
        '--theme-radius': '8px',
      } as React.CSSProperties;

    case 'maximalism':
      return {
        '--theme-bg': 'linear-gradient(45deg, #347ff0, #ff858f, #ffe45c, #fff0f0)',
        '--theme-surface': 'rgba(255,255,255,0.9)',
        '--theme-surface-border': 'rgba(255,133,143,0.34)',
        '--theme-surface-shadow': '0 12px 40px rgba(40,105,213,0.2), 0 4px 16px rgba(255,133,143,0.15)',
        '--theme-blur': '12px',
        '--theme-text': '#171313',
        '--theme-accent': '#2869d5',
        '--theme-radius': '20px',
      } as React.CSSProperties;

    case 'brutalism':
      return {
        '--theme-bg': '#fffdf5',
        '--theme-surface': '#ffffff',
        '--theme-surface-border': '#000000',
        '--theme-surface-shadow': '4px 4px 0px #000000',
        '--theme-blur': '0px',
        '--theme-text': '#000000',
        '--theme-accent': '#c83f58',
        '--theme-radius': '0px',
      } as React.CSSProperties;

    case 'liquid-glass':
      return {
        '--theme-bg': 'linear-gradient(180deg, #eef4ff 0%, #dceaff 50%, #cfe1fa 100%)',
        '--theme-surface': 'rgba(255,255,255,0.35)',
        '--theme-surface-border': 'rgba(255,255,255,0.5)',
        '--theme-surface-shadow': '0 8px 32px rgba(40,105,213,0.12), inset 0 1px 2px rgba(255,255,255,0.6)',
        '--theme-blur': '24px',
        '--theme-text': '#17365e',
        '--theme-accent': '#2869d5',
        '--theme-radius': '20px',
      } as React.CSSProperties;

    case 'bento-grid':
      return {
        '--theme-bg': '#f8fafc',
        '--theme-surface': '#ffffff',
        '--theme-surface-border': '#e2e8f0',
        '--theme-surface-shadow': '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        '--theme-blur': '0px',
        '--theme-text': '#1e293b',
        '--theme-accent': '#2869d5',
        '--theme-radius': '16px',
      } as React.CSSProperties;

    case 'spatial-ui':
      return {
        '--theme-bg': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        '--theme-surface': 'rgba(51,65,85,0.6)',
        '--theme-surface-border': 'rgba(148,163,184,0.2)',
        '--theme-surface-shadow': '0 24px 48px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.1)',
        '--theme-blur': '16px',
        '--theme-text': '#f1f5f9',
        '--theme-accent': '#78aef5',
        '--theme-radius': '20px',
      } as React.CSSProperties;
  }
}

// Get theme class names for the main layout
export function getThemeClasses(theme: UITheme): {
  wrapper: string;
  header: string;
  surface: string;
  button: string;
  activeTab: string;
  card: string;
} {
  const base = {
    wrapper: '',
    header: '',
    surface: '',
    button: '',
    activeTab: '',
    card: '',
  };

  switch (theme) {
    case 'niknote-paper':
      return {
        ...base,
        wrapper: 'bg-[#fff8e9]',
        header: 'bg-[#fffaf0] border-[#292725] shadow-[4px_4px_0_rgba(41,39,37,0.82)]',
        surface: 'bg-[#fffaf0] border-[#292725] shadow-[4px_4px_0_rgba(41,39,37,0.82)]',
        button: 'bg-[#fff3d1] border-[#292725] shadow-[2px_2px_0_rgba(41,39,37,0.82)]',
        activeTab: 'bg-[#2869d5] text-white shadow-[2px_2px_0_rgba(41,39,37,0.82)]',
        card: 'bg-[#fffaf0] border-[#292725]',
      };

    case 'skeuomorphism':
      return {
        ...base,
        wrapper: 'bg-[#d4c5a9]',
        header: 'bg-[#f5f0e1] border-[#b8a88a] shadow-[4px_4px_8px_rgba(0,0,0,0.3)]',
        surface: 'bg-[#f5f0e1] border-[#b8a88a] shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.4)]',
        button: 'bg-[#d4c5a9] shadow-[2px_2px_4px_rgba(0,0,0,0.3),-1px_-1px_2px_rgba(255,255,255,0.4)] border-[#b8a88a]',
        activeTab: 'bg-[#2869d5] text-white shadow-inner',
        card: 'bg-[#f5f0e1] border-[#b8a88a]',
      };

    case 'neomorphism':
      return {
        ...base,
        wrapper: 'bg-[#e0e5ec]',
        header: 'bg-[#e0e5ec] shadow-[6px_6px_12px_#b8bec7,-6px_-6px_12px_#ffffff] border-none',
        surface: 'bg-[#e0e5ec] shadow-[8px_8px_16px_#b8bec7,-8px_-8px_16px_#ffffff] border-none',
        button: 'bg-[#e0e5ec] shadow-[4px_4px_8px_#b8bec7,-4px_-4px_8px_#ffffff] border-none',
        activeTab: 'shadow-[inset_4px_4px_8px_#b8bec7,inset_-4px_-4px_8px_#ffffff] text-[#2869d5]',
        card: 'bg-[#e0e5ec] shadow-[6px_6px_12px_#b8bec7,-6px_-6px_12px_#ffffff] border-none',
      };

    case 'claymorphism':
      return {
        ...base,
        wrapper: 'bg-[#eef4ff]',
        header: 'bg-[#fffdf5] border-[rgba(52,127,240,0.18)] shadow-[0_8px_24px_rgba(40,105,213,0.18),inset_0_-4px_12px_rgba(0,0,0,0.05),inset_0_4px_12px_rgba(255,255,255,0.6)]',
        surface: 'bg-[#fffdf5] border-[rgba(52,127,240,0.18)] shadow-[0_12px_32px_rgba(40,105,213,0.22),inset_0_-6px_16px_rgba(0,0,0,0.06),inset_0_6px_16px_rgba(255,255,255,0.7)]',
        button: 'bg-[#dceaff] shadow-[0_6px_16px_rgba(40,105,213,0.24),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_3px_8px_rgba(255,255,255,0.5)] border-[rgba(52,127,240,0.18)]',
        activeTab: 'bg-[#c83f58] text-white shadow-[0_4px_12px_rgba(200,63,88,0.32)]',
        card: 'bg-[#fffdf5] border-[rgba(52,127,240,0.14)]',
      };

    case 'minimalism':
      return {
        ...base,
        wrapper: 'bg-[#fafafa]',
        header: 'bg-white border-[#f0f0f0] shadow-none',
        surface: 'bg-white border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        button: 'bg-white border-[#e5e5e5] shadow-none hover:bg-[#f5f5f5]',
        activeTab: 'bg-[#2869d5] text-white',
        card: 'bg-white border-[#f0f0f0] shadow-none',
      };

    case 'maximalism':
      return {
        ...base,
        wrapper: 'bg-gradient-to-br from-[#fff0f0] via-[#eef4ff] to-[#fff8dc]',
        header: 'bg-white/85 border-[#ffc0c5] shadow-[0_8px_32px_rgba(52,127,240,0.12)]',
        surface: 'bg-white/90 border-[#ffc0c5] shadow-[0_12px_40px_rgba(52,127,240,0.14),0_4px_16px_rgba(255,133,143,0.1)]',
        button: 'bg-gradient-to-r from-[#2869d5] to-[#c83f58] text-white border-none shadow-[0_4px_16px_rgba(52,127,240,0.24)]',
        activeTab: 'bg-gradient-to-r from-[#2869d5] to-[#c83f58] text-white',
        card: 'bg-white/90 border-[#ffc0c5]',
      };

    case 'brutalism':
      return {
        ...base,
        wrapper: 'bg-[#fffdf5]',
        header: 'bg-white border-2 border-black shadow-[4px_4px_0px_#000] rounded-none',
        surface: 'bg-white border-2 border-black shadow-[4px_4px_0px_#000] rounded-none',
        button: 'bg-white border-2 border-black shadow-[2px_2px_0px_#000] rounded-none hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]',
        activeTab: 'bg-black text-white border-2 border-black',
        card: 'bg-white border-2 border-black',
      };

    case 'liquid-glass':
      return {
        ...base,
        wrapper: 'bg-gradient-to-b from-[#eef4ff] via-[#dceaff] to-[#cfe1fa]',
        header: 'bg-white/30 backdrop-blur-2xl border-white/40 shadow-[0_8px_32px_rgba(40,105,213,0.08)]',
        surface: 'bg-white/35 backdrop-blur-2xl border-white/50 shadow-[0_8px_32px_rgba(40,105,213,0.1),inset_0_1px_2px_rgba(255,255,255,0.6)]',
        button: 'bg-white/30 backdrop-blur-lg border-white/40 shadow-[0_4px_16px_rgba(40,105,213,0.1)]',
        activeTab: 'bg-[#2869d5]/15 text-[#1f56b4] border-[#2869d5]/30',
        card: 'bg-white/30 backdrop-blur-xl border-white/40',
      };

    case 'bento-grid':
      return {
        ...base,
        wrapper: 'bg-[#f8fafc]',
        header: 'bg-white border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        surface: 'bg-white border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]',
        button: 'bg-[#f1f5f9] border-[#e2e8f0] shadow-none hover:bg-[#e2e8f0]',
        activeTab: 'bg-[#2869d5] text-white shadow-[0_2px_8px_rgba(40,105,213,0.3)]',
        card: 'bg-white border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
      };

    case 'spatial-ui':
      return {
        ...base,
        wrapper: 'bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]',
        header: 'bg-[rgba(51,65,85,0.6)] backdrop-blur-xl border-[rgba(148,163,184,0.15)] shadow-[0_24px_48px_rgba(0,0,0,0.3)]',
        surface: 'bg-[rgba(51,65,85,0.5)] backdrop-blur-xl border-[rgba(148,163,184,0.15)] shadow-[0_24px_48px_rgba(0,0,0,0.25),0_8px_16px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.08)]',
        button: 'bg-[rgba(51,65,85,0.6)] backdrop-blur-lg border-[rgba(148,163,184,0.2)] text-[#f1f5f9]',
        activeTab: 'bg-[#347ff0]/20 text-[#b8d2ff] border-[#347ff0]/30',
        card: 'bg-[rgba(51,65,85,0.5)] backdrop-blur-xl border-[rgba(148,163,184,0.15)]',
      };

    default: // glassmorphism
      return {
        ...base,
        wrapper: '',
        header: 'bg-white/20 backdrop-blur-2xl border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.08)]',
        surface: 'bg-white/20 backdrop-blur-xl border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
        button: 'bg-white/30 backdrop-blur-sm border-white/25',
        activeTab: 'bg-primary/10 text-primary border-primary/20',
        card: 'bg-white/20 backdrop-blur-xl border-white/25',
      };
  }
}

// Hook to persist theme
export function useUITheme() {
  const STORAGE_KEY = 'niknote-ui-theme';

  const getInitialTheme = (): UITheme => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && UI_THEMES.some(t => t.value === saved)) return saved as UITheme;
    } catch {}
    return 'glassmorphism';
  };

  const [theme, setThemeState] = React.useState<UITheme>(getInitialTheme);

  const setTheme = (newTheme: UITheme) => {
    setThemeState(newTheme);
    try { localStorage.setItem(STORAGE_KEY, newTheme); } catch {}
  };

  return { theme, setTheme, css: getThemeCSS(theme), classes: getThemeClasses(theme) };
}

import React from 'react';
