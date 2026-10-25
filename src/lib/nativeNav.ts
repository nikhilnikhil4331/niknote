// ============================================================
// NikNote — native (Capacitor) shell navigation
//
// Android hardware/gesture Back is owned by the WebView history:
//   • deeper screen (route or an in-app pushed screen such as the
//     Habit shell, which writes history entries) -> go back
//   • at the root -> "press back again to exit", then exit
// Everything is a no-op on web — browsers already own Back there.
// ============================================================

import { toast } from 'sonner';

let installed = false;
let lastRootBackAt = 0;

/** Pure decision, unit-tested: what should a Back press do right now? */
export function backAction(input: { canGoBack: boolean; now: number; lastRootBackAt: number }): 'history' | 'warn' | 'exit' {
  if (input.canGoBack) return 'history';
  if (input.now - input.lastRootBackAt < 2000) return 'exit';
  return 'warn';
}

/** Installs the Android back-button behaviour. Safe to call on web (no-op). */
export async function initNativeShell(): Promise<void> {
  if (installed) return;
  installed = true;
  try {
    const [{ Capacitor }, { App }] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/app'),
    ]);
    if (!Capacitor.isNativePlatform()) return;

    await App.addListener('backButton', ({ canGoBack }) => {
      const action = backAction({ canGoBack, now: Date.now(), lastRootBackAt });
      if (action === 'history') {
        window.history.back();
      } else if (action === 'exit') {
        void App.exitApp();
      } else {
        lastRootBackAt = Date.now();
        toast.info('Press back again to exit NikNote');
      }
    });
  } catch {
    /* not a native shell / plugin unavailable — web behaviour stands */
  }
}
