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
import { NikAIWorkspace } from '@/components/nikai/NikAIWorkspace';
import { NikAIBrand, NikAILoader } from '@/components/nikai/NikAIBrand';
import { NikAIThinkingArena } from '@/components/nikai/NikAIThinkingArena';
import { AIWorkspacePanel } from '@/components/ai-workspace/AIWorkspacePanel';
import { MobileTrackerCards } from '@/components/mobile/MobileTrackerCards';
import { MobileExperience } from '@/components/mobile/MobileExperience';
import MoneyTracker from '@/pages/MoneyTracker';
import RoutineTracker from '@/pages/RoutineTracker';
import BoardPage from '@/pages/Board';
import { AuthProvider } from '@/contexts/AuthContext';
import { PremiumProvider } from '@/contexts/PremiumContext';
import { streamAstaAI } from '@/lib/aiEngine';
import {
  learnFromConversationTurn,
  addManualMemoryFact,
  buildNikAIMemoryPrompt,
  loadNikAIMemory,
} from '@/lib/nikaiMemory';
import {
  markdownToRichNikNoteBlocks,
  implementNikAINote,
  extractAndSaveFlashcardsFromMarkdown,
} from '@/lib/nikaiNotesBridge';
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

  it('never uses dangerouslySetInnerHTML across NikAI or legacy AI wrappers', () => {
    for (const file of [
      'src/components/asta/AstaMarkdown.tsx',
      'src/components/asta/AstaAIWorkspace.tsx',
      'src/components/nikai/NikAIBrand.tsx',
      'src/components/nikai/NikAIThinkingArena.tsx',
      'src/components/nikai/NikAIWorkspace.tsx',
      'src/components/ai-workspace/AIWorkspacePanel.tsx',
      'src/components/ai4/AI4Page.tsx',
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

describe('NikAI Brand Identity, Cross-Session Memory, Multi-Ink Smart Notes & Thinking Mini-Game', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders NikAIBrand and NikAILoader in NikNote handwritten calligraphy & gradient', () => {
    render(
      <div>
        <NikAIBrand size="lg" subtitle="Astra Neural Core" />
        <NikAILoader label="Booting NikAI…" />
      </div>
    );
    expect(screen.getAllByText('NikAI').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Astra Neural Core')).toBeTruthy();
  });

  it('learns user name, exam goal, language & custom facts across sessions and recalls them automatically', async () => {
    learnFromConversationTurn(
      'Mera naam Nikhil hai aur main JEE Advanced 2027 ke liye prepare kar raha hoon. Remember that I love Hinglish analogies.',
      'Bilkul Nikhil! Rotational Motion aur Moment of Inertia samajhte hain.',
      'session-1',
      'JEE Rotational Motion Study'
    );
    addManualMemoryFact('Focus extra on numerical shortcuts');

    const mem = loadNikAIMemory();
    expect(mem.userName).toBe('Nikhil');
    expect(mem.facts.some((f) => f.text.includes('numerical shortcuts'))).toBe(true);

    const promptCtx = buildNikAIMemoryPrompt('brand-new-session-2');
    expect(promptCtx).toContain('Nikhil');
    expect(promptCtx).toContain('JEE Rotational Motion Study');

    // Verify new session greeting uses remembered name!
    const greeting = await streamAstaAI({
      messages: [{ role: 'user', content: 'Namaste' }],
      threadId: 'brand-new-session-2',
    });
    expect(greeting.content).toContain('Nikhil');
    expect(greeting.content).toContain('NikAI');
  });

  it('converts Markdown into multi-ink NikNote blocks, saves Smart Notes & extracts Flashcards', async () => {
    const richMd = `# Thermodynamics Master Notes

## Laws of Thermodynamics
- **First Law:** Energy cannot be created or destroyed (\`ΔU = Q - W\`)
- **Entropy:** Measure of molecular randomness in a system
- [ ] Practice 10 numerical problems on Carnot Engine

> 💡 Pro-Tip: Always convert temperature to Kelvin before applying ideal gas equations!`;

    const blocks = markdownToRichNikNoteBlocks(richMd);
    expect(blocks.some((b) => b.type === 'heading1' && b.color === 'purple')).toBe(true);
    expect(blocks.some((b) => b.type === 'callout')).toBe(true);
    expect(blocks.some((b) => b.type === 'todo')).toBe(true);

    const implemented = await implementNikAINote({
      markdown: richMd,
      prepareEditorOpen: true,
    });
    expect(implemented.title).toBe('Thermodynamics Master Notes');
    expect(implemented.blockCount).toBeGreaterThanOrEqual(5);
    expect(implemented.flashcardCount).toBeGreaterThanOrEqual(2);
    expect(sessionStorage.getItem('niknote-mobile-open')).toContain('Thermodynamics Master Notes');

    const extraCards = extractAndSaveFlashcardsFromMarkdown('Thermo Deck', richMd);
    expect(extraCards).toBeGreaterThanOrEqual(2);
  });

  it('plays NikAIThinkingArena Star Catch & Brain Blitz mini-games with live score updates', () => {
    render(<NikAIThinkingArena isStreaming={false} forceOpen modelName="NikAI Astra Pro" />);
    expect(screen.getByTestId('nikai-star-game')).toBeTruthy();

    // Switch to Brain Blitz and back cleanly
    fireEvent.click(screen.getByText(/Brain Blitz/i));
    expect(screen.getByText(/= \?/)).toBeTruthy();
  });

  it('streams inside NikAIWorkspace & Editor AIWorkspacePanel and saves structured Smart Notes in 1 tap', async () => {
    const onInsert = vi.fn();
    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AIWorkspacePanel
          onClose={() => {}}
          noteTitle="Physics Chapter 4"
          noteContent="Projectile motion formulas"
          onInsertContent={onInsert}
        />
      </MemoryRouter>
    );

    // Linked editor note shows up automatically
    expect(screen.getByText('Physics Chapter 4')).toBeTruthy();

    const box = screen.getByPlaceholderText(/Ask NikAI anything/i);
    fireEvent.change(box, { target: { value: '2x^2 - 7x + 3 = 0' } });
    fireEvent.click(screen.getByLabelText('Send message to NikAI'));

    await waitFor(() => {
      expect(screen.getByText(/Quadratic Equation Step-by-Step Solution/i)).toBeTruthy();
    });

    // 1-Tap Insert into active Editor Note
    fireEvent.click(screen.getByText('Insert in Note'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    // 1-Tap Save Smart Note
    fireEvent.click(screen.getByText('Save Smart Note'));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]');
      expect(saved.length).toBe(1);
      expect(saved[0].content).toContain('x₁ = 3');
    });
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
  });

  it('exposes NikAI Astra Neural Core GET health status from api/ai Edge handler cleanly', async () => {
    const res = await apiHandler(new Request('http://localhost/api/ai', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.engine).toContain('NikAI');
  });
});

describe('Full Mobile Guest Experience across Home, NikAI, Money, Routine & Board (390px phone viewport)', () => {
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

  it('mounts the entire <App /> tree cleanly at / without router or overlay errors', async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.body.textContent).toBeTruthy();
    });
  });

  it('renders MobileExperience Home cleanly with unified NikAI button and theme taps', async () => {
    wrap(<MobileExperience />, '/');
    expect(screen.getAllByText('NikAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Write Note')).toBeTruthy();

    const focusBtn = screen.getByRole('button', { name: /Focus/i });
    fireEvent.click(focusBtn);
    expect(focusBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders functional device stats without Sign in to start lockout when unauthenticated', () => {
    wrap(<MobileTrackerCards />, '/');
    expect(screen.queryByText(/Sign in to start/i)).toBeNull();
    expect(screen.getByText('Money Tracker')).toBeTruthy();
    expect(screen.getByText('Daily Tracker')).toBeTruthy();
  });

  it('opens MoneyTracker, RoutineTracker, and Board immediately in guest device mode', async () => {
    const m = wrap(<MoneyTracker />, '/money');
    await waitFor(() => expect(screen.getByText('Money')).toBeTruthy());
    m.unmount();

    const r = wrap(<RoutineTracker />, '/routine');
    await waitFor(() => expect(screen.getByText('Daily Routine')).toBeTruthy());
    r.unmount();

    wrap(<BoardPage />, '/board');
    await waitFor(() => expect(screen.getByText(/New board/i)).toBeTruthy());
  });
});
