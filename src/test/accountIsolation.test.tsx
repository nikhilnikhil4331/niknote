import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  current: null as { user: { id: string } | null; isGuest: boolean } | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useOptionalAuth: () => authMock.current,
  useAuth: () => authMock.current || { user: null, isGuest: true },
}));

import { useLocalStore } from '@/components/desktop/store';
import { RoutineProvider, useRoutine } from '@/components/habits/RoutineProvider';
import { useFlashcards } from '@/hooks/useFlashcards';
import { ownerScopedStorageKey, copyGuestDeviceDataToOwner } from '@/lib/ownerScopedStorage';
import { loadNikAIMemory, addManualMemoryFact } from '@/lib/nikaiMemory';
import { readCustomAIKeys, saveCustomAIKeys } from '@/lib/aiEngine';
import { readState, saveState, seedState, stateKey } from '@/lib/routineStore';

const OWNER_A = '123e4567-e89b-42d3-a456-426614174000';
const OWNER_B = '223e4567-e89b-42d3-a456-426614174001';
const GUEST_ID = 'local-guest-device-a';
const DESKTOP_TASKS_KEY = 'niknote.desktop.tasks.v1';

describe('account separation for device-backed personal stores', () => {
  beforeEach(() => {
    localStorage.clear();
    authMock.current = { user: { id: OWNER_A }, isGuest: false };
  });

  it('keeps legacy device keys intact while copying only during explicit offline-guest promotion', () => {
    const moneyKey = 'niknote.money.v1.local';
    const aiMemoryKey = 'niknote.nikai.memory.v1';
    const existingOwnerMoney = ownerScopedStorageKey(moneyKey, OWNER_B);
    localStorage.setItem(moneyKey, JSON.stringify({ txs: [{ id: 'device-row' }] }));
    localStorage.setItem(aiMemoryKey, JSON.stringify({ facts: [{ text: 'device memory' }] }));
    localStorage.setItem(existingOwnerMoney, JSON.stringify({ txs: [{ id: 'already-owned' }] }));
    localStorage.setItem(DESKTOP_TASKS_KEY, JSON.stringify([{ id: 'guest-task' }]));
    localStorage.setItem('niknote.desktop.sidebar', '1');
    localStorage.setItem('niknote.desktop.notesView', 'calendar');
    localStorage.setItem('niknote.desktop.homeNotesView', 'list');

    const originalMoney = localStorage.getItem(moneyKey);
    const originalMemory = localStorage.getItem(aiMemoryKey);
    expect(copyGuestDeviceDataToOwner(OWNER_B)).toBe(0);
    expect(localStorage.getItem(ownerScopedStorageKey(DESKTOP_TASKS_KEY, OWNER_B))).toBeNull();
    expect(localStorage.getItem(ownerScopedStorageKey('niknote.desktop.notesView', OWNER_B))).toBeNull();

    const copied = copyGuestDeviceDataToOwner(OWNER_B, GUEST_ID);
    expect(copied).toBeGreaterThan(0);
    expect(localStorage.getItem(moneyKey)).toBe(originalMoney);
    expect(localStorage.getItem(aiMemoryKey)).toBe(originalMemory);
    expect(JSON.parse(localStorage.getItem(existingOwnerMoney) || 'null')).toEqual({ txs: [{ id: 'already-owned' }] });
    expect(JSON.parse(localStorage.getItem(ownerScopedStorageKey(DESKTOP_TASKS_KEY, OWNER_B)) || 'null')).toEqual([{ id: 'guest-task' }]);
    expect(localStorage.getItem(ownerScopedStorageKey('niknote.desktop.sidebar', OWNER_B))).toBe('1');
    expect(localStorage.getItem(ownerScopedStorageKey('niknote.desktop.homeNotesView', OWNER_B))).toBe('list');

    authMock.current = { user: { id: OWNER_B }, isGuest: false };
    const { result: ownerView } = renderHook(() => useLocalStore<string>('niknote.desktop.notesView', 'table'));
    expect(ownerView.current[0]).toBe('calendar');
  });

  it('keeps desktop local-store values separate and switches without writing the old account into the new key', () => {
    localStorage.setItem(ownerScopedStorageKey(DESKTOP_TASKS_KEY, OWNER_A), JSON.stringify(['A task']));
    localStorage.setItem(ownerScopedStorageKey(DESKTOP_TASKS_KEY, OWNER_B), JSON.stringify(['B task']));
    const { result, rerender } = renderHook(() => useLocalStore<string[]>(DESKTOP_TASKS_KEY, []));

    expect(result.current[0]).toEqual(['A task']);
    act(() => result.current[1](['A task edited']));
    authMock.current = { user: { id: OWNER_B }, isGuest: false };
    rerender();

    expect(result.current[0]).toEqual(['B task']);
    act(() => result.current[1]((previous) => [...previous, 'B only']));
    expect(JSON.parse(localStorage.getItem(ownerScopedStorageKey(DESKTOP_TASKS_KEY, OWNER_A)) || 'null')).toEqual(['A task edited']);
    expect(JSON.parse(localStorage.getItem(ownerScopedStorageKey(DESKTOP_TASKS_KEY, OWNER_B)) || 'null')).toEqual(['B task', 'B only']);
    expect(localStorage.getItem(DESKTOP_TASKS_KEY)).toBeNull();
  });

  it('isolates routine tracker caches and does not persist the previous owner state after a switch', async () => {
    const stateA = seedState();
    stateA.habits = [{ ...stateA.habits[0], id: 'owner-a-habit', name: 'Owner A habit' }];
    stateA.entries = {};
    const stateB = seedState();
    stateB.habits = [{ ...stateB.habits[0], id: 'owner-b-habit', name: 'Owner B habit' }];
    stateB.entries = {};
    saveState(OWNER_A, stateA);
    saveState(OWNER_B, stateB);

    const wrapper = ({ children }: { children: ReactNode }) => <RoutineProvider>{children}</RoutineProvider>;
    const { result, rerender } = renderHook(() => useRoutine(), { wrapper });
    expect(result.current.state.habits.map((habit) => habit.name)).toEqual(['Owner A habit']);

    authMock.current = { user: { id: OWNER_B }, isGuest: false };
    rerender();
    await waitFor(() => expect(result.current.state.habits.map((habit) => habit.name)).toEqual(['Owner B habit']));
    await waitFor(() => expect(readState(OWNER_B)?.habits.map((habit) => habit.name)).toEqual(['Owner B habit']));
    expect(readState(OWNER_A)?.habits.map((habit) => habit.name)).toEqual(['Owner A habit']);
    expect(stateKey(OWNER_A)).not.toBe(stateKey(OWNER_B));
  });

  it('scopes NikAI memory, custom credentials, and flashcard review scheduling by owner', () => {
    addManualMemoryFact('Private to owner A', 'custom', OWNER_A);
    saveCustomAIKeys({ larprouterKey: 'owner-a-key' }, OWNER_A);

    const { result: flashcardsA } = renderHook(() => useFlashcards(OWNER_A));
    act(() => flashcardsA.current.rate('card-1', 'good'));
    const { result: flashcardsB } = renderHook(() => useFlashcards(OWNER_B));

    expect(loadNikAIMemory(OWNER_A).facts.map((fact) => fact.text)).toContain('Private to owner A');
    expect(loadNikAIMemory(OWNER_B).facts).toEqual([]);
    expect(readCustomAIKeys(OWNER_A).larprouterKey).toBe('owner-a-key');
    expect(readCustomAIKeys(OWNER_B)).toEqual({});
    expect(flashcardsA.current.all['card-1']?.reps).toBe(1);
    expect(flashcardsB.current.all).toEqual({});
  });

  it('leaves guest/device keys unchanged for non-cloud identities', () => {
    expect(ownerScopedStorageKey(DESKTOP_TASKS_KEY, undefined)).toBe(DESKTOP_TASKS_KEY);
    expect(ownerScopedStorageKey(DESKTOP_TASKS_KEY, GUEST_ID)).toBe(DESKTOP_TASKS_KEY);
  });
});
