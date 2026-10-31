// ============================================================
// NikNote 4.0 — Multi-Agent System
// Specialized AI agents that collaborate through shared memory
// Inspired by Dify's agent framework
// ============================================================

export type AgentType =
  | 'research'       // Deep research & web search
  | 'study'          // Study planner & revision
  | 'coding'         // Code generation & debugging
  | 'writing'        // Content writing & editing
  | 'ocr'            // Document scanning & extraction
  | 'document'       // Document analysis & management
  | 'knowledge'      // Knowledge base management
  | 'planner'        // Task & project planning
  | 'scheduler'      // Calendar & reminders
  | 'teacher'        // Teaching & explanations
  | 'reviewer'       // Content review & feedback
  | 'fact_checker'   // Fact verification
  | 'debug'          // Error analysis & fixes
  | 'presentation'   // Slide & presentation creation
  | 'math'           // Math problem solving
  | 'science'        // Science concept explanation
  | 'meeting'         // Meeting notes & actions
  | 'voice'          // Voice transcription & commands
  | 'automation'     // Workflow automation
  | 'browser';       // Web browsing & scraping

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
  systemPrompt: string;
  tools: AgentTool[];
  memory: AgentMemory;
  status: 'idle' | 'thinking' | 'working' | 'waiting' | 'error';
  currentTask?: AgentTask;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: 'search' | 'ocr' | 'llm' | 'code' | 'http' | 'memory' | 'file' | 'notification';
  config: Record<string, any>;
}

export interface AgentMemory {
  shortTerm: Record<string, any>;  // Current conversation/task context
  longTerm: Record<string, any>;   // Cross-session knowledge
  shared: Record<string, any>;     // Shared with other agents
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  input: any;
  output?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  parentTaskId?: string;  // For sub-tasks
  delegatedTo?: string;   // If delegated to another agent
}

// ============================================================
// Agent Definitions — Specialized for Indian Students
// ============================================================

