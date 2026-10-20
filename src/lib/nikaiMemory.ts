// ============================================================
// NikAI Persistent Cross-Session Memory Engine
// Remembers user identity, exam/course goals, language preference,
// pinned custom facts, studied topics, and past session summaries!
// ============================================================

export interface NikAIMemoryFact {
  id: string;
  category: 'identity' | 'goal' | 'preference' | 'topic' | 'custom';
  text: string;
  pinned?: boolean;
  updatedAt: number;
}

export interface NikAISessionDigest {
  threadId: string;
  title: string;
  summary: string;
  updatedAt: number;
}

export interface NikAIMemoryStore {
  userName?: string;
  preferredLanguage?: 'Hinglish' | 'English' | 'Hindi';
  examOrRole?: string;
  facts: NikAIMemoryFact[];
  recentTopics: string[];
  sessionDigests: NikAISessionDigest[];
}

const MEMORY_STORAGE_KEY = 'niknote.nikai.memory.v1';

const DEFAULT_STORE: NikAIMemoryStore = {
  facts: [],
  recentTopics: [],
  sessionDigests: [],
};

export function loadNikAIMemory(): NikAIMemoryStore {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    const parsed = JSON.parse(raw);
    return {
      userName: typeof parsed.userName === 'string' ? parsed.userName : undefined,
      preferredLanguage: parsed.preferredLanguage,
      examOrRole: typeof parsed.examOrRole === 'string' ? parsed.examOrRole : undefined,
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      recentTopics: Array.isArray(parsed.recentTopics) ? parsed.recentTopics : [],
      sessionDigests: Array.isArray(parsed.sessionDigests) ? parsed.sessionDigests : [],
    };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveNikAIMemory(store: NikAIMemoryStore): void {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify({
      ...store,
      facts: store.facts.slice(0, 40),
      recentTopics: store.recentTopics.slice(0, 18),
      sessionDigests: store.sessionDigests.slice(0, 15),
    }));
  } catch {
    // ignore storage quota errors
  }
}

export function addManualMemoryFact(text: string, category: NikAIMemoryFact['category'] = 'custom'): NikAIMemoryStore {
  const clean = text.trim();
  const store = loadNikAIMemory();
  if (!clean) return store;

  const exists = store.facts.find((f) => f.text.toLowerCase() === clean.toLowerCase());
  if (exists) {
    exists.updatedAt = Date.now();
    exists.pinned = true;
  } else {
    store.facts.unshift({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      text: clean,
      pinned: true,
      updatedAt: Date.now(),
    });
  }
  saveNikAIMemory(store);
  return store;
}

export function deleteMemoryFact(id: string): NikAIMemoryStore {
  const store = loadNikAIMemory();
  store.facts = store.facts.filter((f) => f.id !== id);
  saveNikAIMemory(store);
  return store;
}

export function clearAllNikAIMemory(): NikAIMemoryStore {
  const fresh: NikAIMemoryStore = { facts: [], recentTopics: [], sessionDigests: [] };
  saveNikAIMemory(fresh);
  return fresh;
}

/**
 * Automatically learns user name, exam/course goal, language preference, explicit
 * "remember/yaad rakhna" instructions, and studied topics from natural conversation!
 */
