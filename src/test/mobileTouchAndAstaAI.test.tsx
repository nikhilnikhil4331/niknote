import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { TouchHealthGuard } from '@/components/mobile/TouchHealthGuard';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';
import { AstaAIWorkspace } from '@/components/asta/AstaAIWorkspace';
import { MobileTrackerCards } from '@/components/mobile/MobileTrackerCards';
import { MobileExperience } from '@/components/mobile/MobileExperience';
import MoneyTracker from '@/pages/MoneyTracker';
import RoutineTracker from '@/pages/RoutineTracker';
import BoardPage from '@/pages/Board';
import { AuthProvider } from '@/contexts/AuthContext';
import { PremiumProvider } from '@/contexts/PremiumContext';
import { streamAstaAI } from '@/lib/aiEngine';
import apiHandler from '../../api/ai';

describe('Mobile touch & pointer-event invariants', () => {
  it('never disables pointer-events on fixed overlays or locks touch-action on canvases in src/index.css', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).not.toMatch(/pointer-events:\s*none\s*!important/);
    expect(css).not.toMatch(/touch-action:\s*manipulation\s*!important/);
  });

  it('keeps ToastViewport pointer-events-none so empty toast containers never swallow taps', () => {
    const toastSrc = readFileSync(resolve(process.cwd(), 'src/components/ui/toast.tsx'), 'utf8');
    expect(toastSrc).toContain('pointer-events-none');
  });

  it('positions mobile chat input safely above the 80px bottom navigation dock', () => {
    const mobileCss = readFileSync(resolve(process.cwd(), 'src/components/mobile/mobile.css'), 'utf8');
    expect(mobileCss).toContain('bottom:calc(90px + env(safe-area-inset-bottom))');
  });

  it('never uses dangerouslySetInnerHTML in Asta AI components', () => {
    for (const file of [
      'src/components/asta/AstaMarkdown.tsx',
      'src/components/asta/AstaAIWorkspace.tsx',
    ]) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src).not.toMatch(/dangerouslySetInnerHTML\s*=\s*\{\{/);
    }
  });
});

describe('TouchHealthGuard runtime body-lock recovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
  });

  it('immediately clears stale body pointer-events:none on touch/pointerdown when no modal is open', () => {
    render(<TouchHealthGuard />);
    document.body.style.pointerEvents = 'none';
    document.body.setAttribute('data-scroll-locked', '1');

    fireEvent.pointerDown(window);

    expect(document.body.style.pointerEvents).toBe('');
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('preserves body lock while an active dialog is genuinely open', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);

    render(<TouchHealthGuard />);
    document.body.style.pointerEvents = 'none';

    fireEvent.pointerDown(window);
    expect(document.body.style.pointerEvents).toBe('none');
    dialog.remove();
    document.body.style.pointerEvents = '';
  });
});

describe('Guest-first Mobile Tracker Tiles & Full App Shell', () => {
  it('mounts the entire <App /> tree cleanly at / without router or overlay errors', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    render(<App />);
    await waitFor(() => {
      expect(document.body.textContent).toBeTruthy();
    });
  });

  it('renders functional device stats without Sign in to start lockout when unauthenticated', () => {
    localStorage.clear();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter>
            <MobileTrackerCards />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByText(/Sign in to start/i)).toBeNull();
    expect(screen.getByText('Money Tracker')).toBeTruthy();
    expect(screen.getByText('Daily Tracker')).toBeTruthy();
  });
});

describe('Asta Ultra AI Engine, Interactive Quiz & Save-to-Notes', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('solves quadratic equations symbolically with exact roots and follow-up chips', async () => {
    const res = await streamAstaAI({
      messages: [{ role: 'user', content: '2x^2 - 7x + 3 = 0' }],
      mode: 'solver',
    });

    expect(res.content).toContain('x₁ = 3');
    expect(res.content).toContain('x₂ = 0.5');
    expect(res.followUps.length).toBeGreaterThanOrEqual(3);
  });

  it('renders interactive playable MCQ cards and updates score on tap', () => {
    const sampleQuiz = `## Quiz

### Q1. What is Newton's Second Law?
- A) F = m * a
- B) E = m * c^2
- C) V = I * R
- D) P = V * I
**Answer:** A
**Explanation:** Net force equals mass times acceleration.

### Q2. Which unit measures electric current?
- A) Volt
- B) Ampere
- C) Ohm
- D) Tesla
**Answer:** B
**Explanation:** Ampere is the SI base unit of electric current.`;

    render(<AstaMarkdown content={sampleQuiz} />);

    expect(screen.getByText(/Score: 0 \/ 2/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/F = m \* a/i));
    expect(screen.getByText(/Score: 1 \/ 2/i)).toBeTruthy();
    expect(screen.getByText(/Net force equals mass times acceleration/i)).toBeTruthy();
  });

  it('streams answers inside AstaAIWorkspace without requiring login and saves notes to localStorage', async () => {
    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AstaAIWorkspace />
      </MemoryRouter>
    );

    const box = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(box, { target: { value: '2x^2 - 7x + 3 = 0' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText(/Quadratic Equation Step-by-Step Solution/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Save to Notes'));
    const saved = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].content).toContain('x₁ = 3');
  });

  it('exposes GET health status from api/ai Edge handler cleanly', async () => {
    const res = await apiHandler(new Request('http://localhost/api/ai', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.providers).toBeDefined();
  });
});

describe('Full Mobile Guest Experience across Home, Money, Routine & Board (390px phone viewport)', () => {
  const wrap = (ui: React.ReactNode, initial = '/') => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <PremiumProvider>
            <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
          </PremiumProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders MobileExperience Home cleanly and responds to theme & quick action taps', async () => {
    wrap(<MobileExperience />, '/');
    expect(screen.getByText('Asta AI')).toBeTruthy();
    expect(screen.getByText('Write Note')).toBeTruthy();

    const focusBtn = screen.getByRole('button', { name: /Focus/i });
    fireEvent.click(focusBtn);
    expect(focusBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens MoneyTracker immediately in guest device mode without auth lockout', async () => {
    wrap(<MoneyTracker />, '/money');
    await waitFor(() => {
      expect(screen.queryByText(/Couldn't open your space/i)).toBeNull();
      expect(screen.getByText('Money')).toBeTruthy();
    });
  });

  it('opens RoutineTracker immediately in guest device mode without auth lockout', async () => {
    wrap(<RoutineTracker />, '/routine');
    await waitFor(() => {
      expect(screen.queryByText(/Couldn't open your space/i)).toBeNull();
      expect(screen.getByText('Daily Routine')).toBeTruthy();
    });
  });

  it('opens Board immediately in guest device mode and creates a local board on + New board tap', async () => {
    wrap(<BoardPage />, '/board');
    await waitFor(() => {
      expect(screen.queryByText(/Sign in to use Boards/i)).toBeNull();
      expect(screen.getByText(/New board/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/New board/i));
    await waitFor(() => {
      expect(screen.getByLabelText('Board title')).toBeTruthy();
    });
  });
});

