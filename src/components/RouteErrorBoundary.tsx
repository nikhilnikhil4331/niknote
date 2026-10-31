// ============================================================
// RouteErrorBoundary — per-route crash recovery
//
// The whole app sits inside one big ErrorBoundary, so a crash in ANY lazy
// page (most commonly a failed chunk download on flaky mobile data) used to
// nuke the entire app to the "Kuch gadbad ho gayi" screen — users experienced
// this as "click Habit/Money and the app dies/stucks".
//
// This boundary sits right around <Routes>:
//  - Chunk/import load failure → shows "app update ho raha hai" and does a
//    fresh reload of the SAME page (bypassing stale HTML/cache) after a beat.
//  - Any other route crash → friendly retry UI for that page only; the rest
//    of the app (nav, other routes) is untouched.
// ============================================================

import React, { Component, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const CHUNK_RE = /loading chunk|chunkload|failed to fetch (dynamically )?imported module|importing a module script failed|unable to preload/i;

const isChunkError = (e: Error | null) => !!e && CHUNK_RE.test(e.message || '');

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; retry: number }> {
  state = { error: null as Error | null, retry: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error, retry: 0 };
  }

  componentDidCatch(error: Error) {
    console.error('[RouteErrorBoundary] route crash:', error);
    if (isChunkError(error)) {
      // Stale deploy / cache mismatch: a fresh load of the same URL picks up
      // the current HTML + chunk names.
      //
      // This used to reload on every chunk error with no ceiling. If the CDN
      // is serving an HTML document that names chunks the current deploy no
      // longer has, every reload fetches the same stale HTML and fails the
      // same way, so the page reloads forever and never renders the retry UI.
      // /payment was doing exactly this in production. Reload at most twice
      // per tab session; after that, show the user the error and let them act.
      const KEY = 'niknote:chunk-reloads';
      let attempts = 0;
      try {
        attempts = Number(window.sessionStorage.getItem(KEY) || '0');
      } catch {
        attempts = 2; // storage blocked: never loop
      }
      if (attempts >= 2) return;
      try {
        window.sessionStorage.setItem(KEY, String(attempts + 1));
      } catch {
        return;
      }
      window.setTimeout(() => {
        window.location.replace(window.location.pathname + '?fresh=' + Date.now());
      }, 900);
    }
  }

  private handleRetry = () => this.setState(s => ({ error: null, retry: s.retry + 1 }));
  private handleReload = () => window.location.reload();

  render() {
    const { error, retry } = this.state;
    if (error) {
      const chunk = isChunkError(error);
      return (
        <div className="min-h-screen grid place-items-center bg-background p-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm space-y-4">
            {chunk ? (
              <>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 grid place-items-center">
                  <RefreshCw className="w-6 h-6 text-accent-rose animate-spin" />
                </div>
                <h1 className="text-lg font-semibold">App update ho raha hai…</h1>
                <p className="text-sm text-muted-foreground">
                  Ye page nahi khul paaya (internet/cache issue). Fresh copy load ho rahi hai — ek second do.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 grid place-items-center text-2xl">😅</div>
                <h1 className="text-lg font-semibold">Ye page atak gaya</h1>
                <p className="text-sm text-muted-foreground">
                  Kuch samajh nahi aaya is screen ko. Don't worry — baaki app aur tumhara data theek hai.
                </p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button onClick={this.handleRetry}
                    className="h-11 px-5 rounded-2xl border border-border bg-card text-sm font-semibold active:scale-95 transition">
                    Dobara try karo
                  </button>
                  <button onClick={this.handleReload}
                    className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 active:scale-95 transition">
                    <RefreshCw className="w-4 h-4" /> Reload
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      );
    }
    return <React.Fragment key={retry}>{this.props.children}</React.Fragment>;
  }
}

export { RouteErrorBoundary };
