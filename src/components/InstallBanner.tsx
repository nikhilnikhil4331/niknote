// ============================================================
// InstallBanner — PWA install prompt banner
// Shows at bottom of screen on mobile when app is installable
// ============================================================

import { useLocation } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { X, Download, Smartphone } from 'lucide-react';

export function InstallBanner() {
  const { isInstallable, installApp, dismissInstall } = usePWAInstall();
  const { pathname } = useLocation();

  // The habit app and full-screen NikAI Studio own the bottom of the screen;
  // never stack a floating install banner over them.
  if (
    pathname.startsWith('/habit') ||
    pathname === '/ai' ||
    pathname === '/nikai' ||
    pathname === '/ai-workspace' ||
    pathname === '/agents'
  ) {
    return null;
  }
  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-slide-up">
      <div className="glass-panel-elevated p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install NikNote</p>
          <p className="text-xs text-muted-foreground">Use like an app — works offline!</p>
        </div>
        <button
          onClick={installApp}
          className="btn-press flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button
          onClick={dismissInstall}
          className="btn-press p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
