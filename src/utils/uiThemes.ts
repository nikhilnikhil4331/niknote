// ============================================================
// NikNote — Workspace appearance themes
// Every variant is built from the Sunset Plum palette. The theme
// only changes *surface texture* (glass, clay, paper, spatial…);
// colour always comes from the shared design tokens so the app
// can never drift into an off-brand look.
// ============================================================

import React from 'react';

export type UITheme =
  | 'glassmorphism' // Default — Sunset Plum glass
  | 'skeuomorphism' // Parchment
  | 'neomorphism' // Blush soft
  | 'claymorphism' // Clay plum
  | 'minimalism' // Daylight minimal
  | 'maximalism' // Sunset max
  | 'brutalism' // Ink brutal
  | 'liquid-glass' // Plum liquid glass
  | 'bento-grid' // Bento plum
  | 'spatial-ui'; // Midnight spatial

export const UI_THEMES: { value: UITheme; label: string; emoji: string; desc: string }[] = [
  { value: 'glassmorphism', label: 'Sunset Plum', emoji: '🌅', desc: 'Signature frosted plum glass' },
  { value: 'skeuomorphism', label: 'Parchment', emoji: '📜', desc: 'Warm paper with plum ink' },
  { value: 'neomorphism', label: 'Blush Soft', emoji: '🫧', desc: 'Soft blush, embossed surfaces' },
  { value: 'claymorphism', label: 'Clay Plum', emoji: '🏺', desc: 'Puffy clay, rounded corners' },
  { value: 'minimalism', label: 'Daylight', emoji: '⬜', desc: 'Clean, calm, minimal chrome' },
  { value: 'maximalism', label: 'Sunset Max', emoji: '🌇', desc: 'Bold rose-to-amber gradient' },
  { value: 'brutalism', label: 'Ink Brutal', emoji: '🧱', desc: 'Raw plum outlines, no blur' },
  { value: 'liquid-glass', label: 'Plum Glass', emoji: '💧', desc: 'Apple-like frosted liquid' },
  { value: 'bento-grid', label: 'Bento Plum', emoji: '📦', desc: 'Card grid with hairline edges' },
  { value: 'spatial-ui', label: 'Midnight Spatial', emoji: '🌌', desc: 'Deep plum depth and parallax' },
];

const surface = (alpha: number) => `hsl(var(--surface-primary-hsl) / ${alpha})`;

