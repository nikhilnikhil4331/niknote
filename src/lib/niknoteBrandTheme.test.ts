import { describe, expect, it } from 'vitest';
import { blocksFromNoteText, noteTemplates } from '@/lib/noteTemplates';
import { getThemeCSS, getThemeClasses, UI_THEMES } from '@/utils/uiThemes';

describe('NikNote Compass & Paper brand preset', () => {
  it('registers the app theme with the logo-inspired colors and type pairing', () => {
    expect(UI_THEMES.some((theme) => theme.value === 'niknote-paper' && theme.label === 'Compass & Paper')).toBe(true);

    const css = getThemeCSS('niknote-paper') as Record<string, string>;
    expect(css['--theme-accent']).toBe('#2869d5');
    expect(css['--theme-coral']).toBe('#c83f58');
    expect(css['--theme-yellow']).toBe('#ffe45c');
    expect(css['--theme-display-font']).toContain('Fredoka');
    expect(css['--theme-handwriting-font']).toContain('Caveat');
    expect(getThemeClasses('niknote-paper').wrapper).toContain('#fff8e9');
  });

  it('provides a ready-to-write Compass Journal template with matching paper, font, and ink', () => {
    const template = noteTemplates.find((item) => item.title === 'NikNote Compass Journal');
    expect(template).toMatchObject({
      category: 'Notes',
      style: 'niknote-paper',
      layout: 'niknote',
      font: 'caveat',
      inkColor: 'blue',
    });

    const blocks = blocksFromNoteText(template!.text);
    expect(blocks.some((block) => block.content.includes('north star'))).toBe(true);
    expect(blocks.some((block) => block.type === 'todo')).toBe(true);
  });
});
