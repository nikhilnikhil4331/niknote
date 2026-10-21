// ============================================================
// knowledgeIndex — local, dependency-free retrieval over the user's
// own material (notes + imported PDFs).
//
// Why this exists: NikAI used to receive only the *one* attached note as
// context. Asking "what does page 3 of this chapter say about osmosis?"
// could therefore only be answered from the model's general memory, with no
// way to show where an answer came from.
//
// WeKnora solves this with a full Go/Python RAG platform (vector DB, doc
// reader service, agent orchestration). NikNote does not need that
// operational weight: the corpus is small, on-device and single-user, so a
// BM25 lexical index plus explicit, page-level citations covers the same
// product need at zero infrastructure cost and no data leaving the browser.
//
// Design rules:
//  - never invent a citation: a source is only listed if a chunk matched;
//  - when nothing matches, say so (confidence 'none') so the caller can tell
//    the user instead of silently answering from general knowledge;
//  - everything is derived from text the user already has locally.
// ============================================================

export type KnowledgeKind = 'note' | 'pdf' | 'lecture';

export interface KnowledgeDoc {
  id: string;
  title: string;
  kind: KnowledgeKind;
  /** Ordered page (or section) texts. Index + 1 is the human page number. */
  pages: string[];
  updatedAt: number;
}

export interface KnowledgeChunk {
  docId: string;
  title: string;
  kind: KnowledgeKind;
  /** 1-based page/section number. */
  page: number;
  text: string;
}

export interface SourceRef {
  docId: string;
  title: string;
  kind: KnowledgeKind;
  page: number;
  /** Short excerpt shown under the answer. */
  excerpt: string;
}

export interface SearchHit {
  chunk: KnowledgeChunk;
  score: number;
}

export type GroundingConfidence = 'high' | 'low' | 'none';

export interface GroundedContext {
  /** Passages formatted for the model, or '' when nothing matched. */
  context: string;
  sources: SourceRef[];
  confidence: GroundingConfidence;
  queryTerms: string[];
}

export const KNOWLEDGE_KEY = 'niknote.knowledge.v1';
const MAX_DOCS = 40;
const MAX_TOTAL_CHARS = 400_000;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'shall',
  'should', 'can', 'could', 'may', 'might', 'must', 'of', 'in', 'on', 'at',
  'to', 'for', 'from', 'by', 'with', 'about', 'into', 'over', 'after',
  'before', 'as', 'it', 'its', 'their', 'there', 'here', 'what', 'which',
  'who', 'whom', 'how', 'why', 'when', 'where', 'me', 'my', 'you', 'your',
  'we', 'our', 'they', 'them', 'he', 'she', 'his', 'her', 'i', 'not', 'no',
  'yes', 'please', 'explain', 'summarise', 'summarize', 'tell', 'give',
  'kya', 'hai', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein', 'aur', 'ya',
  'kar', 'karo', 'bata', 'batao', 'samjha', 'samjhao', 'likh', 'likho',
]);

/** Words are lowercased and lightly stemmed; Devanagari words are kept whole. */
export function tokenize(text: string): string[] {
  const raw = String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .match(/[\p{L}\p{N}\p{M}]+/gu) || [];

  const out: string[] = [];
  for (const word of raw) {
    if (word.length < 2 || STOP_WORDS.has(word)) continue;
    // Devanagari (and other non-Latin scripts) keep their form — English
    // suffix stripping would corrupt them.
    if (!/^[a-z0-9]+$/.test(word)) {
      out.push(word);
      continue;
    }
    let stem = word;
    // Keep real words intact: "osmosis", "class", "focus", "analysis" are not
    // plurals, and cutting the 's' made citations and matching confusing.
    const looksPlural = !/(ss|us|is|sis)$/.test(stem);
    if (looksPlural && stem.length > 4 && /ies$/.test(stem)) stem = `${stem.slice(0, -3)}y`;
    else if (looksPlural && stem.length > 4 && /(ses|xes|zes|ches|shes)$/.test(stem)) stem = stem.slice(0, -2);
    else if (looksPlural && stem.length > 3 && /[^s]s$/.test(stem)) stem = stem.slice(0, -1);
    if (stem.length > 5 && /ing$/.test(stem)) stem = stem.slice(0, -3);
    else if (stem.length > 4 && /ed$/.test(stem)) stem = stem.slice(0, -2);
    if (stem.length >= 2) out.push(stem);
  }
  return out;
}