/** Theme-scoped CSS custom properties used by the editor shell. */
export function getThemeCSS(theme: UITheme): React.CSSProperties {
  switch (theme) {
    case 'skeuomorphism':
      return {
        '--theme-bg': 'hsl(var(--paper-ruled-hsl))',
        '--theme-surface': 'hsl(var(--paper-hsl))',
        '--theme-surface-border': 'hsl(var(--paper-rule-hsl))',
        '--theme-surface-shadow': '0 2px 6px rgba(68, 23, 78, 0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
        '--theme-blur': '0px',
        '--theme-text': 'hsl(var(--paper-foreground-hsl))',
        '--theme-accent': '#a34054',
        '--theme-radius': '10px',
      } as React.CSSProperties;

    case 'neomorphism':
      return {
        '--theme-bg': 'hsl(var(--background-secondary-hsl))',
        '--theme-surface': 'hsl(var(--surface-secondary-hsl))',
        '--theme-surface-border': 'transparent',
        '--theme-surface-shadow': '6px 6px 14px rgba(68, 23, 78, 0.14), -6px -6px 14px rgba(255,255,255,0.45)',
        '--theme-blur': '0px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': '#8c3149',
        '--theme-radius': '20px',
      } as React.CSSProperties;

    case 'claymorphism':
      return {
        '--theme-bg': 'hsl(var(--background-tertiary-hsl))',
        '--theme-surface': 'hsl(var(--surface-primary-hsl))',
        '--theme-surface-border': 'hsl(var(--border-subtle-hsl))',
        '--theme-surface-shadow': '0 10px 26px -14px rgba(68, 23, 78, 0.35), inset 0 -3px 10px rgba(68, 23, 78, 0.08), inset 0 3px 10px rgba(255,255,255,0.35)',
        '--theme-blur': '0px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': '#a34054',
        '--theme-radius': '24px',
      } as React.CSSProperties;

    case 'minimalism':
      return {
        '--theme-bg': 'hsl(var(--background-primary-hsl))',
        '--theme-surface': 'hsl(var(--surface-elevated-hsl))',
        '--theme-surface-border': 'hsl(var(--border-subtle-hsl))',
        '--theme-surface-shadow': '0 1px 2px rgba(36, 27, 46, 0.06)',
        '--theme-blur': '0px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': '#8c3149',
        '--theme-radius': '10px',
      } as React.CSSProperties;

    case 'maximalism':
      return {
        '--theme-bg': 'linear-gradient(135deg, #662249 0%, #a34054 55%, #ed9e59 100%)',
        '--theme-surface': surface(0.92),
        '--theme-surface-border': 'rgba(233, 188, 185, 0.55)',
        '--theme-surface-shadow': '0 18px 50px -22px rgba(68, 23, 78, 0.55)',
        '--theme-blur': '12px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': '#a34054',
        '--theme-radius': '22px',
      } as React.CSSProperties;

    case 'brutalism':
      return {
        '--theme-bg': 'hsl(var(--paper-hsl))',
        '--theme-surface': 'hsl(var(--paper-hsl))',
        '--theme-surface-border': '#1b1931',
        '--theme-surface-shadow': '4px 4px 0 #1b1931',
        '--theme-blur': '0px',
        '--theme-text': '#1b1931',
        '--theme-accent': '#a34054',
        '--theme-radius': '0px',
      } as React.CSSProperties;

    case 'liquid-glass':
      return {
        '--theme-bg': 'linear-gradient(160deg, #44174e 0%, #662249 55%, #a34054 100%)',
        '--theme-surface': surface(0.42),
        '--theme-surface-border': 'rgba(233, 188, 185, 0.38)',
        '--theme-surface-shadow': '0 12px 40px -18px rgba(8, 6, 16, 0.55), inset 0 1px 2px rgba(255,255,255,0.4)',
        '--theme-blur': '24px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': '#ed9e59',
        '--theme-radius': '22px',
      } as React.CSSProperties;

    case 'bento-grid':
      return {
        '--theme-bg': 'hsl(var(--background-secondary-hsl))',
        '--theme-surface': 'hsl(var(--surface-primary-hsl))',
        '--theme-surface-border': 'hsl(var(--border-subtle-hsl))',
        '--theme-surface-shadow': '0 1px 2px rgba(36, 27, 46, 0.06), 0 6px 16px -12px rgba(68, 23, 78, 0.35)',
        '--theme-blur': '0px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': '#a34054',
        '--theme-radius': '16px',
      } as React.CSSProperties;

    case 'spatial-ui':
      return {
        '--theme-bg': 'linear-gradient(135deg, #121020 0%, #1b1931 55%, #2a1235 100%)',
        '--theme-surface': 'rgba(38, 32, 64, 0.68)',
        '--theme-surface-border': 'rgba(233, 188, 185, 0.16)',
        '--theme-surface-shadow': '0 28px 60px -26px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        '--theme-blur': '18px',
        '--theme-text': '#f7eeec',
        '--theme-accent': '#ed9e59',
        '--theme-radius': '20px',
      } as React.CSSProperties;

    case 'glassmorphism':
    default:
      return {
        '--theme-bg': 'linear-gradient(160deg, hsl(var(--background-primary-hsl)) 0%, hsl(var(--background-tertiary-hsl)) 100%)',
        '--theme-surface': 'hsl(var(--surface-primary-hsl) / 0.55)',
        '--theme-surface-border': 'var(--nk-glass-border)',
        '--theme-surface-shadow': 'var(--nk-shadow-md)',
        '--theme-blur': '20px',
        '--theme-text': 'hsl(var(--text-primary-hsl))',
        '--theme-accent': 'hsl(var(--accent-primary-hsl))',
        '--theme-radius': '18px',
      } as React.CSSProperties;
  }
}

