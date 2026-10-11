import type { PaperEffects, PenType } from '@/components/paper/PaperEffects';
export type HandwritingFont = 
  | 'caveat'
  | 'kalam'
  | 'patrick-hand'
  | 'shadows-into-light'
  | 'indie-flower'
  | 'dancing-script'
  | 'architects-daughter'
  | 'satisfy'
  | 'gloria-hallelujah'
  | 'covered-by-your-grace'
  | 'rock-salt'
  | 'reenie-beanie'
  | 'homemade-apple'
  | 'nothing-you-could-do'
  | 'cedarville-cursive'
  | 'la-belle-aurore'
  | 'roman-regular'
  | 'roman-serif'
  | 'roman-mono'
  | 'custom';

export type PageStyle = 
  | 'plain' 
  | 'ruled' 
  | 'single-line' 
  | 'graph' 
  | 'dotted' 
  | 'college' 
  | 'legal'
  | 'spiral'
  | 'hole-punched'
  | 'vintage'
  | 'kraft'
  | 'blueprint'
  | 'music-sheet'
  | 'cornell';

export type InkColor = 'blue' | 'black' | 'red' | 'green' | 'purple' | 'brown' | 'teal' | 'orange' | 'pink' | 'gold' | 'navy' | 'burgundy';

export type PageSize = 'a4' | 'a3' | 'a2' | 'a1';

export const PAGE_SIZE_OPTIONS: { value: PageSize; label: string; width: number; height: number; description: string }[] = [
  { value: 'a4', label: 'A4', width: 595, height: 842, description: '210 × 297 mm' },
  { value: 'a3', label: 'A3', width: 842, height: 1191, description: '297 × 420 mm' },
  { value: 'a2', label: 'A2', width: 1191, height: 1684, description: '420 × 594 mm' },
  { value: 'a1', label: 'A1', width: 1684, height: 2384, description: '594 × 841 mm' },
];

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface HeaderFooter {
  name: string;
  rollNo: string;
  subject: string;
  showHeader: boolean;
  showFooter: boolean;
  showPageNumber: boolean;
}

export interface TableConfig {
  enabled: boolean;
  rows: number;
  columns: number;
  showBorders: boolean;
  headerRow: boolean;
}

export interface DiagramImage {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  position: 'inline' | 'left' | 'right' | 'center';
}

export interface CustomHandwritingStyle {
  id: string;
  name: string;
  fontSize: number;
  lineSpacing: number;
  wordSpacing: number;
  letterSpacing: number;
  slant: number;
  baselineJitter: number;
  strokeRandomness: number;
  baseFont: HandwritingFont;
}

export interface NoteSettings {
  font: HandwritingFont;
  fontSize: number;
  lineSpacing: number;
  wordSpacing: number;
  pageStyle: PageStyle;
  pageSize: PageSize;
  inkColor: InkColor;
  margins: PageMargins;
  headerFooter: HeaderFooter;
  baselineJitter: boolean;
  strokeRandomness: boolean;
  table: TableConfig;
  customStyle?: CustomHandwritingStyle;
  showMarginLine: boolean;
  paperEffects?: PaperEffects;
  penType?: PenType;
}

export const DEFAULT_SETTINGS: NoteSettings = {
  font: 'roman-regular',
  fontSize: 24,
  lineSpacing: 32,
  wordSpacing: 4,
  pageStyle: 'plain',
  pageSize: 'a4',
  inkColor: 'blue',
  margins: {
    // Desktop margins - these are used in preview/export
    top: 56,
    right: 48,
    bottom: 72,
    left: 48,
  },
  headerFooter: {
    name: '',
    rollNo: '',
    subject: '',
    showHeader: false,
    showFooter: false,
    showPageNumber: false,
  },
  showMarginLine: false,
  baselineJitter: true,
  strokeRandomness: true,
  table: {
    enabled: false,
    rows: 4,
    columns: 3,
    showBorders: true,
    headerRow: true,
  },
};

