// ============================================================
// NikNote 4.0 — AI Workflow Engine (Dify-Inspired)
// Visual node-based workflow builder for AI automation
// Supports: LLM, RAG, Code, HTTP, OCR, Conditional, Loops
// Architecture inspired by Dify's Beehive runtime
// ============================================================

export type WorkflowNodeType =
  | 'start'           // Input node
  | 'end'             // Output node
  | 'llm'             // LLM call (any model)
  | 'knowledge'       // RAG retrieval
  | 'code'            // JavaScript execution
  | 'http'            // API call
  | 'ocr'             // OCR processing
  | 'condition'       // If/else branch
  | 'loop'            // Iterate over items
  | 'parallel'        // Run branches in parallel
  | 'transform'       // Data transformation
  | 'memory'          // Store/retrieve from memory
  | 'notification'    // Send notification
  | 'tool'            // External tool call
  | 'human_approval'  // Wait for human input
  | 'scheduler'       // Time-based trigger
  | 'pdf'             // PDF processing
  | 'flashcard'       // Generate flashcards
  | 'quiz'            // Generate quiz
  | 'summarize'       // Summarize content
  | 'translate'       // Translate text
  | 'agent'           // Sub-agent delegation
  | 'variable'        // Set variable
  | 'comment';        // Comment/annotation

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  connections: {
    inputs: string[];   // Source node IDs
    outputs: string[];  // Target node IDs
  };
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  config: Record<string, any>;
  // Type-specific configs:
  // llm: { model, temperature, maxTokens, systemPrompt, userPrompt }
  // knowledge: { dataSource, topK, searchType, reranking }
  // code: { language, code }
  // http: { url, method, headers, body }
  // ocr: { mode, language, extractTables }
  // condition: { expression, trueBranch, falseBranch }
  // loop: { variable, maxIterations }
  // etc.
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  variables: WorkflowVariable[];
  createdAt: number;
  updatedAt: number;
  version: number;
  status: 'draft' | 'active' | 'archived';
  executionCount: number;
  lastExecution?: WorkflowExecution;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue?: any;
  required: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: number;
  completedAt?: number;
  nodeExecutions: NodeExecution[];
  totalTokens: number;
  totalCost: number;
  output?: any;
  error?: string;
}

export interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  input?: any;
  output?: any;
  tokens?: number;
  cost?: number;
  error?: string;
  duration?: number;
}

