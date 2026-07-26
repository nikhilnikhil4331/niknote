// ============================================================
// NikNote 4.0 — Enhanced Block System
// Notion-level blocks with 25+ types
// Every block type that Notion has, plus AI-powered enhancements
// ============================================================

export type BlockType =
  // Text blocks
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  // Rich content blocks (NEW)
  | 'toggle'        // Collapsible section
  | 'image'         // Image embed
  | 'video'         // Video embed
  | 'audio'         // Audio embed
  | 'bookmark'      // URL bookmark card
  | 'embed'         // Generic embed (iframe)
  | 'equation'      // LaTeX / Math block
  | 'mermaid'       // Mermaid diagram
  | 'table'         // Inline table
  | 'column'        // Multi-column layout
  | 'synced'        // Synced block (same content in multiple pages)
  | 'ai-generated'  // AI-generated content block
  | 'pdf'           // PDF embed
  | 'file'          // File attachment
  | 'breadcrumb'    // Page breadcrumb
  | 'table_of_contents' // Auto TOC
  | 'mention'       // @mention
  | 'comment'       // Inline comment
  | 'flashcard'     // Study flashcard (front/back, spaced repetition)

export interface BlockColumn {
  id: string;
  ratio: number; // Width ratio (e.g., 0.5 = 50%)
  blocks: Block[];
}

export interface BlockCell {
  id: string;
  content: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'date';
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;        // for todo
  color?: string;           // ink color
  indent?: number;          // nesting level
  // NEW: Rich block properties
  url?: string;             // for image, video, bookmark, embed, pdf, file
  caption?: string;         // for image, video, embed
  language?: string;        // for code blocks (e.g., 'javascript', 'python')
  emoji?: string;           // for callout emoji, toggle icon
  collapsed?: boolean;      // for toggle blocks
  columns?: BlockColumn[];  // for column blocks
  tableData?: {             // for table blocks
    rows: BlockCell[][];
    headers: string[];
    colCount: number;
  };
  // AI properties
  aiPrompt?: string;        // original AI prompt
  aiModel?: string;         // which model generated it
  // Sync
  syncId?: string;          // for synced blocks
  // Metadata
  createdAt?: number;
  updatedAt?: number;
  // Flashcard
  front?: string;
  back?: string;
}

export const generateBlockId = (): string =>
  `block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const createBlock = (type: BlockType = 'text', content = ''): Block => ({
  id: generateBlockId(),
  type,
  content,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// ============================================================
// Slash Commands — Complete Notion-style command list
// ============================================================

export interface SlashCommand {
  id: BlockType;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
  category: 'basic' | 'media' | 'database' | 'ai' | 'advanced';
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Basic blocks
  { id: 'text', label: 'Text', description: 'Plain text block', icon: '📝', category: 'basic' },
  { id: 'heading1', label: 'Heading 1', description: 'Large section heading', icon: 'H₁', shortcut: '#', category: 'basic' },
  { id: 'heading2', label: 'Heading 2', description: 'Medium section heading', icon: 'H₂', shortcut: '##', category: 'basic' },
  { id: 'heading3', label: 'Heading 3', description: 'Small section heading', icon: 'H₃', shortcut: '###', category: 'basic' },
  { id: 'bullet', label: 'Bullet List', description: 'Unordered list item', icon: '•', shortcut: '-', category: 'basic' },
  { id: 'numbered', label: 'Numbered List', description: 'Ordered list item', icon: '1.', shortcut: '1.', category: 'basic' },
  { id: 'todo', label: 'To-do', description: 'Checkbox item', icon: '☐', shortcut: '[]', category: 'basic' },
  { id: 'quote', label: 'Quote', description: 'Block quote', icon: '❝', shortcut: '>', category: 'basic' },
  { id: 'callout', label: 'Callout', description: 'Highlighted callout box', icon: '💡', category: 'basic' },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule', icon: '—', shortcut: '---', category: 'basic' },
  { id: 'code', label: 'Code', description: 'Code block', icon: '<>', category: 'basic' },
  { id: 'toggle', label: 'Toggle', description: 'Collapsible section', icon: '▶', category: 'basic' },

  // Media blocks
  { id: 'image', label: 'Image', description: 'Upload or embed image', icon: '🖼️', category: 'media' },
  { id: 'video', label: 'Video', description: 'Embed video', icon: '🎥', category: 'media' },
  { id: 'audio', label: 'Audio', description: 'Embed audio', icon: '🎵', category: 'media' },
  { id: 'bookmark', label: 'Bookmark', description: 'Web bookmark card', icon: '🔗', category: 'media' },
  { id: 'embed', label: 'Embed', description: 'Embed external content', icon: '📦', category: 'media' },
  { id: 'pdf', label: 'PDF', description: 'Embed PDF document', icon: '📄', category: 'media' },
  { id: 'file', label: 'File', description: 'Upload file attachment', icon: '📎', category: 'media' },

  // Database blocks
  { id: 'table', label: 'Table', description: 'Inline table', icon: '📊', category: 'database' },

  // Advanced blocks
  { id: 'equation', label: 'Equation', description: 'LaTeX math block', icon: '📐', category: 'advanced' },
  { id: 'mermaid', label: 'Mermaid', description: 'Mermaid diagram', icon: '🔀', category: 'advanced' },
  { id: 'column', label: 'Columns', description: 'Multi-column layout', icon: '▦', category: 'advanced' },
  { id: 'table_of_contents', label: 'Table of Contents', description: 'Auto-generated TOC', icon: '📑', category: 'advanced' },
  { id: 'breadcrumb', label: 'Breadcrumb', description: 'Page breadcrumb', icon: '🗂️', category: 'advanced' },
  { id: 'synced', label: 'Synced Block', description: 'Synced across pages', icon: '🔄', category: 'advanced' },

  // Study blocks
  { id: 'flashcard', label: 'Flashcard', description: 'Study flashcard (front / back)', icon: '🎴', category: 'basic' },

  // AI blocks
  { id: 'ai-generated', label: 'AI Generate', description: 'AI-generated content', icon: '✨', category: 'ai' },
];

// Detect prefix shortcuts typed at the start of a line
export const detectBlockPrefix = (text: string): { type: BlockType; remaining: string } | null => {
  if (text.startsWith('### ')) return { type: 'heading3', remaining: text.slice(4) };
  if (text.startsWith('## ')) return { type: 'heading2', remaining: text.slice(3) };
  if (text.startsWith('# ')) return { type: 'heading1', remaining: text.slice(2) };
  if (text.startsWith('- ') || text.startsWith('* ')) return { type: 'bullet', remaining: text.slice(2) };
  if (/^\d+\.\s/.test(text)) return { type: 'numbered', remaining: text.replace(/^\d+\.\s/, '') };
  if (text.startsWith('[] ') || text.startsWith('[ ] ')) {
    const remaining = text.startsWith('[] ') ? text.slice(3) : text.slice(4);
    return { type: 'todo', remaining };
  }
  if (text.startsWith('[x] ') || text.startsWith('[X] ')) return { type: 'todo', remaining: text.slice(4) };
  if (text.startsWith('> ')) return { type: 'quote', remaining: text.slice(2) };
  if (text === '---' || text === '***') return { type: 'divider', remaining: '' };
  if (text.startsWith('>! ')) return { type: 'toggle', remaining: text.slice(3) };
  if (text.startsWith('$$')) return { type: 'equation', remaining: text.slice(2) };
  return null;
};
