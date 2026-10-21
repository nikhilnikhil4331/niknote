import { describe, expect, it } from 'vitest';
import {
  buildGroundedContext,
  chunkPage,
  groundingPrompt,
  knowledgeDocFromPdf,
  searchKnowledge,
  sourceLabel,
  tokenize,
  type KnowledgeDoc,
} from '@/lib/knowledgeIndex';

const pdf: KnowledgeDoc = {
  id: 'pdf-bio',
  title: 'Biology Chapter 3',
  kind: 'pdf',
  updatedAt: 1,
  pages: [
    'Cell Structure. Every cell has a plasma membrane that controls what enters and leaves.',
    'Osmosis is the movement of water across a semi-permeable membrane from low solute concentration to high solute concentration.',
    'Mitochondria release energy through aerobic respiration; the Krebs cycle happens in the matrix.',
  ],
};

const notes: KnowledgeDoc = {
  id: 'note-1',
  title: 'Thermodynamics revision',
  kind: 'note',
  updatedAt: 2,
  pages: ['First law of thermodynamics: energy cannot be created or destroyed, only converted. ΔU = Q − W.'],
};

describe('tokenize', () => {
  it('drops filler words and light stems English', () => {
    const terms = tokenize('Explain how the membranes are working');
    expect(terms).not.toContain('the');
    expect(terms).not.toContain('how');
    expect(terms).toContain('membrane');
    expect(terms).toContain('work');
  });

  it('keeps Hinglish and Devanagari words intact', () => {
    const terms = tokenize('osmosis samjhao जल संचार');
    expect(terms).toContain('osmosis');
    expect(terms).toContain('जल');
    expect(terms).toContain('संचार');
    expect(terms).not.toContain('samjhao');
  });
});

describe('chunkPage', () => {
  it('never returns an over-sized chunk', () => {
    const page = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about plant cells and their walls.`).join(' ');
    const chunks = chunkPage(page, { maxChars: 300 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(320);
  });

  it('keeps a single monster sentence whole-ish instead of dropping it', () => {
    const monster = 'a'.repeat(1500);
    const chunks = chunkPage(monster, { maxChars: 500 });
    expect(chunks.join('').length).toBeGreaterThanOrEqual(1500);
  });

  it('returns nothing for an empty page', () => {
    expect(chunkPage('   ')).toEqual([]);
  });
});

describe('searchKnowledge', () => {
  it('finds the page that answers the question', () => {
    const hits = searchKnowledge('what is osmosis and solute concentration', [pdf, notes]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.page).toBe(2);
    expect(hits[0].chunk.text).toContain('Osmosis');
  });

  it('searches across notes and documents together', () => {
    const hits = searchKnowledge('first law of thermodynamics energy', [pdf, notes]);
    expect(hits[0].chunk.docId).toBe('note-1');
  });

  it('returns nothing (not a random page) for unrelated questions', () => {
    const hits = searchKnowledge('quantum chromodynamics lattice', [pdf, notes]);
    expect(hits).toEqual([]);
  });
});

describe('buildGroundedContext', () => {
  it('labels sources with the real document and page', () => {
    const grounded = buildGroundedContext('explain osmosis', [pdf, notes]);
    expect(grounded.confidence).not.toBe('none');
    expect(grounded.sources[0].page).toBe(2);
    expect(sourceLabel(grounded.sources[0])).toBe('Biology Chapter 3 · PDF p.2');
    expect(grounded.context).toContain('[1] Biology Chapter 3 · page 2');
  });

  it('admits when the material does not cover the question', () => {
    const grounded = buildGroundedContext('who won the 1998 world cup', [pdf, notes]);
    expect(grounded.confidence).toBe('none');
    expect(grounded.sources).toEqual([]);
    expect(grounded.context).toBe('');
    expect(groundingPrompt(grounded)).toMatch(/none matched/i);
  });

  it('tells the model never to invent a citation', () => {
    const prompt = groundingPrompt(buildGroundedContext('osmosis', [pdf]));
    expect(prompt).toMatch(/Never invent a page number/i);
    expect(prompt).toMatch(/\[1\]/);
  });

  it('caps the injected context so the prompt stays small', () => {
    const huge: KnowledgeDoc = {
      id: 'pdf-huge',
      title: 'Huge',
      kind: 'pdf',
      updatedAt: 3,
      pages: [Array.from({ length: 4000 }, (_, i) => `photosynthesis detail ${i}`).join(' ')],
    };
    const grounded = buildGroundedContext('photosynthesis detail', [huge], { maxChars: 1200 });
    expect(grounded.context.length).toBeLessThanOrEqual(1400);
  });
});

describe('knowledgeDocFromPdf', () => {
  it('keeps the filename as the title and the pages in order', () => {
    const doc = knowledgeDocFromPdf('Unit 3 - Plants.pdf', ['one', 'two']);
    expect(doc.title).toBe('Unit 3 - Plants');
    expect(doc.kind).toBe('pdf');
    expect(doc.pages).toHaveLength(2);
    expect(doc.id).toBe('pdf-unit-3-plants');
  });
});