// ============================================================
// Workflow Templates — Pre-built for Indian Students
// ============================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'study' | 'research' | 'writing' | 'ocr' | 'automation';
  icon: string;
  nodes: Omit<WorkflowNode, 'id' | 'position'>[];
  variables: WorkflowVariable[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'pdf-to-flashcards',
    name: 'PDF → Flashcards',
    description: 'Upload any PDF and automatically generate flashcards with AI',
    category: 'study',
    icon: '🃏',
    variables: [
      { id: 'v1', name: 'difficulty', type: 'string', defaultValue: 'medium', required: false },
      { id: 'v2', name: 'numCards', type: 'number', defaultValue: 20, required: false },
    ],
    nodes: [
      { type: 'start', data: { label: 'Upload PDF', config: { inputType: 'file', accept: '.pdf' } }, connections: { inputs: [], outputs: ['n2'] } },
      { type: 'ocr', data: { label: 'Extract Text', config: { mode: 'base', language: 'hi+en', extractTables: true } }, connections: { inputs: ['n1'], outputs: ['n3'] } },
      { type: 'llm', data: { label: 'Generate Flashcards', config: { model: 'gpt-4o', temperature: 0.7, systemPrompt: 'Generate flashcards from the following text. Each card has a question and answer. Support Hindi and English.', userPrompt: '{{ocr_output}}' } }, connections: { inputs: ['n2'], outputs: ['n4'] } },
      { type: 'flashcard', data: { label: 'Save Flashcards', config: { deck: 'auto-generated', spacedRepetition: true } }, connections: { inputs: ['n3'], outputs: ['n5'] } },
      { type: 'end', data: { label: 'Done!', config: {} }, connections: { inputs: ['n4'], outputs: [] } },
    ],
  },
  {
    id: 'exam-paper-analyzer',
    name: 'Exam Paper Analyzer',
    description: 'Scan exam papers → Extract questions → Generate answers with AI',
    category: 'study',
    icon: '📝',
    variables: [
      { id: 'v1', name: 'subject', type: 'string', defaultValue: '', required: true },
      { id: 'v2', name: 'board', type: 'string', defaultValue: 'CBSE', required: false },
    ],
    nodes: [
      { type: 'start', data: { label: 'Upload Exam Paper', config: { inputType: 'file', accept: 'image/*,.pdf' } }, connections: { inputs: [], outputs: ['n2'] } },
      { type: 'ocr', data: { label: 'Extract Questions', config: { mode: 'gundam', language: 'hi+en', extractEquations: true } }, connections: { inputs: ['n1'], outputs: ['n3'] } },
      { type: 'llm', data: { label: 'Solve Questions', config: { model: 'gpt-4o', temperature: 0.3, systemPrompt: 'You are an expert Indian exam solver. Solve each question step by step in Hindi/English. Show working for math problems.', userPrompt: 'Subject: {{subject}}\nBoard: {{board}}\n\nQuestions:\n{{ocr_output}}' } }, connections: { inputs: ['n2'], outputs: ['n4'] } },
      { type: 'end', data: { label: 'Answers Ready!', config: {} }, connections: { inputs: ['n3'], outputs: [] } },
    ],
  },
  {
    id: 'research-paper-summarizer',
    name: 'Research Paper Summarizer',
    description: 'Upload research papers → AI summarizes → Extract key findings',
    category: 'research',
    icon: '🔬',
    variables: [
      { id: 'v1', name: 'detailLevel', type: 'string', defaultValue: 'detailed', required: false },
    ],
    nodes: [
      { type: 'start', data: { label: 'Upload Paper', config: { inputType: 'file', accept: '.pdf' } }, connections: { inputs: [], outputs: ['n2'] } },
      { type: 'ocr', data: { label: 'Extract Content', config: { mode: 'base', language: 'en' } }, connections: { inputs: ['n1'], outputs: ['n3'] } },
      { type: 'summarize', data: { label: 'Summarize', config: { maxLength: 500, extractKeyPoints: true } }, connections: { inputs: ['n2'], outputs: ['n4'] } },
      { type: 'llm', data: { label: 'Extract Findings', config: { model: 'gpt-4o', systemPrompt: 'Extract: 1) Key findings 2) Methodology 3) Limitations 4) Citations', userPrompt: '{{summary}}' } }, connections: { inputs: ['n3'], outputs: ['n5'] } },
      { type: 'end', data: { label: 'Summary Ready!', config: {} }, connections: { inputs: ['n4'], outputs: [] } },
    ],
  },
  {
    id: 'handwriting-to-text',
    name: 'Handwriting → Editable Notes',
    description: 'Convert handwritten notes to editable, formatted text',
    category: 'ocr',
    icon: '✍️',
    variables: [],
    nodes: [
      { type: 'start', data: { label: 'Upload Handwriting', config: { inputType: 'file', accept: 'image/*' } }, connections: { inputs: [], outputs: ['n2'] } },
      { type: 'ocr', data: { label: 'OCR + Handwriting Detection', config: { mode: 'gundam', enableHandwritingDetection: true, preserveLayout: true } }, connections: { inputs: ['n1'], outputs: ['n3'] } },
      { type: 'llm', data: { label: 'Format & Clean', config: { model: 'gpt-4o', systemPrompt: 'Clean up OCR text, fix errors, format into proper notes with headings and bullet points. Preserve Hindi text.', userPrompt: '{{ocr_output}}' } }, connections: { inputs: ['n2'], outputs: ['n4'] } },
      { type: 'end', data: { label: 'Notes Ready!', config: {} }, connections: { inputs: ['n3'], outputs: [] } },
    ],
  },
  {
    id: 'ai-study-planner',
    name: 'AI Study Planner',
    description: 'Generate personalized study plans based on syllabus and exam dates',
    category: 'study',
    icon: '📅',
    variables: [
      { id: 'v1', name: 'subjects', type: 'string', defaultValue: '', required: true },
      { id: 'v2', name: 'examDate', type: 'string', defaultValue: '', required: true },
      { id: 'v3', name: 'hoursPerDay', type: 'number', defaultValue: 6, required: false },
    ],
    nodes: [
      { type: 'start', data: { label: 'Enter Details', config: { inputs: ['subjects', 'examDate', 'hoursPerDay'] } }, connections: { inputs: [], outputs: ['n2'] } },
      { type: 'llm', data: { label: 'Generate Plan', config: { model: 'gpt-4o', systemPrompt: 'Create a detailed day-by-day study plan for an Indian student. Include: 1) Daily schedule 2) Topic breakdown 3) Revision slots 4) Practice tests 5) Break times. Support CBSE/ICSE/JEE/NEET patterns.', userPrompt: 'Subjects: {{subjects}}\nExam Date: {{examDate}}\nHours/Day: {{hoursPerDay}}' } }, connections: { inputs: ['n1'], outputs: ['n3'] } },
      { type: 'end', data: { label: 'Plan Ready!', config: {} }, connections: { inputs: ['n2'], outputs: [] } },
    ],
  },
  {
    id: 'batch-ocr-processor',
    name: 'Batch OCR Processor',
    description: 'Process multiple images/PDFs at once with OCR',
    category: 'ocr',
    icon: '📚',
    variables: [
      { id: 'v1', name: 'outputFormat', type: 'string', defaultValue: 'markdown', required: false },
    ],
    nodes: [
      { type: 'start', data: { label: 'Upload Files', config: { inputType: 'file', accept: 'image/*,.pdf', multiple: true } }, connections: { inputs: [], outputs: ['n2'] } },
      { type: 'loop', data: { label: 'Process Each File', config: { variable: 'files', maxIterations: 50 } }, connections: { inputs: ['n1'], outputs: ['n3'] } },
      { type: 'ocr', data: { label: 'OCR Current File', config: { mode: 'auto', language: 'hi+en' } }, connections: { inputs: ['n2'], outputs: ['n4'] } },
      { type: 'end', data: { label: 'All Files Processed!', config: {} }, connections: { inputs: ['n3'], outputs: [] } },
    ],
  },
];

