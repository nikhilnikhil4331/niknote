// ============================================================
// NikNote 4.0 — ErrorBoundary (Production-Ready)
// Shows friendly message to users, full details only in dev
// Logs errors to Supabase for monitoring
// ============================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reported: boolean;
  autoRecovered: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    reported: false,
    autoRecovered: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, reported: false, autoRecovered: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 NikNote Error:', error, errorInfo);
    this.setState({ errorInfo });

    // AUTO-RECOVERY: If this is likely a stale cache error, try to recover
    // by clearing caches and reloading automatically
    if (!this.state.reported && !this.state.autoRecovered) {
      const errorMsg = error.message || '';
      // Common stale cache errors: "X is not defined", "Cannot read properties of undefined"
      const likelyStaleCache = errorMsg.includes('is not defined') || 
                               errorMsg.includes('Cannot read properties') ||
                               errorMsg.includes('is not a function');
      
      if (likelyStaleCache) {
        console.log('[ErrorBoundary] Auto-recovery: clearing caches and reloading');
        this.setState({ autoRecovered: true });
        this.autoRecover();
        return; // Don't report to Supabase, just recover
      }
      
      // Report to Supabase error_logs in production
      if (!isDev && !this.state.reported) {
        this.reportError(error, errorInfo);
      }
    }
  }

  private async autoRecover() {
    try {
      // 1. Delete ALL browser caches
      if ('caches' in window) {
        const names = await caches.keys();
        for (const name of names) {
          console.log('[AutoRecover] Purging cache:', name);
          await caches.delete(name);
        }
      }
      // 2. Unregister ALL service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          console.log('[AutoRecover] Unregistering SW:', reg.scope);
          await reg.unregister();
        }
      }
      // 3. Wait 500ms for cleanup, then hard reload
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('[AutoRecover] Reloading with fresh state...');
      window.location.href = window.location.origin + '/?fresh=' + Date.now();
    } catch (e) {
      console.warn('[AutoRecover] Failed:', e);
      // Still try a basic reload
      window.location.reload();
    }
  }

  private async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      this.setState({ reported: true });
      const { supabase } = await import('@/integrations/supabase/client');
      // Column names must match public.error_logs exactly (stack_trace /
      // page_url / created_at). The previous shape used error_stack / url /
      // timestamp, which silently failed, so no client error was ever recorded.
      const componentStack = errorInfo.componentStack || '';
      await supabase.from('error_logs').insert({
        error_type: error.name || 'client_error',
        error_message: error.message || 'Unknown error',
        stack_trace: [error.stack || '', componentStack ? `\n--- component stack ---${componentStack}` : '']
          .join('')
          .slice(0, 4000),
        page_url: window.location.href.slice(0, 300),
        user_agent: navigator.userAgent.slice(0, 300),
      });
    } catch {
      // Silently fail — don't crash the error boundary itself
    }
  }

  private handleReload = () => {
    // CRITICAL FIX: Before reloading, clear ALL caches and unregister old SW
    // This prevents "Zap is not defined" crash from stale HTML+JS mismatch
    const clearAndReload = async () => {
      try {
        // 1. Delete ALL browser caches
        if ('caches' in window) {
          const names = await caches.keys();
          for (const name of names) {
            console.log('[ErrorBoundary] Purging cache:', name);
            await caches.delete(name);
          }
        }
        // 2. Unregister ALL service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            console.log('[ErrorBoundary] Unregistering SW:', reg.scope);
            await reg.unregister();
          }
        }
        // 3. Keep user data (habits, settings, notes cache) in localStorage —
        // wiping it on error screens used to silently delete saved data.
        // Cache + SW purge above is enough to fix stale-JS crashes.
        console.log('[ErrorBoundary] Caches cleared, SW unregistered. Reloading...');
      } catch (e) {
        console.warn('[ErrorBoundary] Cache clear failed:', e);
      }
      
      // Force hard reload - bypass any remaining cache
      window.location.href = window.location.origin + '/?fresh=' + Date.now();
    };
    
    clearAndReload();
  };

  private handleGoHome = () => {
    // Same cache-clear logic before going home
    this.handleReload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMsg = this.state.error?.message || 'Unknown error';
      const errorStack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Kuch gadbad ho gayi! 😅
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Don't worry — tumhare notes safe hain! Ye temporary issue hai.
            </p>

            {/* Error details — only in dev mode */}
            {isDev && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-left">
                <p className="text-xs font-mono text-red-600 break-words font-bold mb-2">
                  {errorMsg}
                </p>
                {componentStack && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-red-400 cursor-pointer">Component Stack</summary>
                    <pre className="text-[10px] text-red-400 mt-1 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{componentStack}</pre>
                  </details>
                )}
                {errorStack && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-red-400 cursor-pointer">Error Stack</summary>
                    <pre className="text-[10px] text-red-400 mt-1 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{errorStack}</pre>
                  </details>
                )}
              </div>
            )}

            {/* Production: show simple error ID for support */}
            {!isDev && errorMsg && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <p className="text-xs text-gray-500">
                  Error ID: <span className="font-mono font-bold">{btoa(errorMsg).substring(0, 12)}</span>
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                Reload
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              NikNote will be back in a moment ✍️
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
