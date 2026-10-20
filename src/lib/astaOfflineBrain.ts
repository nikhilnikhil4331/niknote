// ============================================================
// NikNote 6.0 — Built-in Offline STEM / Code / Study Brain
// Used ONLY as tier-4 fallback when cloud keys/network are
// unavailable (e.g. airplane mode or unconfigured sandbox).
// ============================================================

import type { AstaMode } from '@/lib/aiEngine';

interface TopicGuide {
  match: RegExp;
  title: string;
  intuition: string;
  core: string[];
  codeOrFormula?: { label: string; lang?: string; body: string };
  table?: { headers: string[]; rows: string[][] };
  examTip: string;
}

const TOPIC_GUIDES: TopicGuide[] = [
  {
    match: /newton|motion|force|inertia|momentum|f\s*=\s*ma/i,
    title: 'Newton’s Three Laws of Motion',
    intuition: 'Every change in velocity has a cause — force. Without net external force, motion stays steady; with force, acceleration scales inversely with mass; and forces always act in equal-opposite pairs on two different bodies.',
    core: [
      '**First Law (Law of Inertia):** A body remains at rest or uniform straight-line motion unless acted upon by a net external force (`ΣF = 0 ⇒ a = 0`). Example: passengers lurch forward when a bus brakes suddenly.',
      '**Second Law (Law of Acceleration):** Rate of change of linear momentum equals net force: `F = dp/dt = m·a` (for constant mass). SI unit: **Newton (1 N = 1 kg·m/s²)**.',
      '**Third Law (Action–Reaction):** Whenever object A exerts force `F_AB` on B, B simultaneously exerts `F_BA = −F_AB` on A — always acting on **different bodies**, so they never cancel on the same FBD.',
      '**Impulse–Momentum Theorem:** `J = F_avg · Δt = Δp = m(v − u)` — why cricket players pull hands back while catching a fast ball.',
    ],
    codeOrFormula: {
      label: 'Core Mechanics Formulas',
      body: `ΣF = m · a\np = m · v\nJ = ∫ F dt = m(v - u)\nApparent weight in lift: N = m(g + a) [upward], N = m(g - a) [downward]`,
    },
    table: {
      headers: ['Law', 'Key Equation', 'Classic Real-Life Example'],
      rows: [
        ['1st — Inertia', 'ΣF = 0 ⇔ v = constant', 'Dust comes out when carpet is beaten'],
        ['2nd — Force', 'F = m · a', 'Empty cart accelerates faster than loaded cart'],
        ['3rd — Pair Force', 'F₁₂ = −F₂₁', 'Rocket propulsion / recoil of gun'],
      ],
    },
    examTip: 'Never cancel Action & Reaction forces on a single Free Body Diagram — they act on two separate objects!',
  },
  {
    match: /photosynthesis|chloroplast|calvin|light reaction|chlorophyll/i,
    title: 'Photosynthesis — Complete Mechanism',
    intuition: 'Green plants convert light energy into chemical bond energy (glucose) inside chloroplasts in two coupled stages: photophosphorylation (light-dependent) and the Calvin cycle (carbon fixation).',
    core: [
      '**Light Reactions (Thylakoid Membrane):** Chlorophyll absorbs red & blue wavelengths, splits water (**photolysis**: `2H₂O → 4H⁺ + 4e⁻ + O₂↑`), and produces **ATP + NADPH**.',
      '**Calvin Cycle / C3 Cycle (Stroma):** Enzyme **RuBisCO** fixes `CO₂` using ATP and NADPH to synthesize glyceraldehyde-3-phosphate (G3P) → **Glucose (`C₆H₁₂O₆`)**.',
      '**Limiting Factors (Blackman’s Law):** Light intensity, CO₂ concentration (0.03–0.05%), temperature (optimum 25–35 °C for C3, 35–45 °C for C4), and water availability.',
    ],
    codeOrFormula: {
      label: 'Balanced Overall Equation',
      body: `6 CO₂ + 12 H₂O  ──(Sunlight / Chlorophyll)──▶  C₆H₁₂O₆ + 6 O₂↑ + 6 H₂O`,
    },
    table: {
      headers: ['Stage', 'Site in Chloroplast', 'Inputs', 'Outputs'],
      rows: [
        ['Light Reaction', 'Grana / Thylakoid', 'Light, H₂O, ADP, NADP⁺', 'O₂, ATP, NADPH'],
        ['Calvin Cycle', 'Stroma', 'CO₂, ATP, NADPH', 'Glucose (G3P), ADP, NADP⁺'],
      ],
    },
    examTip: 'Every molecule of O₂ released in photosynthesis comes strictly from H₂O (proven using ¹⁸O radioisotope tracing), NEVER from CO₂!',
  },
  {
    match: /thermo|entropy|enthalpy|carnot|heat engine|gibbs/i,
    title: 'Laws of Thermodynamics',
    intuition: 'Thermodynamics tracks energy conservation (1st law), direction of spontaneous processes via entropy (2nd law), and absolute temperature limits (0th & 3rd laws).',
    core: [
      '**Zeroth Law:** Defines thermal equilibrium & temperature (`A ~ C` and `B ~ C ⇒ A ~ B`).',
      '**First Law (Energy Conservation):** `ΔU = Q − W` (physics sign convention: work done *by* system) or `ΔU = q + w` (IUPAC chemistry sign convention: work done *on* system).',
      '**Second Law (Entropy):** Total entropy of an isolated system never decreases (`ΔS_universe ≥ 0`). No heat engine can achieve 100% thermal efficiency.',
      '**Gibbs Free Energy Criterion:** `ΔG = ΔH − TΔS` → process is spontaneous when **`ΔG < 0`**.',
    ],
    codeOrFormula: {
      label: 'Key Equations',
      body: `ΔU = Q - W\nη_Carnot = 1 - (T_cold / T_hot)   [Temperatures in Kelvin!]\nΔG = ΔH - T·ΔS`,
    },
    examTip: 'Always convert °C to Kelvin (`K = °C + 273.15`) BEFORE computing Carnot efficiency `1 − T₂/T₁`, and double-check physics vs chemistry sign convention for `W`!',
  },
  {
    match: /binary search|two pointer|sliding window|dsa|dynamic programming|quicksort|mergesort|bfs|dfs|dijkstra/i,
    title: 'Algorithm Design & Clean Implementation',
    intuition: 'Strong algorithmic code pairs an invariant-driven algorithm with tight edge-case handling and explicit Big-O time & space bounds.',
    core: [
      '**Step 1 — Clarify Invariant:** Define what stays true before & after every loop iteration (`lo <= target_idx <= hi`).',
      '**Step 2 — Overflow-Safe Midpoint:** Always compute `mid = lo + Math.floor((hi - lo) / 2)`.',
      '**Step 3 — Complexity Analysis:** Binary Search runs in **`O(log n)` time** and **`O(1)` auxiliary space**; Merge Sort runs in **`O(n log n)` guaranteed time**; BFS/DFS run in **`O(V + E)`**.',
    ],
    codeOrFormula: {
      label: 'Production TypeScript / Python Reference',
      lang: 'python',
      body: `def binary_search(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1  # Time: O(log n) | Space: O(1)`,
    },
    examTip: 'Always test empty array `[]`, single element `[x]`, all duplicates `[2,2,2]`, and target smaller/larger than both ends!',
  },
  {
    match: /react|hook|useeffect|usestate|typescript|javascript|closure|promise|async|event loop/i,
    title: 'Modern JavaScript / TypeScript & React Architecture',
    intuition: 'Predictable UI and async code comes from pure state derivations, clean effect cleanup with AbortController, and understanding microtasks vs macrotasks.',
    core: [
      '**Event Loop Priority:** Call Stack → **Microtask Queue** (`Promise.then`, `queueMicrotask`, `await` continuations) → **Task/Macrotask Queue** (`setTimeout`, I/O) → Render frame.',
      '**React State Rule:** Derive computed values directly during render (`useMemo` only when expensive) instead of mirroring state inside `useEffect`.',
      '**Async Race Safety:** Cancel stale fetches inside `useEffect` cleanup using `AbortController` so fast tab switches never overwrite fresh state.',
    ],
    codeOrFormula: {
      label: 'Race-Safe Custom Hook Pattern',
      lang: 'tsx',
      body: `import { useEffect, useState } from 'react';

export function useSafeResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: T) => setData(json))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [url]);

  return { data, loading };
}`,
    },
    examTip: 'In interviews, mention that `Promise` callbacks flush completely in the microtask queue BEFORE the next `setTimeout(..., 0)` callback executes!',
  },
];

