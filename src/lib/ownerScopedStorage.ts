/**
 * Account-specific browser storage for personal offline caches. Cloud owner IDs
 * are Supabase UUIDs; device/legacy guest keys remain unchanged unless the
 * active guest is explicitly promoted (see copyGuestDeviceDataToOwner).
 */
const CLOUD_OWNER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_PROMOTION_INTENT_KEY = 'niknote.guest.promotion.intent.v1';

export function beginGuestPromotionIntent(fromOwnerId: string): void {
  if (typeof window === 'undefined' || !fromOwnerId.startsWith('local-guest-')) return;
  try {
    localStorage.setItem(GUEST_PROMOTION_INTENT_KEY, JSON.stringify({ fromOwnerId, startedAt: Date.now() }));
  } catch {
    // The local guest source data remains untouched if storage is unavailable.
  }
}

export function readGuestPromotionIntent(): { fromOwnerId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_PROMOTION_INTENT_KEY) || 'null');
    if (!parsed?.fromOwnerId || !parsed?.startedAt || Date.now() - parsed.startedAt > 15 * 60_000) return null;
    return { fromOwnerId: String(parsed.fromOwnerId) };
  } catch {
    return null;
  }
}

export function clearGuestPromotionIntent(): void {
  try { localStorage.removeItem(GUEST_PROMOTION_INTENT_KEY); } catch { /* ignore */ }
}

export function ownerScopedStorageKey(baseKey: string, ownerId?: string | null): string {
  if (!ownerId || !CLOUD_OWNER_ID.test(ownerId)) return baseKey;
  return `${baseKey}:owner:${encodeURIComponent(ownerId)}`;
}

/**
 * Explicitly promote the current device guest's caches to its newly assigned
 * cloud UUID. Copies are non-destructive and only fill missing account keys;
 * the original legacy device data stays available as a recovery copy. This is
 * intentionally not called during an ordinary sign-in/account switch.
 */
export function copyGuestDeviceDataToOwner(ownerId: string, fromOwnerId?: string | null): number {
  // Raw device keys can contain legacy data from a different account. Only an
  // explicit promotion of the currently active offline guest may copy them.
  if (
    !ownerId ||
    !CLOUD_OWNER_ID.test(ownerId) ||
    !fromOwnerId?.startsWith('local-guest-') ||
    typeof window === 'undefined'
  ) return 0;

  const keys = [
    'niknote.money.v1.local',
    'niknote.routine.v1.local',
    'niknote.boards.v1.local',
    'niknote.sync.board_map.v1',
    'niknote.sync.notebook_map.v1',
    'niknote.nikai.threads.v2',
    'niknote.asta.threads.v2',
    'niknote.nikai.hidden_seeds.v1',
    'niknote.nikai.memory.v1',
    'niknote-flashcards-v1',
    'niknote_flashcard_reviews_v1',
    'niknote.ai.keys.v1',
    'niknote.nikai.highscore.v1',
    'niknote.desktop.tasks.v1',
    'niknote.desktop.sidebar',
    'niknote.desktop.notesView',
    'niknote.desktop.homeNotesView',
    'niknote.desktop.noteMeta.v1',
    'niknote.desktop.spaces.v1',
    'niknote.desktop.habits.v1',
    'niknote.desktop.focusSessions.v1',
    'niknote.desktop.sharedLinks.v1',
    'niknote.desktop.timerSettings.v1',
    'niknote.desktop.linkedTask.v1',
    'niknote.desktop.timerMode.v1',
    'niknote.desktop.timerState.v1',
  ];
  let copied = 0;
  const copyIfAbsent = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      const target = ownerScopedStorageKey(key, ownerId);
      if (raw === null || localStorage.getItem(target) !== null) return;
      localStorage.setItem(target, raw);
      copied++;
    } catch {
      // Keep the guest's original device data even if storage is unavailable.
    }
  };

  keys.forEach(copyIfAbsent);

  // The dedicated habit app uses a per-user key rather than the generic
  // owner-suffix convention. Promote its anon cache only when no destination
  // state exists, leaving the anon recovery source untouched.
  try {
    const anonHabitsKey = 'niknote.habits.v1.anon';
    const ownerHabitsKey = `niknote.habits.v1.${ownerId}`;
    const anonHabits = localStorage.getItem(anonHabitsKey);
    if (anonHabits !== null && localStorage.getItem(ownerHabitsKey) === null) {
      localStorage.setItem(ownerHabitsKey, anonHabits);
      copied++;
    }
  } catch {
    // The remaining stores can still be promoted independently.
  }

  // Board drafts are keyed by board ID and may exist outside the board list.
  // Copy them too, without replacing an owner-specific draft.
  try {
    const legacyDraftKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith('nn-board:') && !key.includes(':owner:')) legacyDraftKeys.push(key);
    }
    legacyDraftKeys.forEach(copyIfAbsent);
  } catch {
    // The named stores above are still copied if storage enumeration is blocked.
  }

  return copied;
}
