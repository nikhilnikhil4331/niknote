// Guards for the first-visit pricing popup.
//
// The popup is the one thing on the site allowed to interrupt a visitor, so its
// suppression rules matter more than its looks. These tests pin the rules that
// would otherwise regress silently:
//   - never on checkout / the pricing page / auth / B2B / content routes
//   - never for someone who already pays
//   - at most once per session and once per week
//   - dismissal is remembered, so "Not now" means not now
//   - it only advertises features the editor actually locks

import React from 'react';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const premiumState = { isPremium: false, loading: false };

vi.mock('@/hooks/usePremium', () => ({
  usePremium: () => premiumState,
}));

// framer-motion drives its exit animations off requestAnimationFrame and a real
// clock, so under fake timers AnimatePresence never removes the closing dialog
// and these tests would assert on animation timing instead of on behaviour.
// Render the motion elements as plain host elements and make AnimatePresence a
// passthrough: what is conditional in React is then exactly what is on screen.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        React.forwardRef((props: Record<string, unknown>, ref) => {
          const {
            initial, animate, exit, transition, variants, whileHover, whileTap, layout, layoutId, ...rest
          } = props;
          return React.createElement(tag, { ...rest, ref });
        }),
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
  };
});

import { PricingPopup } from '@/components/premium/PricingPopup';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PricingPopup />
    </MemoryRouter>
  );

/** Advance past the 5s open delay, wrapped so React state updates flush. */
const waitForPopup = async () => {
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
};


describe('PricingPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    premiumState.isPremium = false;
    premiumState.loading = false;
    window.localStorage.clear();
    window.sessionStorage.clear();
    // The popup waits for the cookie choice, so most tests start from a visitor
    // who has already answered the consent banner.
    window.localStorage.setItem(
      'niknote_cookie_consent',
      JSON.stringify({ essential: true, analytics: false, marketing: false, timestamp: '2026-10-29T00:00:00.000Z' })
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not appear before the delay has elapsed', async () => {
    renderAt('/');
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('appears on the editor after the delay and shows the real prices', async () => {
    renderAt('/');
    await waitForPopup();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText('₹49')).toBeTruthy();
    expect(screen.getByText('₹99')).toBeTruthy();
    expect(screen.getByText(/No countdown, no fake discount/i)).toBeTruthy();
  });

  it('advertises only features the editor actually locks', async () => {
    renderAt('/');
    await waitForPopup();

    for (const gated of ['AI writing assistant', 'Voice dictation', 'AI style matcher', 'Handwriting import']) {
      expect(screen.getByText(gated)).toBeTruthy();
    }
    // These are free for everyone; selling them would be the old lie.
    expect(screen.queryByText(/Priority AI/i)).toBeNull();
    expect(screen.queryByText(/Unlimited Exports/i)).toBeNull();
    expect(screen.queryByText(/students already premium/i)).toBeNull();
  });

  it.each(['/payment', '/upgrade', '/login', '/schools', '/blog/how-to-convert-text-to-handwriting', '/account'])(
    'stays out of the way on %s',
    async (path) => {
      renderAt(path);
      await waitForPopup();
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  );

  it('waits for the cookie choice instead of stacking two prompts', async () => {
    window.localStorage.clear();
    renderAt('/');
    await waitForPopup();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Visitor answers the consent banner; the offer is then allowed through.
    await act(async () => {
      window.localStorage.setItem(
        'niknote_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, timestamp: '2026-10-29T00:00:00.000Z' })
      );
      window.dispatchEvent(new Event('niknote:consent-updated'));
    });
    await waitForPopup();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('never shows to someone who already subscribes', async () => {
    premiumState.isPremium = true;
    renderAt('/');
    await waitForPopup();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not show again in the same session', async () => {
    renderAt('/');
    await waitForPopup();
    expect(screen.getByRole('dialog')).toBeTruthy();

    cleanup();
    renderAt('/');
    await waitForPopup();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('remembers a dismissal so it does not reopen within the week', async () => {
    renderAt('/');
    await waitForPopup();

    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('niknote:pricing-popup:last-shown')).toBeTruthy();

    // New session, same browser, same day.
    cleanup();
    window.sessionStorage.clear();
    renderAt('/');
    await waitForPopup();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape', async () => {
    renderAt('/');
    await waitForPopup();
    expect(screen.getByRole('dialog')).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends the visitor to the plans page from the primary button', async () => {
    renderAt('/');
    await waitForPopup();
    fireEvent.click(screen.getByRole('button', { name: /see the plans/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('niknote:pricing-popup:last-shown')).toBeTruthy();
  });
});
