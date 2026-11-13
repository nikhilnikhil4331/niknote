import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NikAIWorkspace, type NikAIThread } from '@/components/nikai/NikAIWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { ownerScopedStorageKey } from '@/lib/ownerScopedStorage';
import { streamAstaAI, type AstaResult } from '@/lib/aiEngine';

const { streamMock, authState } = vi.hoisted(() => ({
  streamMock: vi.fn(),
  authState: {
    current: null as null | { user: { id: string } | null; isGuest: boolean; loading: boolean },
  },
}));

vi.mock('@/lib/aiEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/aiEngine')>();
  return { ...actual, streamAstaAI: streamMock };
});

vi.mock('@/contexts/AuthContext', () => ({
  useOptionalAuth: () => authState.current,
}));

const OWNER_A = '123e4567-e89b-42d3-a456-426614174000';
const OWNER_B = '223e4567-e89b-42d3-a456-426614174001';
const THREADS_KEY = 'niknote.nikai.threads.v2';

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <NikAIWorkspace />
    </MemoryRouter>,
  );
}

function mockAuthenticatedOwner(userId: string) {
  authState.current = { user: { id: userId }, isGuest: false, loading: false };
}

function waitForAbort(signal?: AbortSignal) {
  return new Promise<AstaResult>((_resolve, reject) => {
    const rejectAsAbort = () => reject(Object.assign(new Error('Generation stopped'), { name: 'AbortError' }));
    if (signal?.aborted) rejectAsAbort();
    else signal?.addEventListener('abort', rejectAsAbort, { once: true });
  });
}

beforeEach(() => {
  localStorage.clear();
  mockAuthenticatedOwner(OWNER_A);
  streamMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
    data: { session: null },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
});

describe('NikAI chat persistence and cancellation', () => {
  it('sends a prompt, renders the answer, and persists the complete thread under its owner', async () => {
    streamMock.mockResolvedValue({
      content: 'Answer from the mock provider',
      thinking: '',
      model: 'test-model',
      provider: 'mock',
      latencyMs: 12,
      followUps: [],
    } satisfies AstaResult);

    renderWorkspace();
    fireEvent.change(screen.getByPlaceholderText(/Ask NikAI anything/i), {
      target: { value: 'Explain inertia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message to NikAI' }));

    expect(await screen.findByText('Answer from the mock provider')).toBeInTheDocument();
    await waitFor(() => {
      const saved = localStorage.getItem(ownerScopedStorageKey(THREADS_KEY, OWNER_A));
      expect(saved).not.toBeNull();
      const threads = JSON.parse(saved || '[]') as NikAIThread[];
      expect(threads[0]?.messages.map(({ role, content }) => ({ role, content }))).toEqual([
        { role: 'user', content: 'Explain inertia' },
        { role: 'assistant', content: 'Answer from the mock provider' },
      ]);
    });

    expect(streamMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: OWNER_A,
      messages: [expect.objectContaining({ role: 'user', content: 'Explain inertia' })],
    }));
  });

  it('marks an aborted empty response as stopped instead of leaving a blank assistant bubble', async () => {
    streamMock.mockImplementation(({ signal }: { signal?: AbortSignal }) => waitForAbort(signal));

    renderWorkspace();
    fireEvent.change(screen.getByPlaceholderText(/Ask NikAI anything/i), {
      target: { value: 'Start a response and stop it' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message to NikAI' }));
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Stop generation' }));

    expect(await screen.findByText('Generation stopped before a response was received.')).toBeInTheDocument();
    await waitFor(() => {
      const saved = localStorage.getItem(ownerScopedStorageKey(THREADS_KEY, OWNER_A));
      const threads = JSON.parse(saved || '[]') as NikAIThread[];
      expect(threads[0]?.messages[1]).toMatchObject({ role: 'assistant', content: '', cancelled: true });
    });
  });

  it('preserves partial streamed text and labels it incomplete after cancellation', async () => {
    streamMock.mockImplementation(({ signal, onToken }: {
      signal?: AbortSignal;
      onToken?: (delta: string, fullText: string) => void;
    }) => {
      const response = waitForAbort(signal);
      onToken?.('Partial answer', 'Partial answer');
      return response;
    });

    renderWorkspace();
    fireEvent.change(screen.getByPlaceholderText(/Ask NikAI anything/i), {
      target: { value: 'Stream something' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message to NikAI' }));
    expect(await screen.findByText('Partial answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop generation' }));

    expect(await screen.findByText('Generation stopped. This response may be incomplete.')).toBeInTheDocument();
    await waitFor(() => {
      const saved = localStorage.getItem(ownerScopedStorageKey(THREADS_KEY, OWNER_A));
      const threads = JSON.parse(saved || '[]') as NikAIThread[];
      expect(threads[0]?.messages[1]).toMatchObject({ content: 'Partial answer', cancelled: true });
    });
  });

  it('does not load one account’s stored chats for another account', () => {
    const ownerAThreads: NikAIThread[] = [{
      id: 'private-thread',
      title: 'Owner A private thread',
      mode: 'auto',
      updatedAt: Date.now(),
      messages: [{
        id: 'private-message',
        role: 'user',
        content: 'Private message for owner A',
        createdAt: Date.now(),
      }],
    }];
    localStorage.setItem(ownerScopedStorageKey(THREADS_KEY, OWNER_A), JSON.stringify(ownerAThreads));
    mockAuthenticatedOwner(OWNER_B);

    renderWorkspace();

    expect(screen.queryByText('Private message for owner A')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(ownerScopedStorageKey(THREADS_KEY, OWNER_B)) || 'null')).toEqual([]);
  });
});
