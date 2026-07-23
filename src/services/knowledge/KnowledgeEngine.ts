// ============================================================
// NikNote 4.0 — Knowledge Engine (RAG + Knowledge Graph)
// Every imported document becomes searchable knowledge
// Auto-generates: tags, summaries, keywords, flashcards, etc.
// Inspired by Dify's knowledge base + vector search
// ============================================================

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'pdf' | 'image' | 'web' | 'ai_generated';
  source: string;
  createdAt: number;
  updatedAt: number;
  metadata: KnowledgeMetadata;
  embeddings?: number[];
}

export interface KnowledgeMetadata {
  tags: string[];
  keywords: string[];
  summary: string;
  entities: Entity[];
  topics: string[];
  category: string;
  subCategories: string[];
  readingTime: number; // minutes
  wordCount: number;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  relatedDocuments: string[]; // IDs
  flashcards: Flashcard[];
  quizQuestions: QuizQuestion[];
  actionItems: ActionItem[];
  keyTakeaways: string[];
  citations: Citation[];
  backlinks: Backlink[];
}

export interface Entity {
  name: string;
  type: 'person' | 'concept' | 'formula' | 'date' | 'place' | 'organization' | 'term';
  description?: string;
  frequency: number;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  nextReview: number; // timestamp
  reviewCount: number;
  correctCount: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

export interface ActionItem {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  completed: boolean;
}

export interface Citation {
  text: string;
  source: string;
  page?: number;
}

export interface Backlink {
  documentId: string;
  documentTitle: string;
  context: string;
}

// ============================================================
// Knowledge Graph — Entity-Relationship Map
// ============================================================

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: Entity['type'];
  connections: { targetId: string; relationship: string; strength: number }[];
  metadata: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: { source: string; target: string; relationship: string; strength: number }[];
}

// ============================================================
// Knowledge Engine — Main Service
// ============================================================

export class KnowledgeEngine {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private graph: KnowledgeGraph = { nodes: [], edges: [] };

