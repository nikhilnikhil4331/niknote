import { createBlock, detectBlockPrefix } from '@/types/block';
import type { PageStyle } from '@/types/notes';

export interface NoteTemplate {
  title: string;
  category: 'Notes' | 'Study' | 'Planner' | 'Other';
  text: string;
  desc: string;
  style: PageStyle;
  layout: 'blank' | 'lecture' | 'cornell' | 'planner' | 'checklist' | 'revision' | 'ideas' | 'journal';
}

export const noteTemplates: NoteTemplate[] = [
  { title: 'Blank Note', category: 'Notes', text: '', desc: 'A little room for anything', style: 'plain', layout: 'blank' },
  { title: 'Lecture Notes', category: 'Study', text: '# Lecture Notes\n## Topic\n\n## Key concepts\n\n## Questions\n', desc: 'Keep the important parts', style: 'ruled', layout: 'lecture' },
  { title: 'Cornell Notes', category: 'Study', text: '# Cornell Notes\n## Cues\n\n## Notes\n\n## Summary\n', desc: 'Capture. Recall. Remember.', style: 'cornell', layout: 'cornell' },
  { title: 'Daily Planner', category: 'Planner', text: '# Daily Planner\n## Top three\n[] First priority\n[] Second priority\n[] Third priority\n## Schedule\n\n## Reflection\n', desc: 'A day with a little direction', style: 'ruled', layout: 'planner' },
  { title: 'To Do List', category: 'Planner', text: '# To Do List\n[] First task\n[] Second task\n[] Third task', desc: 'Small steps, real progress', style: 'ruled', layout: 'checklist' },
  { title: 'Revision Sheet', category: 'Study', text: '# Revision Sheet\n## Key formulas\n\n## Definitions\n\n## Practice\n', desc: 'The essentials, all together', style: 'graph', layout: 'revision' },
  { title: 'Idea Board', category: 'Other', text: '# Idea Board\n## The idea\n\n## Connections\n• First connection\n• Second connection\n## Next steps\n[] Explore further', desc: 'Give your next idea a home', style: 'dotted', layout: 'ideas' },
  { title: 'Exam Prep', category: 'Study', text: '# Exam Prep\n## Topics to revise\n[] First topic\n[] Second topic\n## Practice questions\n\n## Final checklist\n[] Review weak areas', desc: 'A calmer path to exam day', style: 'ruled', layout: 'checklist' },
  { title: 'Daily Journal', category: 'Notes', text: '# Daily Journal\n## Today I feel\n\n## A moment to remember\n\n## I am grateful for\n\n', desc: 'A moment, just for you', style: 'plain', layout: 'journal' },
  { title: 'Project Plan', category: 'Other', text: '# Project Plan\n## The goal\n\n## Milestones\n[] First milestone\n[] Second milestone\n## Ideas & resources\n', desc: 'From a thought to a plan', style: 'dotted', layout: 'planner' },
];

export function blocksFromNoteText(text: string) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const normalized = line.replace(/^•\s/, '- ').replace(/^☐\s/, '[] ').replace(/^☑\s/, '[x] ');
    const prefix = detectBlockPrefix(normalized);
    const block = prefix ? createBlock(prefix.type, prefix.remaining) : createBlock('text', line);
    if (prefix?.type === 'todo') block.checked = /^\[[xX]\] /.test(normalized);
    return block;
  });
}