/** Split at sentence boundaries so a chunk never starts mid-sentence. */
function splitSentences(text: string): string[] {
  return String(text || '')
    .replace(/\s+/g, ' ')
    // Start a new sentence on a capital letter, a digit, a Devanagari
    // letter, or an opening bracket.
    .split(/(?<=[.!?;:])\s+(?=[A-Z0-9(\p{L}])/u)
    .map(s => s.trim())
    .filter(Boolean);
}

export function chunkPage(
  text: string,
  options: { maxChars?: number; overlapChars?: number } = {},
): string[] {
  const { maxChars = 700, overlapChars = 120 } = options;
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = splitSentences(clean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    // A single monster sentence is hard-split rather than dropped.
    if (sentence.length > maxChars) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < sentence.length; i += maxChars - overlapChars) {
        chunks.push(sentence.slice(i, i + maxChars).trim());
      }
      continue;
    }
    if ((current + ' ' + sentence).trim().length > maxChars && current) {
      chunks.push(current.trim());
      // Carry the tail of the previous chunk so answers spanning a boundary
      // still retrieve.
      const tail = current.slice(-overlapChars);
      current = `${tail} ${sentence}`;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function chunkDocument(doc: KnowledgeDoc, options?: { maxChars?: number }): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  doc.pages.forEach((pageText, index) => {
    for (const text of chunkPage(pageText, options)) {
      chunks.push({
        docId: doc.id,
        title: doc.title,
        kind: doc.kind,
        page: index + 1,
        text,
      });
    }
  });
  return chunks;
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

const K1 = 1.4;
const B = 0.75;

/**
 * BM25 over page chunks. Lexical (not embedding) retrieval is the right
 * trade-off here: the corpus is the user's own notes, it must run offline on
 * a phone, and it produces exact, quotable passages for citations.
 */
export function searchKnowledge(
  query: string,
  docs: KnowledgeDoc[],
  options: { topK?: number; minScore?: number; perDocLimit?: number } = {},
): SearchHit[] {
  const { topK = 6, minScore = 0.6, perDocLimit = 3 } = options;
  const queryTerms = Array.from(new Set(tokenize(query)));
  if (!queryTerms.length) return [];

  const chunks = docs.flatMap(doc => chunkDocument(doc));
  if (!chunks.length) return [];

  const stats = chunks.map(chunk => {
    const tokens = tokenize(chunk.text);
    return { chunk, tokens, tf: termFrequency(tokens), length: tokens.length };
  });
  const avgLength = Math.max(1, stats.reduce((sum, s) => sum + s.length, 0) / stats.length);

  const df = new Map<string, number>();
  for (const term of queryTerms) {
    let count = 0;
    for (const s of stats) if (s.tf.has(term)) count++;
    df.set(term, count);
  }

  const scored: SearchHit[] = [];
  for (const s of stats) {
    let score = 0;
    let matched = 0;
    for (const term of queryTerms) {
      const tf = s.tf.get(term) || 0;
      if (!tf) continue;
      matched++;
      const n = df.get(term) || 0;
      const idf = Math.log(1 + (chunks.length - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * s.length) / avgLength)));
    }
    if (!matched || score <= 0) continue;
    // Reward chunks that cover more of the question, not just one rare word.
    score *= 1 + (matched - 1) * 0.18;
    if (score >= minScore) scored.push({ chunk: s.chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Keep the evidence spread across documents instead of five chunks of the
  // same page.
  const perDoc = new Map<string, number>();
  const picked: SearchHit[] = [];
  for (const hit of scored) {
    const used = perDoc.get(hit.chunk.docId) || 0;
    if (used >= perDocLimit) continue;
    perDoc.set(hit.chunk.docId, used + 1);
    picked.push(hit);
    if (picked.length >= topK) break;
  }
  return picked;
}

const KIND_LABEL: Record<KnowledgeKind, string> = {
  note: 'note',
  pdf: 'PDF',
  lecture: 'recording',
};

export function sourceLabel(source: Pick<SourceRef, 'title' | 'kind' | 'page'>): string {
  return `${source.title} · ${KIND_LABEL[source.kind]} p.${source.page}`;
}

/**
 * Build the prompt context plus the citation list shown in the UI.
 * When nothing matches, `context` stays empty and `confidence` is 'none' so
 * the caller can be explicit instead of pretending the answer is grounded.
 */
export function buildGroundedContext(
  query: string,
  docs: KnowledgeDoc[],
  options: { topK?: number; maxChars?: number; includeDocs?: KnowledgeDoc[] } = {},
): GroundedContext {
  const { topK = 5, maxChars = 6000, includeDocs = [] } = options;
  const queryTerms = Array.from(new Set(tokenize(query)));
  const hits = searchKnowledge(query, [...docs, ...includeDocs], { topK });

  if (!hits.length) {
    return { context: '', sources: [], confidence: 'none', queryTerms };
  }

  const blocks: string[] = [];
  const sources: SourceRef[] = [];
  let used = 0;

  hits.forEach((hit, index) => {
    const block = `[${index + 1}] ${hit.chunk.title} · page ${hit.chunk.page}\n${hit.chunk.text}`;
    if (used + block.length > maxChars) return;
    used += block.length;
    blocks.push(block);
    sources.push({
      docId: hit.chunk.docId,
      title: hit.chunk.title,
      kind: hit.chunk.kind,
      page: hit.chunk.page,
      excerpt: hit.chunk.text.slice(0, 220),
    });
  });

  // "High" needs more than one weak word: either a strong score or coverage
  // of several distinct question terms in the best passage.
  const best = hits[0];
  const bestTokens = new Set(tokenize(best.chunk.text));
  const coverage = queryTerms.filter(t => bestTokens.has(t)).length / Math.max(1, queryTerms.length);
  const confidence: GroundingConfidence =
    best.score >= 3.2 || coverage >= 0.6 ? 'high' : 'low';

  return { context: blocks.join('\n\n'), sources, confidence, queryTerms };
}

/** Prompt block appended to note context. Kept explicit about the rules. */
export function groundingPrompt(grounded: GroundedContext): string {
  if (!grounded.context) {
    return [
      'Retrieved material: none matched this question.',
      'Say plainly that the uploaded notes/PDF do not appear to cover it, then (only if useful) answer from general knowledge and label that part as general knowledge.',
      'Never invent a page number or citation.',
    ].join('\n');
  }
  return [
    'Retrieved passages from the user\'s own notes and uploaded documents:',
    grounded.context,
    '',
    'Rules:',
    '- Prefer these passages over general knowledge; keep their facts, numbers and equations intact.',
    '- Cite the passage number in square brackets, e.g. [1], right after each claim taken from it.',
    '- Only cite numbers that appear above. Never invent a page number or a source.',
    grounded.confidence === 'low'
      ? '- The match is weak: say briefly that the material only partly covers the question.'
      : '',
  ].filter(Boolean).join('\n');
}

// ── Storage ──────────────────────────────────────────────────────────

export function loadKnowledgeDocs(): KnowledgeDoc[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KNOWLEDGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is KnowledgeDoc =>
        d && typeof d.id === 'string' && typeof d.title === 'string' && Array.isArray(d.pages),
    );
  } catch {
    return [];
  }
}

function persist(docs: KnowledgeDoc[]): KnowledgeDoc[] {
  const sorted = [...docs].sort((a, b) => a.updatedAt - b.updatedAt);
  const kept: KnowledgeDoc[] = [];
  let chars = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const doc = sorted[i];
    const size = doc.pages.join(' ').length;
    if (kept.length >= MAX_DOCS) break;
    if (chars + size > MAX_TOTAL_CHARS) continue;
    chars += size;
    kept.unshift(doc);
  }
  try {
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(kept));
  } catch {
    // Quota exceeded: keep the newest half rather than losing everything.
    try {
      localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(kept.slice(-Math.ceil(kept.length / 2))));
    } catch { /* private mode */ }
  }
  return kept;
}

