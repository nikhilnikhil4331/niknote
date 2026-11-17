export const PLAYGROUND_STORAGE_KEY = 'niknote.playground.canvas.v1';
export const PLAYGROUND_MAX_ITEMS = 24;

export const PLAYGROUND_THEMES = [
  { id: 'paper', label: 'Warm paper', background: '#fffdf5' },
  { id: 'sky', label: 'Blue grid', background: '#eff5ff' },
  { id: 'rose', label: 'Coral dots', background: '#fff2f0' },
  { id: 'night', label: 'Night desk', background: '#17243c' },
] as const;

export const PLAYGROUND_COLORS = [
  { id: 'sun', label: 'Compass yellow', fill: '#ffe45c', ink: '#171313', border: '#171313' },
  { id: 'sky', label: 'Notebook blue', fill: '#dceaff', ink: '#173a71', border: '#347ff0' },
  { id: 'coral', label: 'Coral pink', fill: '#fff0f0', ink: '#702938', border: '#c83f58' },
  { id: 'mint', label: 'Fresh mint', fill: '#e4f5eb', ink: '#165844', border: '#247957' },
  { id: 'paper', label: 'Paper white', fill: '#fffdf5', ink: '#171313', border: '#171313' },
  { id: 'ink', label: 'Deep blue', fill: '#173a71', ink: '#ffffff', border: '#10294e' },
] as const;

export type PlaygroundThemeId = (typeof PLAYGROUND_THEMES)[number]['id'];
export type PlaygroundColorId = (typeof PLAYGROUND_COLORS)[number]['id'];
export type PlaygroundItemKind = 'note' | 'checklist' | 'bubble' | 'star';
export type PlaygroundTemplateId = 'idea-garden' | 'daily-reset' | 'story-beats' | 'revision-map';

export interface PlaygroundItem {
  id: string;
  kind: PlaygroundItemKind;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: PlaygroundColorId;
  text: string;
  checked?: boolean[];
}

export interface PlaygroundBoard {
  title: string;
  theme: PlaygroundThemeId;
  items: PlaygroundItem[];
}

const templateItem = (
  id: string,
  kind: PlaygroundItemKind,
  x: number,
  y: number,
  color: PlaygroundColorId,
  text: string,
  rotation = 0,
): PlaygroundItem => ({
  id,
  kind,
  x,
  y,
  rotation,
  scale: 1,
  color,
  text,
  ...(kind === 'checklist' ? { checked: [true, false, false, false] } : {}),
});

export function createStarterBoard(template: PlaygroundTemplateId = 'idea-garden'): PlaygroundBoard {
  switch (template) {
    case 'daily-reset':
      return {
        title: 'A softer start',
        theme: 'sky',
        items: [
          templateItem('daily-checklist', 'checklist', 31, 48, 'sun', 'Make the bed\nDrink a glass of water\nPick one small priority', -2),
          templateItem('daily-note', 'note', 70, 31, 'coral', 'Start where you are. Use what you have.', 3),
          templateItem('daily-star', 'star', 72, 73, 'sky', 'one thing at a time', -8),
        ],
      };
    case 'story-beats':
      return {
        title: 'A story in little steps',
        theme: 'rose',
        items: [
          templateItem('story-one', 'note', 27, 34, 'sky', '01 · The beginning\nA curious question', -4),
          templateItem('story-two', 'bubble', 69, 32, 'sun', 'Then everything changed…', 3),
          templateItem('story-three', 'note', 34, 70, 'coral', '02 · The middle\nTry, learn, try again', 2),
          templateItem('story-star', 'star', 72, 72, 'mint', 'keep the good bit', -7),
        ],
      };
    case 'revision-map':
      return {
        title: 'Tiny steps, big revision',
        theme: 'night',
        items: [
          templateItem('revision-note', 'note', 31, 36, 'paper', 'One topic at a time\nExplain it in your own words.', -2),
          templateItem('revision-list', 'checklist', 68, 48, 'sun', 'Read the summary\nRecall without looking\nMake two flashcards', 2),
          templateItem('revision-bubble', 'bubble', 35, 73, 'sky', 'What is still a little fuzzy?', -2),
          templateItem('revision-star', 'star', 73, 75, 'coral', 'you are learning', 7),
        ],
      };
    case 'idea-garden':
    default:
      return {
        title: 'Little idea garden',
        theme: 'paper',
        items: [
          templateItem('garden-note', 'note', 29, 36, 'sky', 'A tiny idea can grow into something lovely.', -3),
          templateItem('garden-bubble', 'bubble', 71, 32, 'coral', 'What if we made room for more play?', 3),
          templateItem('garden-list', 'checklist', 36, 72, 'sun', 'Collect the bright bits\nAdd a little colour\nMake it yours', 2),
          templateItem('garden-star', 'star', 75, 73, 'mint', 'little by little', -7),
        ],
      };
  }
}