  /**
   * Ingest a document into the knowledge base
   * Automatically generates all metadata
   */
  async ingestDocument(doc: Omit<KnowledgeDocument, 'metadata' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeDocument> {
    const metadata = await this.generateMetadata(doc.content, doc.type);
    
    const knowledgeDoc: KnowledgeDocument = {
      ...doc,
      id: doc.id || `doc-${Date.now()}`,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.documents.set(knowledgeDoc.id, knowledgeDoc);

    // Update knowledge graph
    this.updateKnowledgeGraph(knowledgeDoc);

    return knowledgeDoc;
  }

  /**
   * Search the knowledge base
   * Supports: semantic, keyword, hybrid search
   */
  async search(query: string, options: {
    type?: 'semantic' | 'keyword' | 'hybrid';
    topK?: number;
    filters?: { tags?: string[]; category?: string; difficulty?: string };
  } = {}): Promise<{ document: KnowledgeDocument; relevance: number; snippet: string }[]> {
    const { topK = 10, filters, type = 'hybrid' } = options;
    const q = query.toLowerCase();
    const results: { document: KnowledgeDocument; relevance: number; snippet: string }[] = [];

    for (const doc of this.documents.values()) {
      // Apply filters
      if (filters?.tags && !filters.tags.some(t => doc.metadata.tags.includes(t))) continue;
      if (filters?.category && doc.metadata.category !== filters.category) continue;
      if (filters?.difficulty && doc.metadata.difficulty !== filters.difficulty) continue;

      let relevance = 0;
      let snippet = '';

      // Keyword matching
      if (type === 'keyword' || type === 'hybrid') {
        const contentLower = doc.content.toLowerCase();
        const titleLower = doc.title.toLowerCase();
        
        // Title match (high weight)
        if (titleLower.includes(q)) relevance += 50;
        
        // Content match
        const contentMatches = (contentLower.match(new RegExp(q.replace(/\s+/g, '\\s+'), 'gi')) || []).length;
        relevance += contentMatches * 10;
        
        // Tag match
        relevance += doc.metadata.tags.filter(t => t.toLowerCase().includes(q)).length * 15;
        
        // Keyword match
        relevance += doc.metadata.keywords.filter(k => k.toLowerCase().includes(q)).length * 20;
        
        // Entity match
        relevance += doc.metadata.entities.filter(e => e.name.toLowerCase().includes(q)).length * 25;
        
        // Get snippet
        const snippetIdx = contentLower.indexOf(q);
        if (snippetIdx >= 0) {
          snippet = doc.content.slice(Math.max(0, snippetIdx - 50), snippetIdx + 200);
        } else {
          snippet = doc.metadata.summary.slice(0, 200);
        }
      }

      if (relevance > 0) {
        results.push({ document: doc, relevance, snippet });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, topK);
  }

  /**
   * Generate flashcards from a document
   */
  getFlashcards(docId: string): Flashcard[] {
    return this.documents.get(docId)?.metadata.flashcards || [];
  }

  /**
   * Get all due flashcards for spaced repetition
   */
  getDueFlashcards(): Flashcard[] {
    const now = Date.now();
    const allCards: Flashcard[] = [];
    for (const doc of this.documents.values()) {
      allCards.push(...doc.metadata.flashcards.filter(f => f.nextReview <= now));
    }
    return allCards;
  }

  /**
   * Get knowledge graph
   */
  getKnowledgeGraph(): KnowledgeGraph {
    return this.graph;
  }

  /**
   * Get related documents
   */
  getRelated(docId: string, limit = 5): KnowledgeDocument[] {
    const doc = this.documents.get(docId);
    if (!doc) return [];
    
    const relatedIds = doc.metadata.relatedDocuments;
    return relatedIds
      .map(id => this.documents.get(id))
      .filter(Boolean)
      .slice(0, limit) as KnowledgeDocument[];
  }

  // ============================================================
  // Private methods
  // ============================================================

  private async generateMetadata(content: string, type: string): Promise<KnowledgeMetadata> {
    // Auto-generate metadata from content
    const words = content.split(/\s+/);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / 200); // 200 wpm average

    // Extract keywords (simple TF-based approach)
    const wordFreq: Record<string, number> = {};
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'का', 'की', 'के', 'में', 'से', 'पर', 'और', 'या', 'नहीं', 'है', 'हैं', 'था', 'थे', 'हो', 'कर', 'इस', 'उस', 'एक', 'यह', 'वह', 'कि', 'भी', 'तो', 'लिए', 'द्वारा', 'ही']);
    
    for (const word of words) {
      const w = word.toLowerCase().replace(/[^a-z0-9अ-ह]+/g, '');
      if (w.length > 2 && !stopWords.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }

    const keywords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);

    // Generate tags from keywords
    const tags = keywords.slice(0, 10);

    // Detect language
    const hindiChars = (content.match(/[\u0900-\u097F]/g) || []).length;
    const language = hindiChars > content.length * 0.1 ? 'hi' : 'en';

    // Detect difficulty
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (wordCount || 1);
    const difficulty: KnowledgeMetadata['difficulty'] = avgWordLength > 7 ? 'advanced' : avgWordLength > 5 ? 'intermediate' : 'beginner';

    // Detect category
    const category = this.detectCategory(content);

    // Generate summary (first 200 chars)
    const summary = content.slice(0, 500).trim() + (content.length > 500 ? '...' : '');

    return {
      tags,
      keywords,
      summary,
      entities: this.extractEntities(content),
      topics: keywords.slice(0, 5),
      category,
      subCategories: [],
      readingTime,
      wordCount,
      language,
      difficulty,
      relatedDocuments: [],
      flashcards: [],
      quizQuestions: [],
      actionItems: this.extractActionItems(content),
      keyTakeaways: [],
      citations: [],
      backlinks: [],
    };
  }

  private detectCategory(content: string): string {
    const c = content.toLowerCase();
    if (/chapter|section|definition|theorem|formula|equation/i.test(c)) return 'textbook';
    if (/question|answer|marks|exam|paper/i.test(c)) return 'exam';
    if (/abstract|methodology|references|doi/i.test(c)) return 'research';
    if (/note|summary|key points/i.test(c)) return 'notes';
    if (/code|function|class|import|def /i.test(c)) return 'code';
    return 'general';
  }

