import { useCallback, useEffect, useState } from 'react';

export interface MobileAppearance {
  theme: 'light' | 'dark';
  color: string;
  layout: string;
  glass: boolean;
  animations: boolean;
  realPen: boolean;
}

const defaults: MobileAppearance = {
  theme: 'light',
  color: 'blue',
  layout: 'default',
  glass: true,
  animations: true,
  realPen: true,
};

function readAppearance(): MobileAppearance {
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = JSON.parse(localStorage.getItem('niknote-mobile-appearance') || '{}');
    const globalTheme = localStorage.getItem('theme');
    const legacyTheme = stored?.theme === 'dark' ? 'dark' : 'light';
    return {
      ...defaults,
      ...stored,
      // The app-wide Light/Dark preference is the single appearance source.
      theme: globalTheme === 'dark' || (!globalTheme && legacyTheme === 'dark') ? 'dark' : 'light',
    };
  } catch {
    return defaults;
  }
}

export function useMobileAppearance() {
  const [appearance, setAppearance] = useState<MobileAppearance>(readAppearance);

  useEffect(() => {
    const dark = appearance.theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      const { theme: _theme, ...nonThemePreferences } = appearance;
      localStorage.setItem('niknote-mobile-appearance', JSON.stringify(nonThemePreferences));
    } catch {
      // The theme remains active for this page even when storage is unavailable.
    }
  }, [appearance]);

  const update = useCallback((patch: Partial<MobileAppearance>) => {
    setAppearance((previous) => ({
      ...previous,
      ...patch,
      theme: patch.theme === 'dark' ? 'dark' : patch.theme === 'light' ? 'light' : previous.theme,
    }));
  }, []);

  return {
    appearance,
    update,
    attributes: {
      'data-theme': appearance.theme,
      'data-color': appearance.color,
      'data-layout': appearance.layout,
      'data-glass': appearance.glass,
      'data-motion': appearance.animations,
    },
  };
}