/** Theme class strings for the workspace shell. */
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
    case 'skeuomorphism':
      return {
        ...base,
        wrapper: 'bg-paper',
        header: 'bg-paper text-paper-foreground border-paper-rule shadow-nk-sm',
        surface: 'bg-paper text-paper-foreground border-paper-rule shadow-nk-sm',
        button: 'bg-paper text-paper-foreground border-paper-rule shadow-nk-xs',
        activeTab: 'bg-nk-burgundy text-white shadow-inner',
        card: 'bg-paper text-paper-foreground border-paper-rule',
      };

    case 'neomorphism':
      return {
        ...base,
        wrapper: 'bg-background-secondary',
        header: 'bg-surface-secondary border-transparent shadow-nk-sm',
        surface: 'bg-surface-secondary border-transparent shadow-nk-md',
        button: 'bg-surface-secondary border-transparent shadow-nk-sm',
        activeTab: 'bg-surface-hover text-fg-primary shadow-nk-xs',
        card: 'bg-surface-secondary border-transparent shadow-nk-md',
      };

    case 'claymorphism':
      return {
        ...base,
        wrapper: 'bg-background-tertiary',
        header: 'bg-surface border-subtle shadow-nk-sm',
        surface: 'bg-surface border-subtle shadow-nk-md',
        button: 'bg-surface border-subtle shadow-nk-sm',
        activeTab: 'bg-primary text-primary-foreground shadow-nk-sm',
        card: 'bg-surface border-subtle shadow-nk-md',
      };

    case 'minimalism':
      return {
        ...base,
        wrapper: 'bg-background-primary',
        header: 'bg-surface border-subtle shadow-none',
        surface: 'bg-surface border-subtle shadow-none',
        button: 'bg-surface border-subtle shadow-none hover:bg-surface-secondary',
        activeTab: 'bg-fg-primary text-fg-inverse',
        card: 'bg-surface border-subtle shadow-none',
      };

    case 'maximalism':
      return {
        ...base,
        wrapper: 'bg-[image:var(--nk-grad-secondary)]',
        header: 'bg-surface/80 border-[color:hsl(var(--accent-rose-hsl)/0.36)] shadow-nk-md',
        surface: 'bg-surface/90 border-[color:hsl(var(--accent-rose-hsl)/0.3)] shadow-nk-md',
        button: 'bg-[image:var(--nk-grad-accent)] text-[#2a1a24] border-none shadow-nk-sm',
        activeTab: 'bg-[image:var(--nk-grad-accent)] text-[#2a1a24]',
        card: 'bg-surface/90 border-[color:hsl(var(--accent-rose-hsl)/0.3)]',
      };

    case 'brutalism':
      return {
        ...base,
        wrapper: 'bg-paper text-paper-foreground',
        header: 'bg-paper border-2 border-nk-midnight shadow-[4px_4px_0px_#1B1931] rounded-none',
        surface: 'bg-paper border-2 border-nk-midnight shadow-[4px_4px_0px_#1B1931] rounded-none',
        button: 'bg-paper border-2 border-nk-midnight shadow-[2px_2px_0px_#1B1931] rounded-none hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]',
        activeTab: 'bg-nk-midnight text-white border-2 border-nk-midnight',
        card: 'bg-paper border-2 border-nk-midnight',
      };

    case 'liquid-glass':
      return {
        ...base,
        wrapper: 'bg-[image:var(--nk-grad-secondary)]',
        header: 'bg-[color:var(--nk-glass-bg)] backdrop-blur-2xl border-[color:var(--nk-glass-border)] shadow-nk-md',
        surface: 'bg-[color:var(--nk-glass-bg)] backdrop-blur-2xl border-[color:var(--nk-glass-border)] shadow-nk-md',
        button: 'bg-surface/30 backdrop-blur-lg border-[color:var(--nk-glass-border)] shadow-nk-sm',
        activeTab: 'bg-primary/20 text-fg-primary border-primary/30',
        card: 'bg-[color:var(--nk-glass-bg)] backdrop-blur-xl border-[color:var(--nk-glass-border)]',
      };

    case 'bento-grid':
      return {
        ...base,
        wrapper: 'bg-background-secondary',
        header: 'bg-surface border-subtle shadow-nk-xs',
        surface: 'bg-surface border-subtle shadow-nk-sm',
        button: 'bg-surface-secondary border-subtle shadow-none hover:bg-surface-hover',
        activeTab: 'bg-primary text-primary-foreground shadow-nk-sm',
        card: 'bg-surface border-subtle shadow-nk-xs',
      };

    case 'spatial-ui':
      return {
        ...base,
        wrapper: 'bg-[image:var(--nk-grad-secondary)]',
        header: 'bg-surface/60 backdrop-blur-xl border-subtle shadow-nk-lg',
        surface: 'bg-surface/50 backdrop-blur-xl border-subtle shadow-nk-lg',
        button: 'bg-surface/60 backdrop-blur-lg border-subtle text-fg-secondary',
        activeTab: 'bg-primary/20 text-fg-primary border-primary/30',
        card: 'bg-surface/50 backdrop-blur-xl border-subtle',
      };

    case 'glassmorphism':
    default:
      return {
        ...base,
        wrapper: '',
        header: 'bg-[color:var(--nk-glass-bg)] backdrop-blur-2xl border-[color:var(--nk-glass-border)] shadow-nk-md',
        surface: 'bg-[color:var(--nk-glass-bg)] backdrop-blur-xl border-[color:var(--nk-glass-border)] shadow-nk-sm',
        button: 'bg-surface/30 backdrop-blur-sm border-[color:var(--nk-glass-border)]',
        activeTab: 'bg-primary/10 text-accent-rose border-primary/20',
        card: 'bg-[color:var(--nk-glass-bg)] backdrop-blur-xl border-[color:var(--nk-glass-border)]',
      };
  }
}

/** Persisted appearance selection. */
export function useUITheme() {
  const STORAGE_KEY = 'niknote-ui-theme';

  const getInitialTheme = (): UITheme => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && UI_THEMES.some((t) => t.value === saved)) return saved as UITheme;
    } catch {
      // storage unavailable — fall through to the signature theme
    }
    return 'glassmorphism';
  };

  const [theme, setThemeState] = React.useState<UITheme>(getInitialTheme);

  const setTheme = (newTheme: UITheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore storage failure; selection still applies for this session
    }
  };

  return { theme, setTheme, css: getThemeCSS(theme), classes: getThemeClasses(theme) };
}