export function createCanvasItem(kind: PlaygroundItemKind, itemCount: number): PlaygroundItem {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const presets: Record<PlaygroundItemKind, { color: PlaygroundColorId; text: string }> = {
    note: { color: 'sun', text: 'Write a bright little thought…' },
    checklist: { color: 'sky', text: 'First little step\nAnother small thing\nCelebrate the done' },
    bubble: { color: 'coral', text: 'What if…?' },
    star: { color: 'mint', text: 'Keep this idea close' },
  };
  const preset = presets[kind];
  return {
    id,
    kind,
    x: Math.min(77, 36 + (itemCount % 4) * 9),
    y: Math.min(78, 32 + (itemCount % 3) * 10),
    rotation: kind === 'star' ? -7 : 0,
    scale: 1,
    color: preset.color,
    text: preset.text,
    ...(kind === 'checklist' ? { checked: [false, false, false] } : {}),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is PlaygroundThemeId =>
  PLAYGROUND_THEMES.some((theme) => theme.id === value);

const isColor = (value: unknown): value is PlaygroundColorId =>
  PLAYGROUND_COLORS.some((color) => color.id === value);

const isKind = (value: unknown): value is PlaygroundItemKind =>
  value === 'note' || value === 'checklist' || value === 'bubble' || value === 'star';

const boundedNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
};

function normalizeItem(value: unknown, index: number): PlaygroundItem | null {
  if (!isRecord(value) || !isKind(value.kind)) return null;
  const kind = value.kind;
  const text = typeof value.text === 'string' ? value.text.slice(0, 500) : '';
  const checked = Array.isArray(value.checked)
    ? value.checked.slice(0, 8).map((item) => item === true)
    : undefined;
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id.slice(0, 100) : `saved-piece-${index}`,
    kind,
    x: boundedNumber(value.x, 50, 20, 80),
    y: boundedNumber(value.y, 50, 20, 80),
    rotation: boundedNumber(value.rotation, 0, -12, 12),
    scale: boundedNumber(value.scale, 1, 0.75, 1.3),
    color: isColor(value.color) ? value.color : 'paper',
    text,
    ...(kind === 'checklist' ? { checked: checked ?? [] } : {}),
  };
}

export function parsePlaygroundBoard(raw: string | null): PlaygroundBoard | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const normalizedItems = Array.isArray(parsed.items)
      ? parsed.items.slice(0, PLAYGROUND_MAX_ITEMS).map(normalizeItem).filter((item): item is PlaygroundItem => item !== null)
      : [];
    const seenIds = new Set<string>();
    const items = normalizedItems.map((item, index) => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        return item;
      }
      const baseId = `saved-piece-${index}`;
      let id = baseId;
      let suffix = 1;
      while (seenIds.has(id)) id = `${baseId}-${suffix++}`;
      seenIds.add(id);
      return { ...item, id };
    });
    return {
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 80) : 'Little idea garden',
      theme: isTheme(parsed.theme) ? parsed.theme : 'paper',
      items,
    };
  } catch {
    return null;
  }
}

export function escapeSvgText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return escaped[character];
  });
}

function wrapLines(value: string, maxCharacters: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && `${line} ${word}`.length > maxCharacters) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  return lines.length ? lines : [''];
}