export const FONT_OPTIONS: { value: HandwritingFont; label: string; className: string; category: string }[] = [
  // Casual & Natural
  { value: 'caveat', label: 'Caveat', className: 'font-handwriting-1', category: 'Casual' },
  { value: 'kalam', label: 'Kalam', className: 'font-handwriting-2', category: 'Casual' },
  { value: 'patrick-hand', label: 'Patrick Hand', className: 'font-handwriting-3', category: 'Casual' },
  { value: 'architects-daughter', label: 'Architects Daughter', className: 'font-handwriting-7', category: 'Casual' },
  { value: 'gloria-hallelujah', label: 'Gloria Hallelujah', className: 'font-handwriting-9', category: 'Casual' },
  // Messy & Authentic  
  { value: 'shadows-into-light', label: 'Shadows Into Light', className: 'font-handwriting-4', category: 'Messy' },
  { value: 'indie-flower', label: 'Indie Flower', className: 'font-handwriting-5', category: 'Messy' },
  { value: 'covered-by-your-grace', label: 'Covered By Your Grace', className: 'font-handwriting-10', category: 'Messy' },
  { value: 'reenie-beanie', label: 'Reenie Beanie', className: 'font-handwriting-12', category: 'Messy' },
  { value: 'rock-salt', label: 'Rock Salt', className: 'font-handwriting-11', category: 'Messy' },
  // Cursive & Elegant
  { value: 'dancing-script', label: 'Dancing Script', className: 'font-handwriting-6', category: 'Cursive' },
  { value: 'satisfy', label: 'Satisfy', className: 'font-handwriting-8', category: 'Cursive' },
  { value: 'homemade-apple', label: 'Homemade Apple', className: 'font-handwriting-13', category: 'Cursive' },
  { value: 'nothing-you-could-do', label: 'Nothing You Could Do', className: 'font-handwriting-14', category: 'Cursive' },
  { value: 'cedarville-cursive', label: 'Cedarville Cursive', className: 'font-handwriting-15', category: 'Cursive' },
  { value: 'la-belle-aurore', label: 'La Belle Aurore', className: 'font-handwriting-16', category: 'Cursive' },
  // Roman (Latin) — Clean typed look
  { value: 'roman-regular', label: 'Roman Regular', className: 'font-roman-regular', category: 'Roman' },
  { value: 'roman-serif', label: 'Roman Serif', className: 'font-roman-serif', category: 'Roman' },
  { value: 'roman-mono', label: 'Roman Mono', className: 'font-roman-mono', category: 'Roman' },
  // Custom
  { value: 'custom', label: 'Custom Style', className: 'font-custom-handwriting', category: 'AI Generated' },
];

export const PAGE_STYLE_OPTIONS: { value: PageStyle; label: string; description: string; category: string }[] = [
  // Basic Styles
  { value: 'plain', label: 'Plain', description: 'No lines', category: 'Basic' },
  { value: 'ruled', label: 'Ruled', description: 'Horizontal lines', category: 'Basic' },
  { value: 'single-line', label: 'Wide Ruled', description: 'Spaced lines', category: 'Basic' },
  { value: 'college', label: 'College', description: 'Narrow ruled', category: 'Basic' },
  // Grid Styles
  { value: 'graph', label: 'Graph Paper', description: 'Grid squares', category: 'Grid' },
  { value: 'dotted', label: 'Dotted', description: 'Dot grid', category: 'Grid' },
  // Notebook Styles
  { value: 'spiral', label: 'Spiral Notebook', description: 'With spiral binding', category: 'Notebook' },
  { value: 'hole-punched', label: 'Hole Punched', description: '3-hole binder paper', category: 'Notebook' },
  { value: 'cornell', label: 'Cornell Notes', description: 'Study note format', category: 'Notebook' },
  // Special Styles
  { value: 'legal', label: 'Legal Pad', description: 'Yellow legal paper', category: 'Special' },
  { value: 'vintage', label: 'Vintage', description: 'Aged paper effect', category: 'Special' },
  { value: 'kraft', label: 'Kraft Paper', description: 'Brown craft paper', category: 'Special' },
  { value: 'blueprint', label: 'Blueprint', description: 'Technical blue paper', category: 'Special' },
  { value: 'music-sheet', label: 'Music Sheet', description: 'Staff lines', category: 'Special' },
];

export const INK_COLOR_OPTIONS: { value: InkColor; label: string; colorClass: string; hex: string }[] = [
  // Classic
  { value: 'black', label: 'Black', colorClass: 'bg-ink-black', hex: '#1a1a2e' },
  { value: 'blue', label: 'Blue', colorClass: 'bg-ink-blue', hex: '#1565c0' },
  { value: 'red', label: 'Red', colorClass: 'bg-ink-red', hex: '#d32f2f' },
  { value: 'green', label: 'Green', colorClass: 'bg-ink-green', hex: '#2e7d32' },
  // Extended
  { value: 'purple', label: 'Purple', colorClass: 'bg-ink-purple', hex: '#7b1fa2' },
  { value: 'brown', label: 'Brown', colorClass: 'bg-ink-brown', hex: '#795548' },
  { value: 'teal', label: 'Teal', colorClass: 'bg-ink-teal', hex: '#00897b' },
  { value: 'orange', label: 'Orange', colorClass: 'bg-ink-orange', hex: '#ef6c00' },
  // Premium
  { value: 'pink', label: 'Pink', colorClass: 'bg-ink-pink', hex: '#d81b60' },
  { value: 'navy', label: 'Navy', colorClass: 'bg-ink-navy', hex: '#1a237e' },
  { value: 'burgundy', label: 'Burgundy', colorClass: 'bg-ink-burgundy', hex: '#880e4f' },
  { value: 'gold', label: 'Gold', colorClass: 'bg-ink-gold', hex: '#ff8f00' },
];
