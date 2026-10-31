import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/theme.css";
import "./index.css";

// Ensure any legacy cached service workers (< v8.1.0) update & purge stale bundles immediately
const ACTIVE_SW_RELEASE = 'v8.1.0';
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

// Defer non-critical handwriting font families until after initial paint (CSP-safe, no inline handlers)
const SECONDARY_HANDWRITING_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Covered+By+Your+Grace&family=Dancing+Script:wght@400;500;600;700&family=Gloria+Hallelujah&family=Handlee&family=Homemade+Apple&family=Indie+Flower&family=La+Belle+Aurore&family=Mali:wght@400;500;600&family=Nothing+You+Could+Do&family=Patrick+Hand&family=Permanent+Marker&family=Reenie+Beanie&family=Rock+Salt&family=Sacramento&family=Satisfy&family=Shadows+Into+Light&display=swap';

if (typeof document !== 'undefined') {
  const loadDeferredFonts = () => {
    if (document.getElementById('niknote-deferred-fonts')) return;
    const link = document.createElement('link');
    link.id = 'niknote-deferred-fonts';
    link.rel = 'stylesheet';
    link.href = SECONDARY_HANDWRITING_FONTS_URL;
    document.head.appendChild(link);
  };
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(loadDeferredFonts);
  } else {
    setTimeout(loadDeferredFonts, 1200);
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
