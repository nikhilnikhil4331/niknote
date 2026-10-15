/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { blocksFromNoteText, noteTemplates } from './noteTemplates';

test('to-do template creates three editable unchecked tasks, not checkbox text', () => {
  const template = noteTemplates.find(t => t.title === 'To Do List');
  expect(template).toBeDefined();
  const tasks = blocksFromNoteText(template?.text ?? '').filter(b => b.type === 'todo');
  expect(tasks.map(b => [b.content, b.checked])).toEqual([['First task', false], ['Second task', false], ['Third task', false]]);
});
test('sample bullets and unicode checkboxes become interactive blocks', () => {
  expect(blocksFromNoteText('• Idea\n☐ Task\n☑ Done').map(b => [b.type, b.content, b.checked])).toEqual([
    ['bullet', 'Idea', undefined], ['todo', 'Task', false], ['todo', 'Done', true],
  ]);
});
test('blank templates replace previous content with one empty block', () => {
  const blocks = blocksFromNoteText('');
  expect(blocks.length).toBe(1);
  expect(blocks[0].content).toBe('');
});
test('template headings and blank writing spaces survive conversion', () => {
  expect(blocksFromNoteText('# Title\n## Topic\r\n\nBody').map(b => [b.type, b.content])).toEqual([
    ['heading1', 'Title'], ['heading2', 'Topic'], ['text', ''], ['text', 'Body'],
  ]);
});