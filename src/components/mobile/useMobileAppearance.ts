import { useEffect, useState } from 'react';

export interface MobileAppearance { theme: string; color: string; layout: string; glass: boolean; animations: boolean; realPen: boolean }
const defaults: MobileAppearance = { theme: 'calm', color: 'purple', layout: 'default', glass: true, animations: true, realPen: true };
export function useMobileAppearance() {
  const [appearance, setAppearance] = useState<MobileAppearance>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('niknote-mobile-appearance') || '{}') }; } catch { return defaults; }
  });
  useEffect(() => { localStorage.setItem('niknote-mobile-appearance', JSON.stringify(appearance)); }, [appearance]);
  const update = (patch: Partial<MobileAppearance>) => setAppearance(prev => ({ ...prev, ...patch }));
  return { appearance, update, attributes: { 'data-theme': appearance.theme, 'data-color': appearance.color, 'data-layout': appearance.layout, 'data-glass': appearance.glass, 'data-motion': appearance.animations } };
}