function svgLines(lines: string[], x: number, y: number, ink: string, fontSize = 27): string {
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="Caveat, Kalam, cursive" font-size="${fontSize}" font-weight="600">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize + 7}">${escapeSvgText(line)}</tspan>`)
    .join('')}</text>`;
}

function renderSvgItem(item: PlaygroundItem): string {
  const color = PLAYGROUND_COLORS.find((entry) => entry.id === item.color) ?? PLAYGROUND_COLORS[4];
  const x = 80 + (item.x / 100) * 1240;
  const y = 72 + (item.y / 100) * 720;
  const transform = `translate(${x} ${y}) rotate(${item.rotation}) scale(${item.scale})`;
  const escapedText = wrapLines(item.text, 24, 5);

  if (item.kind === 'star') {
    return `<g transform="${transform}"><circle cx="0" cy="0" r="72" fill="${color.fill}" stroke="${color.border}" stroke-width="4"/><text x="0" y="-2" text-anchor="middle" dominant-baseline="middle" fill="${color.ink}" font-size="82" font-family="system-ui,sans-serif">✦</text>${svgLines(wrapLines(item.text, 18, 2), 0, 112, color.ink, 22).replace('<text ', '<text text-anchor="middle" ')}</g>`;
  }

  const fill = color.fill;
  const ink = color.ink;
  const paper = `<rect x="-145" y="-102" width="290" height="204" rx="22" fill="${fill}" stroke="${color.border}" stroke-width="4"/>`;
  const label = item.kind === 'checklist' ? 'LITTLE CHECKLIST' : item.kind === 'bubble' ? 'A THOUGHT' : 'STICKY NOTE';
  const header = `<text x="-116" y="-65" fill="${ink}" opacity=".68" font-family="Inter,system-ui,sans-serif" font-size="15" font-weight="800" letter-spacing="2">${label}</text>`;
  const rows = item.kind === 'checklist'
    ? wrapLines(item.text, 20, 4).map((line, index) => {
      const checked = item.checked?.[index] === true;
      const rowY = -19 + index * 35;
      return `<circle cx="-116" cy="${rowY - 7}" r="8" fill="${checked ? '#2869d5' : 'none'}" stroke="${checked ? '#2869d5' : ink}" stroke-width="2.5"/>${checked ? `<path d="M-120 ${rowY - 7}l3 3 6-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}<text x="-96" y="${rowY}" fill="${ink}" font-family="Caveat,Kalam,cursive" font-size="22">${escapeSvgText(line)}</text>`;
    }).join('')
    : svgLines(escapedText, -116, -17, ink, 29);
  const bubbleTail = item.kind === 'bubble' ? `<path d="M45 82l25 31-3-36" fill="${fill}" stroke="${color.border}" stroke-width="4" stroke-linejoin="round"/>` : '';
  return `<g transform="${transform}">${bubbleTail}${paper}${header}${rows}</g>`;
}

export function createPlaygroundSvg(board: PlaygroundBoard): string {
  const background = PLAYGROUND_THEMES.find((theme) => theme.id === board.theme)?.background ?? '#fffdf5';
  const grid = board.theme === 'paper'
    ? `<path d="M0 112H1400" stroke="#c83f58" stroke-opacity=".22" stroke-width="3"/><path d="M72 0V900" stroke="#c83f58" stroke-opacity=".25" stroke-width="3"/>${Array.from({ length: 24 }, (_, index) => `<path d="M0 ${160 + index * 30}H1400" stroke="#347ff0" stroke-opacity=".12" stroke-width="2"/>`).join('')}`
    : board.theme === 'sky'
      ? `<path d="M80 0V900M160 0V900M240 0V900M320 0V900M400 0V900M480 0V900M560 0V900M640 0V900M720 0V900M800 0V900M880 0V900M960 0V900M1040 0V900M1120 0V900M1200 0V900M1280 0V900M1360 0V900M0 80H1400M0 160H1400M0 240H1400M0 320H1400M0 400H1400M0 480H1400M0 560H1400M0 640H1400M0 720H1400M0 800H1400M0 880H1400" stroke="#347ff0" stroke-opacity=".10" stroke-width="1.5"/>`
      : board.theme === 'rose'
        ? Array.from({ length: 12 }, (_, row) => Array.from({ length: 18 }, (_, column) => `<circle cx="${40 + column * 80}" cy="${40 + row * 80}" r="2" fill="#c83f58" fill-opacity=".19"/>`).join('')).join('')
        : Array.from({ length: 15 }, (_, row) => Array.from({ length: 23 }, (_, column) => `<circle cx="${30 + column * 62}" cy="${30 + row * 62}" r="2" fill="#fffdf5" fill-opacity=".2"/>`).join('')).join('');
  const rawTitle = board.title || 'NikNote Playground';
  const title = escapeSvgText(rawTitle);
  const displayTitle = escapeSvgText(rawTitle.toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900" role="img" aria-labelledby="title description"><title id="title">${title} — NikNote Playground</title><desc id="description">A creative note board with movable sticky notes, checklists, thought bubbles and stars.</desc><rect width="1400" height="900" fill="${background}"/><g aria-hidden="true">${grid}</g><text x="58" y="58" fill="${board.theme === 'night' ? '#fffdf5' : '#171313'}" opacity=".6" font-family="Inter,system-ui,sans-serif" font-size="18" font-weight="700" letter-spacing="3">${displayTitle}</text>${board.items.map(renderSvgItem).join('')}</svg>`;
}
