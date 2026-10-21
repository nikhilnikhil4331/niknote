// ============================================================
// lecture — spoken words into study notes.
//
// What this does NOT do: invent content. Every line it produces comes from the
// transcript; the only things added are structure (headings/bullets) and the
// removal of filler words. If the lecture never says "topic", no heading is
// invented.
//
// Speech arrives as one long stream with no punctuation. These heuristics are
// deliberately conservative: they only promote a sentence to a heading or a
// bullet when the speaker used an explicit cue.
// ============================================================

import { composeStudyNotes, type ComposedNote } from '@/lib/aiNotes';

const FILLERS = [
  /\b(um+|uh+|erm+|hmm+)\b/gi,
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bokay so\b/gi,
  /\bright so\b/gi,
  /\bso basically\b/gi,
];

const TOPIC_CUE = /^(?:today'?s? topic(?: is)?|aaj ka topic(?: hai)?|topic(?: is)?|chapter|unit|lecture)\b[\s:,-]*(.+)$/i;
const ENUMERATION_CUE = /\b(first|second|third|fourth|next|then|after that|finally|lastly|firstly|secondly)\b/i;
const DEFINITION_CUE = /^(.{3,60}?)\s(?:is|are|means|refers to|is called|is known as)\s(.{6,})$/i;
const EXAMPLE_CUE = /\b(for example|for instance|example mein|example)\b/i;

export interface LectureNotes {
  composed: ComposedNote;
  wordCount: number;
  headings: number;
  bullets: number;
  /** Sentences that were dropped as filler/duplicates. */
  dropped: number;
}

/** Lower-cased, de-fillered sentences, preserving what the speaker said. */
export function cleanTranscript(transcript: string): string[] {
  let text = String(transcript || '');
  for (const pattern of FILLERS) text = text.replace(pattern, ' ');

  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    // Speech starts with "Um," which leaves a leading comma after the filler.
    .map(sentence => sentence.replace(/^[\s,.;:–-]+/, '').trim())
    .filter(sentence => sentence.split(/\s+/).length >= 3);
}

/**
 * Convert a transcript into lightweight markdown, using only cues the speaker
 * actually gave. Then the existing note composer does the layout work.
 */
export function transcriptToMarkdown(transcript: string): { markdown: string; dropped: number } {
  const sentences = cleanTranscript(transcript);
  const out: string[] = [];
  let dropped = 0;

  for (const sentence of sentences) {
    const topic = TOPIC_CUE.exec(sentence);
    if (topic) {
      // "Today's topic is photosynthesis" → a real heading, not the whole line.
      const heading = topic[1].replace(/[.?!]+$/, '').trim();
      if (heading.length >= 3) {
        out.push(`## ${heading.charAt(0).toUpperCase()}${heading.slice(1)}`);
        continue;
      }
    }

    const definition = DEFINITION_CUE.exec(sentence);
    if (definition && !EXAMPLE_CUE.test(sentence)) {
      const term = definition[1].trim().replace(/^(the|a|an)\s+/i, '');
      const meaning = definition[2].replace(/[.?!]+$/, '').trim();
      out.push(`- **${term}** — ${meaning}`);
      continue;
    }

    if (ENUMERATION_CUE.test(sentence)) {
      const cleaned = sentence
        .replace(/^(and\s+)?(first|firstly|second|secondly|third|fourth|next|then|after that|finally|lastly)[,:]?\s*/i, '')
        .trim();
      if (cleaned.split(/\s+/).length >= 4) {
        out.push(`- ${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`);
        continue;
      }
      dropped += 1;
      continue;
    }

    if (EXAMPLE_CUE.test(sentence)) {
      out.push(`- Example: ${sentence.replace(/^(for example|for instance)[,:]?\s*/i, '')}`);
      continue;
    }

    out.push(sentence);
  }

  return { markdown: out.join('\n\n'), dropped };
}

export function lectureToNotes(transcript: string, options: { title?: string } = {}): LectureNotes {
  const { markdown, dropped } = transcriptToMarkdown(transcript);
  const composed = composeStudyNotes(markdown, {
    fallbackTitle: options.title || 'Lecture notes',
  });

  const wordCount = cleanTranscript(transcript).join(' ').split(/\s+/).filter(Boolean).length;
  const bullets = composed.lines.filter(
    line => line.blockType === 'bullet' || line.blockType === 'numbered',
  ).length;

  return {
    composed,
    wordCount,
    headings: composed.headings.length,
    bullets,
    dropped,
  };
}

/** Rough size of a transcript, for the UI ("~4 min of speech"). */
export function estimateSpokenMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 130));
}