  private extractEntities(content: string): Entity[] {
    // Simple entity extraction
    const entities: Entity[] = [];
    const patterns: [RegExp, Entity['type']][] = [
      [/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g, 'date'],
      [/₹\s*[\d,]+(?:\.\d{2})?/g, 'term'],
    ];

    // Extract capitalized terms
    const capsMatch = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const freq: Record<string, number> = {};
    for (const term of capsMatch) {
      freq[term] = (freq[term] || 0) + 1;
    }

    for (const [name, count] of Object.entries(freq)) {
      if (count >= 2) {
        entities.push({ name, type: 'term', frequency: count });
      }
    }

    return entities.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
  }

  private extractActionItems(content: string): ActionItem[] {
    const items: ActionItem[] = [];
    const patterns = [
      /(?:TODO|TASK|ACTION|FIXME|REMINDER)[:\s]+(.+)/gi,
      /(?:करना है|करो|भेजो|जमा करो|submit|complete|finish|review)[:\s]+(.+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        items.push({
          id: `action-${items.length}`,
          text: match[1].trim(),
          priority: 'medium',
          completed: false,
        });
      }
    }

    return items;
  }

  private updateKnowledgeGraph(doc: KnowledgeDocument) {
    // Add document as a node
    const docNode: KnowledgeGraphNode = {
      id: doc.id,
      label: doc.title,
      type: 'concept',
      connections: [],
      metadata: { tags: doc.metadata.tags, category: doc.metadata.category },
    };

    // Add entities as nodes and create edges
    for (const entity of doc.metadata.entities) {
      const existingNode = this.graph.nodes.find(n => n.label === entity.name);
      if (existingNode) {
        existingNode.connections.push({ targetId: doc.id, relationship: 'mentioned_in', strength: entity.frequency });
        docNode.connections.push({ targetId: existingNode.id, relationship: 'contains', strength: entity.frequency });
      } else {
        const entityNode: KnowledgeGraphNode = {
          id: `entity-${entity.name.toLowerCase().replace(/\s+/g, '-')}`,
          label: entity.name,
          type: entity.type,
          connections: [{ targetId: doc.id, relationship: 'mentioned_in', strength: entity.frequency }],
          metadata: { type: entity.type },
        };
        this.graph.nodes.push(entityNode);
        docNode.connections.push({ targetId: entityNode.id, relationship: 'contains', strength: entity.frequency });
      }
    }

    this.graph.nodes.push(docNode);

    // Add edges from connections
    for (const conn of docNode.connections) {
      this.graph.edges.push({
        source: doc.id,
        target: conn.targetId,
        relationship: conn.relationship,
        strength: conn.strength,
      });
    }
  }
  // ============================================================
  // Supabase Persistence — Save/load knowledge to cloud
  // ============================================================

  /**
   * Save current documents to Supabase
   */
  async saveToSupabase(userId: string): Promise<void> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const docs = Array.from(this.documents.values());
      
      for (const doc of docs) {
        const { error } = await supabase
          .from('notebook_pages')
          .upsert({
            id: doc.id,
            notebook_id: `knowledge-${userId}`,
            page_number: 0,
            content: JSON.stringify(doc),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        
        if (error) console.warn('Knowledge save error:', error.message);
      }
    } catch (err) {
      console.warn('Knowledge Supabase save failed:', err);
    }
  }

  /**
   * Load documents from Supabase
   */
  async loadFromSupabase(userId: string): Promise<void> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('notebook_pages')
        .select('content')
        .eq('notebook_id', `knowledge-${userId}`);
      
      if (error || !data) return;
      
      for (const row of data) {
        try {
          const doc = JSON.parse(row.content) as KnowledgeDocument;
          if (doc.id && doc.content) {
            this.documents.set(doc.id, doc);
          }
        } catch { /* skip invalid */ }
      }
      
      // Rebuild graph from loaded documents
      for (const doc of this.documents.values()) {
        this.updateKnowledgeGraph(doc);
      }
    } catch (err) {
      console.warn('Knowledge Supabase load failed:', err);
    }
  }

  /**
   * Export knowledge base as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify({
      documents: Array.from(this.documents.values()),
      graph: this.graph,
      exportedAt: new Date().toISOString(),
      version: '4.0',
    }, null, 2);
  }

  /**
   * Import knowledge base from JSON
   */
  importFromJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.documents) {
        for (const doc of data.documents) {
          this.documents.set(doc.id, doc);
        }
      }
      if (data.graph) {
        this.graph = data.graph;
      }
      return true;
    } catch {
      return false;
    }
  }


}
