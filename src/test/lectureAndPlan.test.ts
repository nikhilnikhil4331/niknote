import { describe, expect, it } from 'vitest';
import { cleanTranscript, lectureToNotes, transcriptToMarkdown } from '@/lib/lecture';
import {
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  newTask,
  planSessions,
  tasksToIcs,
  type StudyTask,
} from '@/lib/studyPlan';

const lecture = [
  "Um, today's topic is photosynthesis.",
  'First, plants absorb light using chlorophyll in the leaves.',
  'Chlorophyll is the green pigment that captures light energy.',
  'Second, the light reactions produce ATP and NADPH.',
  'For example, in low light the rate of photosynthesis drops.',
  'Finally, the Calvin cycle fixes carbon dioxide into glucose.',
].join(' ');

describe('lecture transcript → notes', () => {
  it('removes filler words without changing the meaning', () => {
    const sentences = cleanTranscript('Um, so photosynthesis is how plants make food. You know, it needs light.');
    expect(sentences.join(' ')).not.toMatch(/\bum\b|\byou know\b/i);
    expect(sentences.join(' ')).toMatch(/photosynthesis is how plants make food/i);
  });

  it('promotes only explicit cues to headings', () => {
    const { markdown } = transcriptToMarkdown(lecture);
    expect(markdown).toMatch(/^## Photosynthesis/m);
    expect(markdown).toMatch(/^- \*\*Chlorophyll\*\* — the green pigment/m);
    expect(markdown.match(/^- /gm)?.length).toBeGreaterThanOrEqual(3);
  });

  it('does not invent a heading when the speaker gave none', () => {
    const plain = 'Plants use light to make sugar. Roots absorb water from the soil.';
    const { composed } = lectureToNotes(plain);
    expect(composed.headings).toEqual([]);
  });

  it('produces structured notes with counts for the UI', () => {
    const notes = lectureToNotes(lecture, { title: 'Bio lecture' });
    expect(notes.headings).toBeGreaterThanOrEqual(1);
    expect(notes.bullets).toBeGreaterThanOrEqual(2);
    expect(notes.wordCount).toBeGreaterThan(30);
    expect(notes.composed.lines.length).toBeGreaterThan(4);
  });
});

describe('study planner', () => {
  const base = (partial: Partial<StudyTask>): StudyTask => newTask(partial);

  it('never exceeds the daily budget when work fits', () => {
    const tasks = [
      base({ subject: 'Physics', topic: 'Thermodynamics', minutes: 60, dueDate: '2030-01-10' }),
      base({ subject: 'Chemistry', topic: 'Bonding', minutes: 60, dueDate: '2030-01-10' }),
      base({ subject: 'Maths', topic: 'Integrals', minutes: 40, dueDate: '2030-01-11', priority: 'high' }),
    ];
    const sessions = planSessions(tasks, { startDate: '2030-01-01', dailyMinutes: 90 });
    const perDay = new Map<string, number>();
    for (const session of sessions) {
      perDay.set(session.date, (perDay.get(session.date) || 0) + session.minutes);
    }
    for (const [, minutes] of perDay) expect(minutes).toBeLessThanOrEqual(90);
    expect(sessions.reduce((sum, s) => sum + s.minutes, 0)).toBe(160);
  });

  it('starts with the earliest deadline', () => {
    const tasks = [
      base({ subject: 'A', topic: 'later', minutes: 30, dueDate: '2030-02-01' }),
      base({ subject: 'B', topic: 'sooner', minutes: 30, dueDate: '2030-01-05' }),
    ];
    const sessions = planSessions(tasks, { startDate: '2030-01-01', dailyMinutes: 60 });
    expect(sessions[0].title).toContain('sooner');
  });

  it('ignores completed tasks', () => {
    const sessions = planSessions(
      [base({ topic: 'done already', minutes: 30, done: true })],
      { startDate: '2030-01-01' },
    );
    expect(sessions).toEqual([]);
  });
});

describe('calendar export', () => {
  const task = newTask({
    subject: 'Physics; revision',
    topic: 'Thermodynamics, chapter 4',
    minutes: 50,
    dueDate: '2030-01-10',
    priority: 'high',
    preferredHour: 19,
  });

  it('escapes the characters RFC 5545 reserves', () => {
    expect(escapeIcsText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
  });

  it('folds long lines at 75 octets with CRLF continuations', () => {
    const folded = foldIcsLine(`SUMMARY:${'x'.repeat(200)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(lines[1].startsWith(' ')).toBe(true);
  });

  it('writes a standard calendar with a reminder alarm', () => {
    const ics = tasksToIcs([task], { now: new Date('2030-01-01T00:00:00Z') });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Physics\\; revision: Thermodynamics\\, chapter 4');
    expect(ics).toContain(`UID:${task.id}@niknote.online`);
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT15M');
    // Every content line must be CRLF terminated, never a bare LF.
    expect(/(?<!\r)\n/.test(ics)).toBe(false);
  });

  it('produces a valid empty calendar rather than throwing', () => {
    const ics = tasksToIcs([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('skips finished tasks and keeps UIDs unique', () => {
    const second = newTask({ topic: 'Second', dueDate: '2030-01-12' });
    const ics = tasksToIcs([task, second, { ...task, done: true }]);
    const uids = [...ics.matchAll(/UID:([^\r\n]+)/g)].map(m => m[1]);
    expect(uids).toHaveLength(2);
    expect(new Set(uids).size).toBe(2);
  });

  it('offers a Google Calendar template link without pretending it created one', () => {
    const url = googleCalendarUrl(task);
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('calendar.google.com');
    expect(decodeURIComponent(url)).toContain('Thermodynamics');
  });
});