export function learnFromConversationTurn(
  userPrompt: string,
  assistantReply: string,
  threadId: string,
  threadTitle: string
): NikAIMemoryStore {
  const store = loadNikAIMemory();
  const text = userPrompt.trim();
  if (!text) return store;

  const upsertFact = (factText: string, category: NikAIMemoryFact['category'], pinned = false) => {
    const clean = factText.trim().slice(0, 160);
    if (!clean) return;
    const existing = store.facts.find((f) => f.text.toLowerCase() === clean.toLowerCase());
    if (existing) {
      existing.updatedAt = Date.now();
    } else {
      store.facts.unshift({
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        text: clean,
        pinned,
        updatedAt: Date.now(),
      });
    }
  };

  // 1. Detect user's name naturally ("My name is ...", "Mera naam ... hai", "I am ...")
  const nameMatch =
    text.match(/\b(?:my name is|call me|i'm|i am)\s+([A-Z][a-zA-Z]{1,22})\b/i) ||
    text.match(/\bmera naam\s+([a-zA-Z]{2,22})\s*(?:hai)?\b/i);
  if (nameMatch?.[1]) {
    const rawName = nameMatch[1];
    if (!/^(preparing|studying|confused|stuck|here|ready|asking|learning|good|fine)$/i.test(rawName)) {
      const cap = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      store.userName = cap;
      upsertFact(`User's name is ${cap}`, 'identity', true);
    }
  }

  // 2. Detect exam / class / degree / profession goals
  const examMatch = text.match(
    /\b(JEE\s*(?:Main|Advanced)?|NEET(?:\s*UG|\s*PG)?|UPSC(?:\s*CSE)?|GATE|CAT|SSC\s*CGL|CUET|NDA|Class\s*(?:9|10|11|12)|10th\s*Board|12th\s*Board|CBSE|ICSE|B\.?\s*Tech|BCA|MCA|MBBS|B\.?\s*Sc)\b/i
  );
  if (examMatch?.[1]) {
    const goal = examMatch[1].trim();
    store.examOrRole = goal;
    upsertFact(`Studying / preparing for ${goal}`, 'goal', true);
  }

  // 3. Detect natural language preference
  if (/[\u0900-\u097F]/.test(text)) {
    store.preferredLanguage = 'Hindi';
  } else if (/\b(kya|kaise|samjhao|batao|likho|hai|hain|mein|ke|ki|aur|yaad|karo|mujhe)\b/i.test(text)) {
    store.preferredLanguage = 'Hinglish';
  } else if (text.split(/\s+/).length >= 5) {
    store.preferredLanguage = store.preferredLanguage || 'English';
  }

  // 4. Explicit "Remember ..." / "Yaad rakhna ..." instructions
  const explicitMem =
    text.match(/(?:remember that|remember:|please remember|note that|yaad rakhna(?:\s*ki)?|yaad rakho(?:\s*ki)?)\s+(.+)/i);
  if (explicitMem?.[1]) {
    upsertFact(explicitMem[1], 'custom', true);
  }

  // 5. Extract topic heading from assistant's structured answer
  const heading = assistantReply.match(/^##?\s+([^\n#*]{3,65})$/m)?.[1]?.trim();
  const topicCandidate = heading || threadTitle;
  if (topicCandidate && topicCandidate !== 'New Chat' && topicCandidate.length > 2) {
    store.recentTopics = [
      topicCandidate,
      ...store.recentTopics.filter((t) => t.toLowerCase() !== topicCandidate.toLowerCase()),
    ].slice(0, 15);
  }

  // 6. Store crisp cross-session digest so future sessions know what happened in earlier chats!
  const snippet = assistantReply.replace(/[#*`>|_-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  const digest: NikAISessionDigest = {
    threadId,
    title: threadTitle || text.slice(0, 44),
    summary: `Asked: "${text.slice(0, 90)}" → Covered: ${snippet}`,
    updatedAt: Date.now(),
  };
  store.sessionDigests = [
    digest,
    ...store.sessionDigests.filter((d) => d.threadId !== threadId),
  ].slice(0, 12);

  saveNikAIMemory(store);
  return store;
}

/**
 * Formats the complete persistent memory + cross-session history string injected
 * into every NikAI cloud & local prompt so NikAI remembers across sessions!
 */
export function buildNikAIMemoryPrompt(currentThreadId?: string): string {
  const store = loadNikAIMemory();
  const lines: string[] = [];

  if (store.userName) lines.push(`- Student / User Name: ${store.userName}`);
  if (store.examOrRole) lines.push(`- Target Exam / Course: ${store.examOrRole}`);
  if (store.preferredLanguage) lines.push(`- Preferred Style: ${store.preferredLanguage} (adapt naturally to current message)`);

  for (const fact of store.facts.slice(0, 12)) {
    lines.push(`- Memory: ${fact.text}`);
  }
  if (store.recentTopics.length > 0) {
    lines.push(`- Previously Studied Topics: ${store.recentTopics.slice(0, 8).join(', ')}`);
  }

  const otherSessions = store.sessionDigests
    .filter((d) => d.threadId !== currentThreadId)
    .slice(0, 5);
  if (otherSessions.length > 0) {
    lines.push(`\nPrevious Session History (use seamlessly if user refers to past sessions):`);
    for (const s of otherSessions) {
      lines.push(`  • [${s.title}]: ${s.summary}`);
    }
  }

  return lines.join('\n');
}
