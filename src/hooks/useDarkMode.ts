import { useState, useLayoutEffect, useCallback } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      // Only check localStorage, never system preference. Storage can be
      // blocked in private browsing, so theme selection must remain usable.
      try {
        return window.localStorage.getItem('theme') === 'dark';
      } catch {
        return false;
      }
    }
    return false;
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {
      // The in-memory theme still works when persistence is unavailable.
    }
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  return { isDark, toggle };
}
