// ============================================================
// Toast Notification System — Simple, lightweight, no external lib
// Usage: toast.success("Note saved!") / toast.error("Export failed")
// ============================================================

import { createRoot } from 'react-dom/client';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

// ============================================================
// Types
// ============================================================
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// ============================================================
// Toast Container State
// ============================================================
let toastContainer: HTMLDivElement | null = null;
let toastRoot: any = null;
let currentToasts: ToastItem[] = [];
let updateCallback: ((toasts: ToastItem[]) => void) | null = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'niknote-toast-container';
    document.body.appendChild(toastContainer);
    toastRoot = createRoot(toastContainer);
  }
  return { container: toastContainer, root: toastRoot };
}

function notifyUpdate() {
  if (updateCallback) {
    updateCallback([...currentToasts]);
  }
}

function addToast(type: ToastType, message: string, duration = 3500) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  currentToasts = [...currentToasts, { id, type, message, duration }];
  notifyUpdate();

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

function removeToast(id: string) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  notifyUpdate();
}

// ============================================================
// Toast UI Component
// ============================================================
const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-[color:hsl(var(--success)/0.14)] border-[color:hsl(var(--success)/0.4)] text-success dark:bg-success/20 dark:border-[color:hsl(var(--success)/0.4)] dark:text-success',
  error: 'bg-[color:hsl(var(--error)/0.14)] border-[color:hsl(var(--error)/0.4)] text-error dark:bg-error/20 dark:border-[color:hsl(var(--error)/0.4)] dark:text-error',
  warning: 'bg-[color:hsl(var(--accent-warm-hsl)/0.16)] border-[color:hsl(var(--accent-warm-hsl)/0.34)] text-accent-warm dark:bg-nk-warm-600/20 dark:border-[color:hsl(var(--accent-warm-hsl)/0.34)] dark:text-accent-warm',
  info: 'bg-[color:hsl(var(--accent-cool-hsl)/0.14)] border-[color:hsl(var(--accent-cool-hsl)/0.35)] text-accent-cool dark:bg-[color:hsl(var(--accent-cool-hsl)/0.2)] dark:border-[color:hsl(var(--accent-cool-hsl)/0.35)] dark:text-accent-cool',
};

const iconColorMap = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-accent-warm',
  info: 'text-accent-cool',
};

function ToastDisplay() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    updateCallback = setToasts;
    return () => { updateCallback = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-spring-in ${colorMap[toast.type]}`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${iconColorMap[toast.type]}`} />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-0.5 rounded-md hover:bg-surface-hover dark:hover:bg-surface/10 transition-colors"
            >
              <X className="w-3.5 h-3.5 opacity-50" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Initialize the toast container
function initToasts() {
  const { root } = getContainer();
  root.render(<ToastDisplay />);
}

// Auto-init on first import
if (typeof window !== 'undefined') {
  // Delay to ensure DOM is ready
  setTimeout(initToasts, 100);
}

// ============================================================
// Public API
// ============================================================
export const toast = {
  success: (message: string, duration?: number) => addToast('success', message, duration),
  error: (message: string, duration?: number) => addToast('error', message, duration),
  warning: (message: string, duration?: number) => addToast('warning', message, duration),
  info: (message: string, duration?: number) => addToast('info', message, duration),
  
  // Custom duration helpers
  persistent: (type: ToastType, message: string) => addToast(type, message, 0),
  
  // Common presets
  saved: () => addToast('success', 'Note saved ✅'),
  exported: () => addToast('success', 'PDF exported successfully 📄'),
  copied: () => addToast('success', 'Copied to clipboard 📋'),
  deleted: () => addToast('success', 'Deleted successfully 🗑️'),
  
  networkError: () => addToast('error', 'Network error. Check your connection. 🔌'),
  exportFailed: () => addToast('error', 'Export failed. Please try again. ❌'),
  saveFailed: () => addToast('error', 'Failed to save. Retrying... 🔄'),
  
  premiumFeature: () => addToast('info', '✨ This is a premium feature. Upgrade to unlock!', 4000),
};
