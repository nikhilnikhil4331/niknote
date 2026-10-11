import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

const patterns: Record<HapticType, number | number[]> = {
  light: 10, medium: 25, heavy: 50, selection: 5,
  success: [10, 50, 10], warning: [25, 25, 25], error: [50, 50, 50],
};

export function haptic(type: HapticType = 'light') {
  try {
    if (Capacitor.isNativePlatform()) {
      if (type === 'selection') return void Haptics.selectionChanged();
      if (type === 'success') return void Haptics.notification({ type: NotificationType.Success });
      if (type === 'warning') return void Haptics.notification({ type: NotificationType.Warning });
      if (type === 'error') return void Haptics.notification({ type: NotificationType.Error });
      const style = type === 'heavy' ? ImpactStyle.Heavy : type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
      return void Haptics.impact({ style });
    }
    if ('vibrate' in navigator) navigator.vibrate(patterns[type]);
  } catch {
    // haptics unavailable
  }
}

export function useHaptics() {
  const triggerHaptic = useCallback((type: HapticType = 'light') => haptic(type), []);
  const vibrate = useCallback((p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* noop */ } }, []);
  return { triggerHaptic, vibrate };
}
