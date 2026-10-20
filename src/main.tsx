import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure any legacy cached service workers (< v8.0.0) update & purge stale bundles immediately
const ACTIVE_SW_RELEASE = 'v8.0.0';
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    if (localStorage.getItem('niknote.sw.release') !== ACTIVE_SW_RELEASE) {
      localStorage.setItem('niknote.sw.release', ACTIVE_SW_RELEASE);
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          void r.update();
        });
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((k) => {
            if (!k.includes(ACTIVE_SW_RELEASE)) {
              void caches.delete(k);
            }
          });
        }).catch(() => {});
      }
    }
  } catch {
    // ignore storage access issues in restricted contexts
  }
}

// Global error handlers — prevent mobile crashes from showing blank screen
window.addEventListener('error', (event) => {
  console.error('🔴 Global JS Error:', event.error?.message || event.message);
  event.preventDefault?.();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔴 Unhandled Promise Rejection:', event.reason);
  event.preventDefault?.();
});

createRoot(document.getElementById("root")!).render(<App />);