export const AGENT_DEFINITIONS: Omit<Agent, 'id' | 'status' | 'currentTask' | 'memory'>[] = [
  {
    type: 'teacher',
    name: 'Guru AI',
    description: 'Your AI teacher — explains concepts in Hindi & English, creates quizzes, and helps you learn',
    icon: '👨‍🏫',
    color: 'from-nk-purple to-nk-rose',
    capabilities: ['explain', 'quiz', 'flashcards', 'doubt_solving', 'exam_prep'],
    systemPrompt: `You are Guru AI, NikNote's AI teacher built specifically for Indian students. You:
- Explain concepts in simple Hindi/English (Hinglish)
- Support CBSE, ICSE, JEE, NEET, UPSC syllabus
- Create quizzes and flashcards on demand
- Solve doubts step by step
- Use examples from daily Indian life
- Always encourage the student
- Switch between Hindi and English based on student's comfort`,
    tools: [
      { id: 't1', name: 'Create Quiz', description: 'Generate MCQ/short answer quiz', type: 'llm', config: { outputFormat: 'quiz' } },
      { id: 't2', name: 'Create Flashcards', description: 'Generate spaced repetition cards', type: 'llm', config: { outputFormat: 'flashcards' } },
      { id: 't3', name: 'Explain Topic', description: 'Explain any topic simply', type: 'llm', config: { outputFormat: 'explanation' } },
    ],
  },
  {
    type: 'research',
    name: 'Research Agent',
    description: 'Deep research on any topic — reads papers, compares sources, finds insights',
    icon: '🔬',
    color: 'from-nk-purple to-nk-rose',
    capabilities: ['web_search', 'paper_analysis', 'citation_extraction', 'comparison', 'summary'],
    systemPrompt: `You are NikNote's Research Agent. You:
- Search the web for latest information
- Analyze research papers and academic content
- Extract citations and references
- Compare multiple sources
- Generate literature reviews
- Support Hindi and English research
- Focus on Indian academic context`,
    tools: [
      { id: 't1', name: 'Web Search', description: 'Search the internet', type: 'search', config: {} },
      { id: 't2', name: 'Analyze Paper', description: 'Extract key findings from papers', type: 'ocr', config: {} },
      { id: 't3', name: 'Citation Extract', description: 'Extract and format citations', type: 'llm', config: {} },
    ],
  },
  {
    type: 'ocr',
    name: 'Doc Scanner AI',
    description: 'Scan any document — handwritten notes, exam papers, textbooks, PDFs',
    icon: '📄',
    color: 'from-success to-success/70',
    capabilities: ['image_ocr', 'pdf_ocr', 'handwriting_detection', 'table_extraction', 'equation_extraction'],
    systemPrompt: `You are NikNote's Document Scanner. You:
- Process handwritten notes with high accuracy
- Extract text from exam papers and textbooks
- Handle Hindi (Devanagari) and English
- Detect and extract tables, equations, charts
- Support scanned books and mobile photos
- Preserve document layout and reading order`,
    tools: [
      { id: 't1', name: 'OCR Image', description: 'Scan an image', type: 'ocr', config: { mode: 'gundam' } },
      { id: 't2', name: 'OCR PDF', description: 'Scan a multi-page PDF', type: 'ocr', config: { mode: 'base' } },
      { id: 't3', name: 'Detect Handwriting', description: 'Detect and process handwriting', type: 'ocr', config: { enableHandwritingDetection: true } },
    ],
  },
  {
    type: 'math',
    name: 'Math Solver',
    description: 'Solves math problems step by step — algebra, calculus, geometry, statistics',
    icon: '📐',
    color: 'from-nk-warm-600 to-nk-rose',
    capabilities: ['solve_equations', 'calculus', 'geometry', 'statistics', 'proof_verification', 'step_by_step'],
    systemPrompt: `You are NikNote's Math Solver, built for Indian students. You:
- Solve problems step by step (not just answers)
- Support JEE/NEET math patterns
- Show working clearly in both Hindi and English
- Verify proofs and derivations
- Create practice problems by difficulty level
- Cover: Algebra, Calculus, Geometry, Trigonometry, Statistics, Number Theory
- Format equations in LaTeX`,
    tools: [
      { id: 't1', name: 'Solve Problem', description: 'Solve with step-by-step working', type: 'llm', config: {} },
      { id: 't2', name: 'Generate Practice', description: 'Create similar practice problems', type: 'llm', config: {} },
    ],
  },
  {
    type: 'writing',
    name: 'Content Writer',
    description: 'Write, edit, and improve any content — essays, reports, notes',
    icon: '✍️',
    color: 'from-nk-rose to-nk-rose',
    capabilities: ['write', 'edit', 'improve', 'translate', 'summarize', 'expand'],
    systemPrompt: `You are NikNote's AI Content Writer. You:
- Write essays, reports, and notes in Hindi/English
- Improve existing text for clarity and impact
- Translate between Hindi and English
- Expand brief notes into detailed content
- Summarize long content into key points
- Match Indian academic writing standards
- Support formal and informal tones`,
    tools: [
      { id: 't1', name: 'Write Content', description: 'Generate content from prompt', type: 'llm', config: {} },
      { id: 't2', name: 'Edit Content', description: 'Improve existing text', type: 'llm', config: {} },
      { id: 't3', name: 'Translate', description: 'Hindi ↔ English', type: 'llm', config: {} },
    ],
  },
  {
    type: 'study',
    name: 'Study Planner',
    description: 'Creates personalized study plans, tracks progress, suggests revision',
    icon: '📅',
    color: 'from-success to-success/70',
    capabilities: ['plan_creation', 'progress_tracking', 'revision_scheduling', 'weak_area_detection', 'daily_schedule'],
    systemPrompt: `You are NikNote's Study Planner. You:
- Create day-by-day study plans for Indian exams
- Track learning progress and adjust plans
- Schedule revision using spaced repetition
- Identify weak areas and suggest focused practice
- Generate daily/weekly schedules
- Support CBSE/ICSE/JEE/NEET/UPSC patterns
- Consider Indian school calendar and exam dates`,
    tools: [
      { id: 't1', name: 'Create Plan', description: 'Generate study plan', type: 'llm', config: {} },
      { id: 't2', name: 'Track Progress', description: 'Update and review progress', type: 'memory', config: {} },
    ],
  },
  {
    type: 'fact_checker',
    name: 'Fact Checker',
    description: 'Verifies facts, claims, and information accuracy',
    icon: '✅',
    color: 'from-error to-nk-rose',
    capabilities: ['fact_verification', 'source_checking', 'claim_analysis'],
    systemPrompt: `You are NikNote's Fact Checker. You:
- Verify factual claims and statements
- Cross-reference multiple sources
- Flag potential misinformation
- Rate confidence of claims
- Support Hindi and English fact-checking`,
    tools: [
      { id: 't1', name: 'Verify Fact', description: 'Check if a claim is true', type: 'search', config: {} },
      { id: 't2', name: 'Find Sources', description: 'Find supporting/contradicting sources', type: 'search', config: {} },
    ],
  },
  {
    type: 'automation',
    name: 'Workflow Bot',
    description: 'Automates repetitive tasks using workflow templates',
    icon: '🤖',
    color: 'from-nk-purple to-nk-rose',
    capabilities: ['workflow_execution', 'task_automation', 'batch_processing'],
    systemPrompt: `You are NikNote's Workflow Automation Bot. You:
- Execute pre-built workflow templates
- Automate repetitive tasks (OCR, summarize, translate)
- Process batches of files
- Chain multiple AI operations
- Report progress and results`,
    tools: [
      { id: 't1', name: 'Run Workflow', description: 'Execute a workflow template', type: 'llm', config: {} },
      { id: 't2', name: 'Batch Process', description: 'Process multiple items', type: 'llm', config: {} },
    ],
  },
];

