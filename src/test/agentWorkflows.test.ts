import { describe, expect, it, vi } from 'vitest';
import {
  buildOrganisationPrompt,
  buildStudyPlanPrompt,
  buildSuggestedPrompts,
  chunkText,
  pageToText,
  parseOrganisation,
  parsePlan,
  summariseNote,
} from '../lib/agentWorkflows';

describe('chunkText', () => {
  it('returns [] for empty input and one chunk for short text', () => {
    expect(chunkText('   \n ')).toEqual([]);
    expect(chunkText('hello world')).toEqual(['hello world']);
  });
  it('splits on line boundaries without losing content', () => {
    const text = Array.from({ length: 10 }, (_, i) => `line ${i} ` + 'x'.repeat(50)).join('\n');
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.length <= 200)).toBe(true);
    expect(chunks.join('\n').replace(/\n/g, '')).toBe(text.replace(/\n/g, ''));
  });
  it('hard-splits a single oversized paragraph', () => {
    const chunks = chunkText('a'.repeat(500), 200);
    expect(chunks).toEqual(['a'.repeat(200), 'a'.repeat(200), 'a'.repeat(100)]);
  });
});

describe('pageToText', () => {
  it('joins block content and ignores non-string blocks', () => {
    expect(pageToText([{ content: 'one' }, { type: 'divider' }, { content: 'two' }, null])).toBe('one\ntwo');
    expect(pageToText('nope')).toBe('');
  });
});

describe('summariseNote', () => {
  it('uses one call for short notes', async () => {
    const call = vi.fn(async (p: string) => `echo:${p.slice(0, 10)}`);
    await summariseNote('short note', call);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('maps chunks then reduces once for long notes', async () => {
    const text = Array.from({ length: 60 }, (_, i) => `para ${i} ` + 'y'.repeat(150)).join('\n');
    const call = vi.fn(async () => 'part summary');
    const steps: string[] = [];
    await summariseNote(text, call, s => steps.push(s));
    const chunks = chunkText(text).length;
    expect(chunks).toBeGreaterThan(1);
    expect(call).toHaveBeenCalledTimes(chunks + 1);
    expect(steps[steps.length - 1]).toContain('Combining');
  });
});

describe('parseOrganisation', () => {
  const good = { groups: [{ name: 'Physics', notes: ['Motion', 'Optics'], reason: 'mechanics + light' }] };
  it('parses clean JSON', () => {
    expect(parseOrganisation(JSON.stringify(good))).toEqual([
      { name: 'Physics', notes: ['Motion', 'Optics'], reason: 'mechanics + light' },
    ]);
  });
  it('parses JSON wrapped in prose or fences', () => {
    expect(parseOrganisation(`Here you go:\n\`\`\`json\n${JSON.stringify(good)}\n\`\`\``)).toHaveLength(1);
  });
  it('returns [] for garbage and drops empty groups', () => {
    expect(parseOrganisation('no json here')).toEqual([]);
    expect(parseOrganisation('{"groups":[{"name":"x","notes":[]}]}')).toEqual([]);
  });
});

describe('parsePlan', () => {
  it('strips bullets, numbers and blanks', () => {
    expect(parsePlan('Day 1: read\n- Day 2: revise\n\n3) mock test\n   ')).toEqual([
      'Day 1: read',
      'Day 2: revise',
      'mock test',
    ]);
  });
});

describe('prompt builders', () => {
  it('organisation prompt carries every title and the JSON contract', () => {
    const p = buildOrganisationPrompt([{ title: 'Motion', preview: 'newton…' }]);
    expect(p).toContain('Motion');
    expect(p).toContain('"groups"');
  });
  it('study plan prompt carries days and titles', () => {
    const p = buildStudyPlanPrompt(['Motion', 'Optics'], 5);
    expect(p).toContain('5-day');
    expect(p).toContain('Optics');
  });
  it('suggested prompts mention the note and fall back without one', () => {
    expect(buildSuggestedPrompts('Optics')[0]).toContain('Optics');
    expect(buildSuggestedPrompts()[0]).toContain('my notes');
    expect(buildSuggestedPrompts()).toHaveLength(4);
  });
});
