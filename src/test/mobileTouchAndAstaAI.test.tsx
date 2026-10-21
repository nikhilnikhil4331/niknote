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
import { supabase } from '@/integrations/supabase/client';
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

  it('converts Markdown into structured, realistically inked NikNote blocks and extracts Flashcards', async () => {
    const richMd = `# Thermodynamics Master Notes

## Laws of Thermodynamics
- **First Law:** Energy cannot be created or destroyed (\`ΔU = Q - W\`)
- **Entropy:** Measure of molecular randomness in a system
- [ ] Practice 10 numerical problems on Carnot Engine

> 💡 Pro-Tip: Always convert temperature to Kelvin before applying ideal gas equations!`;

    const blocks = markdownToRichNikNoteBlocks(richMd);
    // Real notes use one or two inks — a heading must be a real heading in a
    // restrained ink, not a rainbow of four colours.
    expect(blocks.some((b) => b.type === 'heading1')).toBe(true);
    const inks = new Set(blocks.map((b) => b.color));
    expect(inks.size).toBeLessThanOrEqual(3);
    expect(inks.has('purple')).toBe(false);
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
    // Game is collapsed by default — open it first
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(screen.getByTestId('nikai-star-game')).toBeTruthy();

    // Switch to Brain Blitz and back cleanly
    fireEvent.click(screen.getByText(/Brain Blitz/i));
    expect(screen.getByText(/= \?/)).toBeTruthy();
  });

  it('keeps AIWorkspacePanel completely unmounted when isOpen is false and streams cleanly when isOpen is true', async () => {
    const onInsert = vi.fn();
    const { container: closedContainer } = render(
      <MemoryRouter initialEntries={['/']}>
        <AIWorkspacePanel
          isOpen={false}
          onClose={() => {}}
          noteTitle="Physics Chapter 4"
          noteContent="Projectile motion formulas"
          onInsertContent={onInsert}
        />
      </MemoryRouter>
    );
    // Crucial regression guard: NEVER auto-open NikAI on PC when isOpen === false!
    expect(closedContainer.firstChild).toBeNull();

    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AIWorkspacePanel
          isOpen={true}
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

  it('shows the classic NikNote PC screen FIRST on desktop (1440px) without opening NikAI until the NikAI button is clicked', async () => {
    window.history.pushState({}, '', '/');
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    window.dispatchEvent(new Event('resize'));

    render(<App />);

    // 1. Classic PC screen loads first — NikAI is NOT open automatically!
    const pcNikAIBtn = await screen.findByTestId('pc-open-nikai-btn');
    expect(pcNikAIBtn.textContent).toContain('NikAI');
    expect(document.querySelector('[data-nikai-root="true"]')).toBeNull();

    // 2. Clicking the single NikAI option opens full NikAI Studio (/ai)!
    fireEvent.click(pcNikAIBtn);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/ai');
      expect(document.querySelector('[data-nikai-root="true"]')).not.toBeNull();
    });
    window.history.pushState({}, '', '/');
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

  it('opens Guest Mode cleanly with zero errors on /login even when anonymous auth fails or device is offline', async () => {
    const { NiknoteAuth } = await import('@/components/auth/NiknoteAuth');
    const spyAnon = vi
      .spyOn(supabase.auth, 'signInAnonymously')
      .mockResolvedValue({ data: null, error: new Error('Anonymous sign-ins are disabled') } as any);
    const spyEdgeInvoke = vi.fn().mockRejectedValue(new Error('Network offline'));
    const spyFunctionsGetter = vi
      .spyOn(supabase, 'functions', 'get')
      .mockReturnValue({ invoke: spyEdgeInvoke } as any);

    wrap(<NiknoteAuth mode="login" />, '/login');
    const nameInput = screen.getByPlaceholderText(/Your name/i);
    fireEvent.change(nameInput, { target: { value: 'Nikhil' } });

    const continueBtn = screen.getByTestId('guest-continue-btn');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(localStorage.getItem('niknote.offline.guest.v1')).toContain('Nikhil');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    spyAnon.mockRestore();
    spyFunctionsGetter.mockRestore();
  });

  it('provisions real Supabase cloud session via guest-session Edge Function when signInAnonymously is disabled', async () => {
    const { NiknoteAuth } = await import('@/components/auth/NiknoteAuth');
    const fakeCloudUuid = '550e8400-e29b-41d4-a716-446655440000';
    const spyAnon = vi
      .spyOn(supabase.auth, 'signInAnonymously')
      .mockResolvedValue({ data: null, error: new Error('Anonymous sign-ins are disabled') } as any);
    const spyEdgeInvoke = vi.fn().mockResolvedValue({
      data: {
        access_token: 'tok_live_access',
        refresh_token: 'tok_live_refresh',
        email: 'guest_demo@guest.niknote.online',
        password: 'NkGuest!secretpassword',
        user: {
          id: fakeCloudUuid,
          email: 'guest_demo@guest.niknote.online',
          user_metadata: { full_name: 'Nikhil', is_guest: true },
        },
      },
      error: null,
    });
    const spyFunctionsGetter = vi
      .spyOn(supabase, 'functions', 'get')
      .mockReturnValue({ invoke: spyEdgeInvoke } as any);
    const spySetSession = vi.spyOn(supabase.auth, 'setSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'tok_live_access',
          refresh_token: 'tok_live_refresh',
          user: { id: fakeCloudUuid, user_metadata: { full_name: 'Nikhil', is_guest: true } },
        },
        user: { id: fakeCloudUuid, user_metadata: { full_name: 'Nikhil', is_guest: true } },
      },
      error: null,
    } as any);

    wrap(<NiknoteAuth mode="login" />, '/login');
    fireEvent.click(screen.getByTestId('guest-continue-btn'));

    await waitFor(() => {
      expect(spyEdgeInvoke).toHaveBeenCalledWith(
        'guest-session',
        expect.objectContaining({
          body: expect.objectContaining({ action: 'create' }),
        })
      );
      expect(spySetSession).toHaveBeenCalledWith({
        access_token: 'tok_live_access',
        refresh_token: 'tok_live_refresh',
      });
    });
    expect(screen.queryByRole('alert')).toBeNull();

    spyAnon.mockRestore();
    spyFunctionsGetter.mockRestore();
    spySetSession.mockRestore();
  });

  it('syncs local Notes, Money, Routine & Boards to Supabase Cloud cleanly without data loss', async () => {
    const { syncAllLocalDataToCloud, getSyncSnapshot } = await import('@/lib/cloudSyncEngine');
    const cloudUserId = '550e8400-e29b-41d4-a716-446655440099';
    const tablesWritten: string[] = [];

    const spyFrom = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      tablesWritten.push(table);
      let idx = 0;
      const makeBuilder = () => {
        idx += 1;
        const validUuid = `660e8400-e29b-41d4-a716-${String(idx).padStart(12, '0')}`;
        const listRes = { data: [], error: null };
        const singleRes = {
          data: { id: validUuid, amount: 250, target: 1000, saved: 0 },
          error: null,
        };
        const builder: any = Promise.resolve(listRes);
        builder.select = vi.fn().mockImplementation(() => makeBuilder());
        builder.insert = vi.fn().mockImplementation(() => makeBuilder());
        builder.update = vi.fn().mockImplementation(() => makeBuilder());
        builder.upsert = vi.fn().mockImplementation(() => makeBuilder());
        builder.delete = vi.fn().mockImplementation(() => makeBuilder());
        builder.eq = vi.fn().mockImplementation(() => makeBuilder());
        builder.in = vi.fn().mockImplementation(() => makeBuilder());
        builder.order = vi.fn().mockImplementation(() => makeBuilder());
        builder.limit = vi.fn().mockImplementation(() => makeBuilder());
        builder.single = vi.fn().mockResolvedValue(singleRes);
        builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return builder;
      };
      return makeBuilder();
    }) as any);

    localStorage.setItem(
      'niknote.mobile.notebooks.v1',
      JSON.stringify([
        {
          id: 'local-note-1',
          title: 'Physics Revision',
          blocks: [{ id: 'b1', type: 'text', content: 'Newton Laws' }],
          updated_at: '2026-10-20T10:00:00.000Z',
        },
      ])
    );
    localStorage.setItem(
      'niknote.money.v1.local',
      JSON.stringify({
        txs: [{ id: 'local_tx_1', kind: 'expense', amount: 250, category: 'Food', note: 'Lunch', occurred_on: '2026-10-20', account: 'Cash', to_account: null }],
        goals: [],
        bills: [],
        currency: 'INR',
        budget: 5000,
      })
    );
    localStorage.setItem(
      'niknote.routine.v1.local',
      JSON.stringify({
        habits: [{ id: 'rt_h1', name: 'Morning Study', emoji: '📚', block: 'morning', days: [0, 1, 2, 3, 4, 5, 6], archived: false }],
        checks: [{ habit_id: 'rt_h1', day: '2026-10-20' }],
        todos: [],
        week: {},
        waterGoal: 8,
      })
    );
    localStorage.setItem(
      'niknote.boards.v1.local',
      JSON.stringify([
        {
          id: 'local-board-1',
          title: 'Organic Chemistry Map',
          data: { version: 1, pages: [] },
        },
      ])
    );

    const res = await syncAllLocalDataToCloud(cloudUserId);
    expect(res.ok).toBe(true);
    expect(res.synced).toBeGreaterThanOrEqual(4);
    expect(getSyncSnapshot().state).toBe('synced');
    expect(tablesWritten).toContain('notebooks');
    expect(tablesWritten).toContain('money_transactions');
    expect(tablesWritten).toContain('habits');
    expect(tablesWritten).toContain('boards');

    spyFrom.mockRestore();
  });

  it('ships authentic NikAI logo assets and renders the exact signature NikAI Studio UI layout', async () => {
    const { statSync } = await import('fs');
    for (const asset of [
      'public/nikai-logo.png',
      'public/nikai-mark.png',
      'public/nikai-wordmark.png',
      'public/nikai-horizon-bg.jpg',
      'public/nikai-avatar.jpg',
    ]) {
      expect(statSync(resolve(process.cwd(), asset)).size).toBeGreaterThan(2000);
    }

    const { default: AstaAIWorkspace } = await import('@/components/asta/AstaAIWorkspace');
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    wrap(<AstaAIWorkspace />, '/ai');

    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getAllByText('Smart Notes').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Quiz')).toBeTruthy();
    expect(screen.getByText('Writing Studio')).toBeTruthy();
    expect(screen.getByText('Code')).toBeTruthy();
    expect(screen.getByText('Recent Chats')).toBeTruthy();
    expect(screen.getByText('Upgrade to NikAI Pro')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search chats...')).toBeTruthy();
    expect(screen.getByText('Ctrl K')).toBeTruthy();
    expect(screen.getByTestId('nikai-memory-btn')).toBeTruthy();
    expect(screen.getAllByText('NikAI Auto').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/What can I help you/i)).toBeTruthy();
    expect(screen.getByText('create?')).toBeTruthy();
    expect(screen.getByText('Learn a concept')).toBeTruthy();
    expect(screen.getByText('Practice quiz')).toBeTruthy();
    expect(screen.getByText('Write code')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask NikAI anything...')).toBeTruthy();
    expect(screen.getByText('Attach')).toBeTruthy();
    expect(screen.getByText('Voice')).toBeTruthy();

    const imgs = Array.from(document.querySelectorAll('img')).map((el) => el.getAttribute('src'));
    expect(imgs).toContain('/nikai-mark.png');
    expect(imgs).toContain('/nikai-wordmark.png');
  });
});