// ============================================================
// Agent Router — Routes tasks to best-fit agents
// ============================================================

export class AgentRouter {
  private agents: Map<string, Agent> = new Map();

  constructor() {
    // Initialize all agents
    for (const def of AGENT_DEFINITIONS) {
      const agent: Agent = {
        ...def,
        id: `agent-${def.type}`,
        status: 'idle',
        memory: { shortTerm: {}, longTerm: {}, shared: {} },
      };
      this.agents.set(agent.id, agent);
    }
  }

  /**
   * Route a task to the best agent
   */
  route(task: { type: string; input: string }): Agent {
    const input = task.input.toLowerCase();
    
    // Simple keyword-based routing
    const routingRules: [AgentType, RegExp[]][] = [
      ['math', [/math|algebra|calculus|equation|solve|geometry|trigonometry|integral|derivative/i]],
      ['teacher', [/explain|teach|learn|concept|understand|doubt|पढ़ाई|समझाओ|सिखाओ/i]],
      ['ocr', [/scan|ocr|extract|image|pdf|document|photo|स्कैन|तस्वीर/i]],
      ['research', [/research|paper|study|find|search|compare|अनुसंधान|खोज/i]],
      ['writing', [/write|edit|improve|essay|translate|summary|लिखो|सुधार|अनुवाद/i]],
      ['study', [/plan|schedule|revise|prepare|exam|योजना|तैयारी|परीक्षा/i]],
      ['fact_checker', [/verify|fact|check|true|false|सत्यापित|जांच/i]],
      ['automation', [/automate|workflow|batch|process|स्वचालित/i]],
    ];

    for (const [agentType, patterns] of routingRules) {
      if (patterns.some(p => p.test(input))) {
        const agent = this.agents.get(`agent-${agentType}`);
        if (agent) return agent;
      }
    }

    // Default to teacher agent
    return this.agents.get('agent-teacher')!;
  }

  /**
   * Get an agent by type
   */
  getAgent(type: AgentType): Agent | undefined {
    return this.agents.get(`agent-${type}`);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Share memory between agents
   */
  shareMemory(fromAgentId: string, toAgentId: string, key: string, value: any) {
    const from = this.agents.get(fromAgentId);
    const to = this.agents.get(toAgentId);
    if (from && to) {
      from.memory.shared[key] = value;
      to.memory.shared[key] = value;
    }
  }
}
