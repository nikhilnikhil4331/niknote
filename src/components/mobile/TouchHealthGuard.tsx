import { useEffect } from 'react';

const OPEN_MODAL_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[data-radix-dialog-content][data-state="open"]',
  '[data-radix-alert-dialog-content][data-state="open"]',
  '[data-vaul-drawer][data-state="open"]',
].join(', ');

function releaseStaleBodyLock() {
  if (typeof document === 'undefined') return;
  const anyOpenModal = document.querySelector(OPEN_MODAL_SELECTOR);
  if (anyOpenModal) return;

  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
  if (document.documentElement.style.pointerEvents === 'none') {
    document.documentElement.style.pointerEvents = '';
  }
  if (document.body.hasAttribute('data-scroll-locked')) {
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.body.style.marginRight = '';
  }
}

export function TouchHealthGuard() {
  useEffect(() => {
    const onTouchOrPointer = () => releaseStaleBodyLock();
    window.addEventListener('touchstart', onTouchOrPointer, { passive: true, capture: true });
    window.addEventListener('pointerdown', onTouchOrPointer, { passive: true, capture: true });
    window.addEventListener('popstate', onTouchOrPointer);
    document.addEventListener('visibilitychange', onTouchOrPointer);

    const interval = window.setInterval(releaseStaleBodyLock, 1200);
    return () => {
      window.removeEventListener('touchstart', onTouchOrPointer, true);
      window.removeEventListener('pointerdown', onTouchOrPointer, true);
      window.removeEventListener('popstate', onTouchOrPointer);
      document.removeEventListener('visibilitychange', onTouchOrPointer);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