export function buildOfflineKnowledgeResponse(
  rawQuery: string,
  mode: AstaMode,
  noteContext?: string,
  action?: string,
  targetLanguage?: string,
  memoryContext?: string
): string {
  const query = (rawQuery || '').trim();
  const hinglish = /\b(kya|kaise|kyu|samjhao|batao|likho|karo|hai|ke|ki|aur|mein|se|mujhe)\b/i.test(query);
  const rememberedName = memoryContext?.match(/Student \/ User Name:\s*([^\n]+)/)?.[1]?.trim();

  // Answer memory recall questions directly even offline!
  if (/\b(what do you remember|kya yaad hai|mera naam kya|my memory|previous session|pichhle session)\b/i.test(query)) {
    return memoryContext?.trim()
      ? `## 🧠 NikAI Session Memory Vault\n\nMain aapke baare mein aur pichhle sessions se yeh sab yaad rakhe hue hoon:\n\n${memoryContext}\n\n> 💡 Aap upar **🧠 Memory** button daba kar kabhi bhi naye facts pin ya edit kar sakte ho!`
      : `## 🧠 NikAI Session Memory\n\nAbhi naya session start hua hai! Apna naam, exam goal (e.g. *JEE / NEET / Class 12 / B.Tech*), ya koi bhi topic batao — **NikAI** har session mein automatically yaad rakhega!`;
  }

  // Handle inline editor actions cleanly on user text
  if (action === 'summarize' || /^summarize\b/i.test(query)) {
    const source = (noteContext || query).replace(/^summarize\s*:?\s*/i, '').trim();
    const sentences = source.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12);
    const picks = sentences.slice(0, 5);
    return picks.length
      ? `## Key Summary\n\n${picks.map((s) => `- ${s}`).join('\n')}`
      : `## Key Summary\n\n- ${source.slice(0, 280)}`;
  }

  if (action === 'shorten') {
    const sentences = query.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(' ');
  }

  if (action === 'fix_grammar' || action === 'improve') {
    const cleaned = query
      .replace(/\s+/g, ' ')
      .replace(/\bi\b/g, 'I')
      .replace(/(^\w|[.!?]\s+\w)/g, (m) => m.toUpperCase())
      .trim();
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }

  if (action === 'translate') {
    return `[Translated (${targetLanguage || 'English'})]: ${query}`;
  }

  // Greeting / conversational check
  if (/^(hi|hello|hey|namaste|hii+|yo|kem cho|kaise ho|how are you)\b/i.test(query) && query.length < 40) {
    const hiName = rememberedName ? `, **${rememberedName}**` : '';
    return hinglish
      ? `Namaste${hiName}! Main **NikAI** *(Powered by Astra Neural Core)* hoon ✨\n\nMain aapke saare tools ka **ek single powerhouse AI** hoon:\n- 🧠 **Astra Reasoning & Personal Memory** — aapke sessions, topics aur goals hamesha yaad rakhta hoon\n- ✍️ **Direct Handwriting & Smart Notes Engine** — 1 tap mein multi-ink handwritten notebook aur flashcards ready!\n- 🎯 **Live Playable Quizzes & Homework Photo Vision**\n\nApna sawaal poochho ya niche koi bhi topic likho!`
      : `Hello${hiName}! I'm **NikAI** *(Powered by Astra Neural Core)* ✨\n\nYour single all-in-one AI brain built right into **NikNote**:\n- 🧠 **Cross-Session Memory** that remembers your goals, style & past study sessions\n- ✍️ **1-Tap Handwriting & Smart Notes Engine** that builds multi-ink notebook pages + flashcards directly\n- 💻 **Deep Math, Science, Coding & Interactive Live Quizzes**\n\nAsk anything — in English, Hinglish, or Hindi!`;
  }

  // Match curated deep STEM/CS guide if applicable
  const matched = TOPIC_GUIDES.find((g) => g.match.test(query));
  if (matched && mode !== 'quiz') {
    const parts: string[] = [
      `## ${matched.title}`,
      `> **Core Intuition:** ${matched.intuition}`,
      `### Key Concepts Breakdown\n${matched.core.map((c) => `- ${c}`).join('\n')}`,
    ];
    if (matched.codeOrFormula) {
      parts.push(
        matched.codeOrFormula.lang
          ? `### ${matched.codeOrFormula.label}\n\`\`\`${matched.codeOrFormula.lang}\n${matched.codeOrFormula.body}\n\`\`\``
          : `### ${matched.codeOrFormula.label}\n\`\`\`\n${matched.codeOrFormula.body}\n\`\`\``
      );
    }
    if (matched.table) {
      parts.push(
        `### Quick Comparison\n| ${matched.table.headers.join(' | ')} |\n| ${matched.table.headers.map(() => '---').join(' | ')} |\n${matched.table.rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`
      );
    }
    parts.push(`> 💡 **Exam Pro-Tip:** ${matched.examTip}`);
    return parts.join('\n\n');
  }

  // Interactive Quiz Mode structured output (renders playable clickable quiz cards!)
  const cleanTopic = query.replace(/^(quiz me on|make a quiz on|create mcqs on|mcq on|explain|notes on)\s+/i, '').trim() || 'Core Concepts';
  if (mode === 'quiz' || /\b(mcq|quiz)\b/i.test(query)) {
    return `## 🎯 Interactive Quiz: ${cleanTopic}

### Q1. Which foundational principle best characterizes **${cleanTopic}**?
- A) Systematic structure governed by defined rules and measurable relationships
- B) Random behavior with zero predictable properties
- C) Unrelated isolated observations only
- D) None of the above
**Answer:** A
**Explanation:** Every core concept in **${cleanTopic}** is analyzed through well-defined principles, invariants, and cause-effect relationships.

### Q2. When solving an exam problem on **${cleanTopic}**, what should always be verified first?
- A) Skip reading given constraints and guess an option
- B) Identify given quantities, standard units, boundary conditions, and applicable formula
- C) Change units randomly mid-step
- D) Ignore edge cases completely
**Answer:** B
**Explanation:** Checking units, constraints, and boundary conditions prevents over 80% of common exam errors.

### Q3. Why is connecting **${cleanTopic}** with a concrete worked example high-yield for retention?
- A) It slows down understanding
- B) It links abstract definitions directly to real application steps
- C) Examples replace concepts completely
- D) It is never asked in exams
**Answer:** B
**Explanation:** Active retrieval + concrete application builds deep long-term memory far better than passive re-reading.`;
  }

  // Note Context analysis if user attached their note
  if (noteContext?.trim()) {
    const lines = noteContext.split('\n').map((l) => l.trim()).filter(Boolean);
    const bullets = lines.slice(0, 6).map((l) => `- ${l}`).join('\n');
    return `## Analysis Based on Your Attached Note: *${query}*\n\n### Highlights from Your Note\n${bullets}\n\n### Actionable Structure & Next Steps\n1. **Core Takeaway:** Consolidate the definitions above into active-recall flashcards.\n2. **Self-Test:** Cover the bullet points and explain each point out loud in 60 seconds.\n3. **Cloud Deep-Dive Tip:** Open **⚙️ AI Settings** anytime to plug in a free Groq or Gemini key when running offline/locally — on \`niknote.online\` cloud streaming runs automatically!`;
  }

  // Rich structured synthesis tailored to mode
  return `## ${cleanTopic}

> **Quick Overview:** Structured breakdown of **${cleanTopic}** organized for clarity, fast understanding, and exam/practical application.

### 1. Core Concept & Intuition
- **Definition & Scope:** **${cleanTopic}** focuses on the underlying principles, key mechanisms, and real-world cause-and-effect behavior of the subject.
- **Why It Matters:** Mastering the fundamentals first makes tricky multi-step questions, interviews, and practical applications straightforward.
- **First-Principles Lens:** Break **${cleanTopic}** into **Inputs / Assumptions → Core Rule / Mechanism → Output / Implications → Edge Cases**.

### 2. Structured Study Framework
| Dimension | What to Focus On | Common Pitfall to Avoid |
| --- | --- | --- |
| **Fundamentals** | Exact definitions, terminology & core assumptions | Memorizing words without understanding mechanism |
| **Application** | Step-by-step method on standard & tricky cases | Skipping units, constraints, or boundary conditions |
| **Revision** | 1-page summary + 3 active-recall questions | Passive re-reading without testing yourself |

### 3. Fast Action Checklist
1. State **${cleanTopic}** in your own words in 2 crisp sentences.
2. Write down the key formula / rule / architecture diagram from memory.
3. Tap **Quiz Mode 🎯** above to test yourself immediately, or tap **Save Note** to store this directly in your NikNote workspace!`;
}