// ============================================================
// Workflow Execution Engine (Beehive-inspired)
// ============================================================

export class WorkflowEngine {
  private executionLog: NodeExecution[] = [];
  private variables: Record<string, any> = {};
  private nodeOutputs: Record<string, any> = {};
  private abortController: AbortController | null = null;

  /**
   * Execute a workflow with given inputs
   */
  async execute(
    workflow: Workflow,
    inputs: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    this.abortController = new AbortController();
    this.executionLog = [];
    this.variables = { ...inputs };
    this.nodeOutputs = {};

    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId: workflow.id,
      status: 'running',
      startedAt: Date.now(),
      nodeExecutions: [],
      totalTokens: 0,
      totalCost: 0,
    };

    try {
      // Find start node
      const startNode = workflow.nodes.find(n => n.type === 'start');
      if (!startNode) throw new Error('No start node found');

      // Execute from start node
      await this.executeNode(startNode.id, workflow, execution);

      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.output = this.nodeOutputs;
    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();
    }

    return execution;
  }

  /**
   * Stop a running workflow
   */
  abort() {
    this.abortController?.abort();
  }

  private async executeNode(
    nodeId: string,
    workflow: Workflow,
    execution: WorkflowExecution
  ): Promise<any> {
    if (this.abortController?.signal.aborted) throw new Error('Aborted');

    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeExec: NodeExecution = {
      nodeId: node.id,
      status: 'running',
      startedAt: Date.now(),
    };

    try {
      // Gather inputs from connected nodes
      const inputs: Record<string, any> = {};
      for (const inputId of node.connections.inputs) {
        inputs[inputId] = this.nodeOutputs[inputId];
      }

      nodeExec.input = inputs;

      // Execute based on node type
      let output: any;
      switch (node.type) {
        case 'start':
          output = this.variables;
          break;
        case 'end':
          output = inputs;
          break;
        case 'llm':
          output = await this.executeLLMNode(node, inputs);
          break;
        case 'ocr':
          output = await this.executeOCRNode(node, inputs);
          break;
        case 'summarize':
          output = await this.executeSummarizeNode(node, inputs);
          break;
        case 'translate':
          output = await this.executeTranslateNode(node, inputs);
          break;
        case 'condition':
          output = await this.executeConditionNode(node, inputs);
          break;
        case 'code':
          output = await this.executeCodeNode(node, inputs);
          break;
        case 'loop':
          output = await this.executeLoopNode(node, inputs, workflow, execution);
          break;
        case 'variable':
          output = this.executeVariableNode(node);
          break;
        case 'comment':
          output = null; // Comments don't produce output
          break;
        default:
          output = inputs;
      }

      this.nodeOutputs[nodeId] = output;
      nodeExec.output = output;
      nodeExec.status = 'completed';
    } catch (error: any) {
      nodeExec.status = 'failed';
      nodeExec.error = error.message;
    }

    nodeExec.completedAt = Date.now();
    nodeExec.duration = nodeExec.completedAt - (nodeExec.startedAt || Date.now());
    execution.nodeExecutions.push(nodeExec);

    // Continue to connected output nodes
    if (nodeExec.status === 'completed' && node.type !== 'end') {
      for (const outputId of node.connections.outputs) {
        await this.executeNode(outputId, workflow, execution);
      }
    }

    return this.nodeOutputs[nodeId];
  }

  // ============================================================
  // Node execution implementations
  // ============================================================

  private async executeLLMNode(node: WorkflowNode, inputs: any): Promise<any> {
    const config = node.data.config;
    const prompt = this.interpolateTemplate(config.userPrompt || '', inputs);
    const systemPrompt = this.interpolateTemplate(config.systemPrompt || '', inputs);

    // Call Supabase edge function or OpenAI API
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-brain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        model: config.model || 'gpt-4o',
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) throw new Error(`LLM node error: ${response.status}`);
    const data = await response.json();
    return data.content || data.choices?.[0]?.message?.content || '';
  }

  private async executeOCRNode(node: WorkflowNode, inputs: any): Promise<any> {
    // Delegate to OCRPipeline
    const { OCRPipeline } = await import('../ocr/OCREngine');
    const pipeline = new OCRPipeline();
    
    const fileInput = inputs.start?.file || inputs.file;
    if (!fileInput) throw new Error('No file provided for OCR');

    const config = node.data.config;
    if (fileInput.type === 'application/pdf') {
      return pipeline.processPDF(fileInput, {
        mode: config.mode || 'base',
        language: config.language || 'hi+en',
        extractTables: config.extractTables ?? true,
        extractEquations: config.extractEquations ?? true,
      });
    } else {
      return pipeline.processImage(fileInput, {
        mode: config.mode || 'gundam',
        language: config.language || 'hi+en',
        enableHandwritingDetection: config.enableHandwritingDetection ?? true,
      });
    }
  }

  private async executeSummarizeNode(node: WorkflowNode, inputs: any): Promise<string> {
    const text = typeof inputs === 'string' ? inputs : JSON.stringify(inputs);
    return this.executeLLMNode(node, { ...inputs, _text: text });
  }

  private async executeTranslateNode(node: WorkflowNode, inputs: any): Promise<string> {
    return this.executeLLMNode(node, inputs);
  }

  private async executeConditionNode(node: WorkflowNode, inputs: any): Promise<any> {
    const config = node.data.config;
    try {
      const result = new Function('inputs', `return ${config.expression}`)(inputs);
      return { condition: result, branch: result ? 'true' : 'false' };
    } catch {
      return { condition: false, branch: 'false' };
    }
  }

  private async executeCodeNode(node: WorkflowNode, inputs: any): Promise<any> {
    const config = node.data.config;
    try {
      const fn = new Function('inputs', 'console', config.code);
      return fn(inputs, console);
    } catch (error: any) {
      throw new Error(`Code execution error: ${error.message}`);
    }
  }

  private async executeLoopNode(
    node: WorkflowNode,
    inputs: any,
    workflow: Workflow,
    execution: WorkflowExecution
  ): Promise<any[]> {
    const config = node.data.config;
    const items = this.variables[config.variable] || [];
    const maxIter = config.maxIterations || 100;
    const results: any[] = [];

    for (let i = 0; i < Math.min(items.length, maxIter); i++) {
      this.variables._currentItem = items[i];
      this.variables._currentIndex = i;
      // Process loop body (connected nodes)
      for (const outputId of node.connections.outputs) {
        const result = await this.executeNode(outputId, workflow, execution);
        results.push(result);
      }
    }

    return results;
  }

  private executeVariableNode(node: WorkflowNode): any {
    const config = node.data.config;
    for (const [key, value] of Object.entries(config)) {
      this.variables[key] = value;
    }
    return this.variables;
  }

  // ============================================================
  // Template interpolation
  // ============================================================

  private interpolateTemplate(template: string, inputs: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (key === 'ocr_output') {
        // Get the output from the last OCR node
        const ocrOutput = Object.values(this.nodeOutputs).find(o => o?.pages);
        if (ocrOutput?.pages) {
          return ocrOutput.pages.map((p: any) => p.rawMarkdown).join('\n\n---\n\n');
        }
        return String(inputs[key] || '');
      }
      if (key === 'summary') {
        return String(this.nodeOutputs[Object.keys(this.nodeOutputs).pop() || ''] || '');
      }
      return String(this.variables[key] ?? inputs[key] ?? '');
    });
  }
}
