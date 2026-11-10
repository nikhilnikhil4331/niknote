// Service worker registration. The worker owns cache versioning and removes
// obsolete caches during its activate event; the app must not unregister it or
// delete its current cache on every page load.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      void registration.update().catch(() => undefined);
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.info('NikNote service worker updated.');
          }
        });
      });
    })
    .catch((error) => {
      console.warn('NikNote service worker registration failed (non-critical):', error);
    });
}

// Unregister service workers only when explicitly requested, e.g. by a local
// development utility. Normal app startup always follows the update lifecycle.
export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  }
}
