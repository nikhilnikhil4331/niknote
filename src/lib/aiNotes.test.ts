import { describe, expect, it } from 'vitest';
import { composeStudyNotes, fitLines, inferNoteTitle, inspectNoteDocument } from './aiNotes';
import { latexToText, looksLikeMath } from './mathText';

describe('latexToText', () => {
  it('turns common school formulas into readable maths', () => {
    expect(latexToText('E = mc^2')).toBe('E = mc²');
    expect(latexToText('\\frac{1}{2}mv^2')).toBe('1/2mv²');
    expect(latexToText('\\sqrt{x^2 + y^2}')).toBe('√(x² + y²)');
    expect(latexToText('\\alpha + \\beta = \\pi')).toBe('α + β = π');
    expect(latexToText('F = G \\frac{m_1 m_2}{r^2}')).toContain('m₁');
  });

  it('never leaks raw backslash commands', () => {
    const out = latexToText('\\unknowncommand{x} + \\frac{a}{b}');
    expect(out).not.toMatch(/\\[a-zA-Z]/);
  });

  it('detects standalone maths lines', () => {
    expect(looksLikeMath('$$F = ma$$')).toBe(true);
    expect(looksLikeMath('F = ma')).toBe(true);
    expect(looksLikeMath('Newton explained the motion of bodies in his book')).toBe(false);
  });
});

describe('fitLines', () => {
  it('keeps short lines intact and splits long prose on sentences', () => {
    expect(fitLines('Short line.')).toEqual(['Short line.']);
    const long = 'Photosynthesis converts light energy into chemical energy. It happens in the chloroplast. The process has two stages.';
    const lines = fitLines(long, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(long);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(80);
  });
});

describe('composeStudyNotes', () => {
  const answer = `Sure! Here is a clear explanation of Newton's laws.

# Newton's Laws of Motion

Newton's three laws describe how forces change motion. They are the foundation of classical mechanics and appear in almost every mechanics question.

## First Law
An object stays at rest or in uniform motion unless a net external force acts on it.

## Second Law
$$F = ma$$
The acceleration is proportional to the net force and inversely proportional to mass.

## Third Law
Every action has an equal and opposite reaction.

I hope this helps! Let me know if you want more examples.`;

  it('drops assistant chatter and keeps the real content', () => {
    const { lines, title } = composeStudyNotes(answer);
    const text = lines.map(l => l.text).join('\n');
    expect(text).not.toMatch(/^Sure!/m);
    expect(text).not.toMatch(/I hope this helps/);
    expect(text).toContain('Newton');
    expect(title).toMatch(/Newton/);
  });

  it('renders headings, equations and paragraphs as document elements', () => {
    const { lines } = composeStudyNotes(answer);
    expect(lines.some(l => l.blockType === 'h1')).toBe(true);
    expect(lines.some(l => l.blockType === 'h2')).toBe(true);
    const equation = lines.find(l => l.blockType === 'equation');
    expect(equation?.text.replace(/\s/g, '')).toBe('F=ma');
    expect(lines.every(l => !/[#]{2,}/.test(l.text))).toBe(true);
  });

  it('removes duplicated headings and repeated paragraphs', () => {
    const doc = `# Motion\n\nForce changes motion.\n\n## Summary\n\nForce changes motion.\n\n## Summary\n\nForce changes motion.`;
    const { lines } = composeStudyNotes(doc);
    const headings = lines.filter(l => /^h[1-3]$/.test(l.blockType || '')).map(l => l.text);
    expect(new Set(headings).size).toBe(headings.length);
    const body = lines.filter(l => l.blockType === 'text' && l.text.trim()).map(l => l.text);
    expect(new Set(body).size).toBe(body.length);
  });

  it('uses a restrained ink palette instead of a rainbow', () => {
    const { lines } = composeStudyNotes(answer);
    const colours = new Set(lines.map(l => l.color));
    expect(colours.size).toBeLessThanOrEqual(3);
    expect(colours.has('purple')).toBe(false);
    expect(colours.has('red')).toBe(false);
  });

  it('strips decorative emoji from academic content', () => {
    const { lines } = composeStudyNotes('# 🚀 Momentum\n\nMomentum is mass × velocity ✨');
    const text = lines.map(l => l.text).join(' ');
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(text).toContain('Momentum');
  });

  it('fits long paragraphs onto handwritable lines', () => {
    const long = `# Thermodynamics\n\n${'Entropy is a measure of the number of microscopic configurations that correspond to a thermodynamic system. '.repeat(6)}`;
    const { lines } = composeStudyNotes(long, { maxLineChars: 70 });
    const body = lines.filter(l => l.blockType === 'text');
    expect(body.length).toBeGreaterThan(3);
    for (const line of body) expect(line.text.length).toBeLessThanOrEqual(90);
  });

  it('keeps tables and code blocks as structured elements', () => {
    const doc = '# Table\n\n| Item | Cost |\n|---|---|\n| Pen | 10 |\n\n```js\nconst x = 1;\n```';
    const { lines } = composeStudyNotes(doc);
    expect(lines.some(l => l.blockType === 'code')).toBe(true);
    expect(lines.some(l => l.text.includes('Pen'))).toBe(true);
    expect(lines.some(l => l.text.includes('---'))).toBe(false);
  });

  it('is deterministic and safe on empty input', () => {
    expect(composeStudyNotes(answer)).toEqual(composeStudyNotes(answer));
    const empty = composeStudyNotes('');
    expect(Array.isArray(empty.lines)).toBe(true);
    expect(empty.title.length).toBeGreaterThan(0);
  });
});

describe('inferNoteTitle / inspectNoteDocument', () => {
  it('prefers the first heading and cleans punctuation', () => {
    expect(inferNoteTitle('## Photosynthesis:\nbody')).toBe('Photosynthesis');
    expect(inferNoteTitle('', 'Untitled')).toBe('Untitled');
  });

  it('reports local document health without inventing content', () => {
    const pages = [{ lines: [{ text: 'a' }] }, { lines: [{ text: '   ' }] }];
    const hints = inspectNoteDocument(
      [
        { text: 'Cells', blockType: 'h2' },
        { text: 'Cells', blockType: 'h2' },
        { text: 'Cells are the unit of life.' },
      ],
      pages,
      'Untitled Note',
    );
    expect(hints.wordCount).toBeGreaterThan(0);
    expect(hints.emptyPages).toBe(1);
    expect(hints.duplicateHeadings.length).toBe(1);
    expect(hints.untitled).toBe(true); // the note is still called "Untitled Note"
    expect(hints.suggestedTitle).toBeTruthy();
  });
});