/** Insert or replace a document (same id = same document, re-imported). */
export function registerKnowledgeDoc(doc: KnowledgeDoc): KnowledgeDoc[] {
  const existing = loadKnowledgeDocs().filter(d => d.id !== doc.id);
  return persist([...existing, doc]);
}

export function removeKnowledgeDoc(id: string): KnowledgeDoc[] {
  return persist(loadKnowledgeDocs().filter(d => d.id !== id));
}

export function knowledgeDocFromPdf(name: string, pages: string[], id?: string): KnowledgeDoc {
  const title = name.replace(/\.pdf$/i, '').trim() || 'Imported PDF';
  return {
    id: id || `pdf-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    title,
    kind: 'pdf',
    pages: pages.map(p => String(p || '')),
    updatedAt: Date.now(),
  };
}

/** Notes already in local storage become searchable without any upload. */
export function knowledgeDocsFromNotes(): KnowledgeDoc[] {
  if (typeof localStorage === 'undefined') return [];
  const docs: KnowledgeDoc[] = [];
  const push = (id: unknown, title: unknown, text: string) => {
    const body = String(text || '').trim().slice(0, 12_000);
    if (!body) return;
    docs.push({
      id: `note-${String(id)}`,
      title: String(title || 'Untitled note'),
      kind: 'note',
      pages: [body],
      updatedAt: Date.now(),
    });
  };

  try {
    const mobile = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]');
    if (Array.isArray(mobile)) {
      for (const item of mobile) {
        const text = Array.isArray(item?.blocks)
          ? item.blocks.map((b: { content?: string }) => b?.content || '').join('\n')
          : item?.content || '';
        push(item?.id, item?.title, text);
      }
    }
  } catch { /* ignore */ }

  try {
    const notes = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]');
    if (Array.isArray(notes)) {
      for (const item of notes) {
        if (item?.trashedAt) continue;
        push(item?.id, item?.title, item?.content || '');
      }
    }
  } catch { /* ignore */ }

  return docs;
}

/** Everything the user has locally: their notes + imported documents. */
export function collectLocalKnowledge(): KnowledgeDoc[] {
  return [...knowledgeDocsFromNotes(), ...loadKnowledgeDocs()];
}
