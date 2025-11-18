/**
 * Agent Routing System for Claude Code
 *
 * Provides intelligent routing of tasks to specialized agents based on:
 * - Task analysis (keywords, intent, complexity)
 * - Agent capabilities (skills, strengths)
 * - Context (conversation history, current state)
 * - Load balancing (optional, for multi-agent scenarios)
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Supported agent types in Claude Code
 */
export type AgentName = 'explore' | 'plan' | 'execute' | 'review';

/**
 * Agent capabilities definition
 */
export interface AgentCapabilities {
  name: AgentName;
  skills: string[];
  priority: number;
  description: string;
  keywordTriggers: string[];
  complexityRange: { min: number; max: number };
}

/**
 * Agent executor function type
 */
export type AgentExecutor = (prompt: string, context?: TaskContext) => Promise<any>;

/**
 * Registered agent definition
 */
export interface RegisteredAgent {
  capabilities: AgentCapabilities;
  executor: AgentExecutor;
}

/**
 * Task context for routing decisions
 */
export interface TaskContext {
  conversationHistory?: string[];
  currentState?: Record<string, any>;
  userPreferences?: Record<string, any>;
  previousAgent?: AgentName;
  chainDepth?: number;
}

/**
 * Routing result
 */
export interface RoutingResult {
  agent: AgentName;
  confidence: number;
  forwardedPrompt: string;
  reasoning: string;
}

/**
 * Routing options
 */
export interface RoutingOptions {
  forceAgent?: AgentName;
  minConfidence?: number;
  enablePromptForwarding?: boolean;
  maxChainDepth?: number;
}

// ============================================================================
// Agent Registry
// ============================================================================

class AgentRegistry {
  private agents: Map<AgentName, RegisteredAgent> = new Map();

  /**
   * Register an agent with its capabilities and executor
   */
  registerAgent(
    name: AgentName,
    capabilities: AgentCapabilities,
    executor: AgentExecutor
  ): void {
    this.agents.set(name, { capabilities, executor });
  }

  /**
   * Get a registered agent by name
   */
  getAgent(name: AgentName): RegisteredAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * List all registered agents
   */
  listAgents(): AgentCapabilities[] {
    return Array.from(this.agents.values()).map(a => a.capabilities);
  }

  /**
   * Check if an agent is registered
   */
  hasAgent(name: AgentName): boolean {
    return this.agents.has(name);
  }

  /**
   * Get agent executor
   */
  getExecutor(name: AgentName): AgentExecutor | undefined {
    return this.agents.get(name)?.executor;
  }
}

// ============================================================================
// Default Agent Capabilities
// ============================================================================

const EXPLORE_AGENT: AgentCapabilities = {
  name: 'explore',
  skills: [
    'code search',
    'file navigation',
    'symbol lookup',
    'codebase understanding',
    'pattern matching',
    'dependency analysis',
    'structure exploration'
  ],
  priority: 2,
  description: 'Fast agent specialized for exploring codebases and finding code',
  keywordTriggers: [
    'find', 'search', 'where', 'locate', 'show', 'list',
    'explore', 'discover', 'identify', 'what files', 'which',
    'how does', 'explain', 'understand', 'analyze structure'
  ],
  complexityRange: { min: 1, max: 5 }
};

const PLAN_AGENT: AgentCapabilities = {
  name: 'plan',
  skills: [
    'task breakdown',
    'workflow planning',
    'dependency analysis',
    'multi-step coordination',
    'complexity assessment',
    'resource allocation'
  ],
  priority: 3,
  description: 'Fast agent specialized for planning complex multi-step tasks',
  keywordTriggers: [
    'implement', 'create', 'build', 'develop', 'design',
    'refactor', 'restructure', 'migrate', 'upgrade',
    'plan', 'organize', 'coordinate', 'complex'
  ],
  complexityRange: { min: 5, max: 10 }
};

const EXECUTE_AGENT: AgentCapabilities = {
  name: 'execute',
  skills: [
    'code editing',
    'file operations',
    'command execution',
    'direct modifications',
    'testing',
    'debugging',
    'quick fixes'
  ],
  priority: 1,
  description: 'General-purpose agent for direct code execution and modifications',
  keywordTriggers: [
    'fix', 'update', 'change', 'modify', 'edit', 'delete',
    'add', 'remove', 'replace', 'correct', 'run', 'execute',
    'test', 'debug', 'patch'
  ],
  complexityRange: { min: 1, max: 8 }
};

const REVIEW_AGENT: AgentCapabilities = {
  name: 'review',
  skills: [
    'code review',
    'quality checks',
    'security analysis',
    'best practices',
    'performance analysis',
    'bug detection'
  ],
  priority: 2,
  description: 'Agent specialized for code review and quality assurance',
  keywordTriggers: [
    'review', 'check', 'analyze', 'audit', 'inspect',
    'validate', 'verify', 'assess', 'evaluate',
    'security', 'quality', 'performance', 'bugs'
  ],
  complexityRange: { min: 2, max: 7 }
};

// ============================================================================
// Task Analysis
// ============================================================================

/**
 * Analyze task complexity based on various factors
 */
function analyzeTaskComplexity(taskDescription: string): number {
  let complexity = 1;

  // Check for multiple steps or actions
  const multiStepIndicators = [
    'and then', 'after that', 'first', 'second', 'then',
    'also', 'additionally', 'furthermore', 'next'
  ];
  multiStepIndicators.forEach(indicator => {
    if (taskDescription.toLowerCase().includes(indicator)) {
      complexity += 2;
    }
  });

  // Check for multiple files or components
  if (taskDescription.match(/\band\b/gi)?.length ?? 0 > 2) {
    complexity += 1;
  }

  // Check for system-wide changes
  const systemWideIndicators = ['all', 'every', 'entire', 'whole', 'across'];
  systemWideIndicators.forEach(indicator => {
    if (taskDescription.toLowerCase().includes(indicator)) {
      complexity += 2;
    }
  });

  // Check for architectural terms
  const architecturalTerms = [
    'architecture', 'refactor', 'redesign', 'migrate',
    'restructure', 'system', 'integration'
  ];
  architecturalTerms.forEach(term => {
    if (taskDescription.toLowerCase().includes(term)) {
      complexity += 3;
    }
  });

  // Length-based complexity
  const wordCount = taskDescription.split(/\s+/).length;
  if (wordCount > 50) complexity += 2;
  else if (wordCount > 30) complexity += 1;

  return Math.min(complexity, 10);
}

/**
 * Calculate confidence score for an agent based on task analysis
 */
function calculateConfidence(
  taskDescription: string,
  capabilities: AgentCapabilities,
  complexity: number
): { score: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  // Keyword matching (40% weight)
  const taskLower = taskDescription.toLowerCase();
  let keywordMatches = 0;
  capabilities.keywordTriggers.forEach(keyword => {
    if (taskLower.includes(keyword.toLowerCase())) {
      keywordMatches++;
    }
  });

  if (keywordMatches > 0) {
    const keywordScore = Math.min((keywordMatches / capabilities.keywordTriggers.length) * 40, 40);
    score += keywordScore;
    reasons.push(`${keywordMatches} keyword matches`);
  }

  // Complexity matching (30% weight)
  const { min, max } = capabilities.complexityRange;
  if (complexity >= min && complexity <= max) {
    const complexityScore = 30;
    score += complexityScore;
    reasons.push(`complexity ${complexity} in range [${min}, ${max}]`);
  } else if (complexity < min) {
    const penalty = (min - complexity) * 5;
    score += Math.max(30 - penalty, 0);
    reasons.push(`complexity ${complexity} below optimal range`);
  } else {
    const penalty = (complexity - max) * 5;
    score += Math.max(30 - penalty, 0);
    reasons.push(`complexity ${complexity} above optimal range`);
  }

  // Priority bonus (30% weight)
  const priorityScore = (4 - capabilities.priority) * 10;
  score += priorityScore;

  const reasoning = reasons.join('; ');
  return { score: Math.min(score, 100), reasoning };
}

// ============================================================================
// Prompt Forwarding
// ============================================================================

/**
 * Rewrite prompt for a specific target agent
 */
export function forwardPrompt(
  originalPrompt: string,
  targetAgent: AgentName,
  context?: TaskContext
): string {
  // Get agent capabilities for potential future use
  // const agentCapabilities = {
  //   explore: EXPLORE_AGENT,
  //   plan: PLAN_AGENT,
  //   execute: EXECUTE_AGENT,
  //   review: REVIEW_AGENT
  // }[targetAgent];

  // Agent-specific prompt templates
  const templates = {
    explore: (prompt: string) => {
      // Make the prompt more search/exploration oriented
      if (!prompt.toLowerCase().match(/\b(find|search|locate|show|where)\b/)) {
        return `Search the codebase to find: ${prompt}`;
      }
      return prompt;
    },
    plan: (prompt: string) => {
      // Make the prompt more planning oriented
      if (!prompt.toLowerCase().match(/\b(plan|create|implement|design)\b/)) {
        return `Create a detailed plan to: ${prompt}`;
      }
      return prompt;
    },
    execute: (prompt: string) => {
      // Keep execute prompts direct
      return prompt;
    },
    review: (prompt: string) => {
      // Make the prompt more review oriented
      if (!prompt.toLowerCase().match(/\b(review|check|analyze|audit)\b/)) {
        return `Review and analyze: ${prompt}`;
      }
      return prompt;
    }
  };

  let forwardedPrompt = templates[targetAgent](originalPrompt);

  // Add context hints if available
  if (context?.previousAgent) {
    forwardedPrompt = `[Delegated from ${context.previousAgent} agent]\n${forwardedPrompt}`;
  }

  return forwardedPrompt;
}

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Route a task to the most appropriate agent
 */
export function routeTask(
  taskDescription: string,
  context?: TaskContext,
  options?: RoutingOptions
): RoutingResult {
  const registry = getGlobalRegistry();

  // Handle forced agent selection
  if (options?.forceAgent) {
    const agent = registry.getAgent(options.forceAgent);
    if (!agent) {
      throw new Error(`Agent '${options.forceAgent}' not found in registry`);
    }
    return {
      agent: options.forceAgent,
      confidence: 100,
      forwardedPrompt: options.enablePromptForwarding !== false
        ? forwardPrompt(taskDescription, options.forceAgent, context)
        : taskDescription,
      reasoning: `Forced agent selection via CLI override`
    };
  }

  // Analyze task complexity
  const complexity = analyzeTaskComplexity(taskDescription);

  // Calculate confidence for each agent
  const candidates = registry.listAgents().map(capabilities => {
    const { score, reasoning } = calculateConfidence(
      taskDescription,
      capabilities,
      complexity
    );
    return {
      agent: capabilities.name,
      confidence: score,
      reasoning
    };
  });

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Select best agent
  const minConfidence = options?.minConfidence ?? 20;
  const best = candidates[0];

  if (!best || best.confidence < minConfidence) {
    // Fallback to execute agent
    return {
      agent: 'execute',
      confidence: minConfidence,
      forwardedPrompt: taskDescription,
      reasoning: `No agent met confidence threshold (${minConfidence}%), falling back to execute`
    };
  }

  // Apply prompt forwarding if enabled
  const forwardedPrompt = options?.enablePromptForwarding !== false
    ? forwardPrompt(taskDescription, best.agent, context)
    : taskDescription;

  return {
    agent: best.agent,
    confidence: best.confidence,
    forwardedPrompt,
    reasoning: best.reasoning
  };
}

// ============================================================================
// Agent Chaining
// ============================================================================

/**
 * Delegate a task to another agent (for agent chaining)
 */
export async function delegateTask(
  fromAgent: AgentName,
  taskDescription: string,
  context?: TaskContext,
  options?: RoutingOptions
): Promise<any> {
  const maxDepth = options?.maxChainDepth ?? 3;
  const currentDepth = (context?.chainDepth ?? 0) + 1;

  if (currentDepth > maxDepth) {
    throw new Error(
      `Maximum agent chain depth (${maxDepth}) exceeded. Possible infinite loop detected.`
    );
  }

  const newContext: TaskContext = {
    ...context,
    previousAgent: fromAgent,
    chainDepth: currentDepth
  };

  const routing = routeTask(taskDescription, newContext, options);
  const registry = getGlobalRegistry();
  const executor = registry.getExecutor(routing.agent);

  if (!executor) {
    throw new Error(`No executor found for agent '${routing.agent}'`);
  }

  console.log(
    `[agent-chain] ${fromAgent} → ${routing.agent} (depth: ${currentDepth}, confidence: ${routing.confidence}%)`
  );

  return executor(routing.forwardedPrompt, newContext);
}

// ============================================================================
// Global Registry Management
// ============================================================================

let globalRegistry: AgentRegistry | null = null;

/**
 * Get or create the global agent registry
 */
export function getGlobalRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
    initializeDefaultAgents();
  }
  return globalRegistry;
}

/**
 * Initialize default agents with mock executors
 */
function initializeDefaultAgents(): void {
  if (!globalRegistry) return;

  // Register default agents with placeholder executors
  // In real implementation, these would be actual agent executors
  const mockExecutor: AgentExecutor = async (prompt, context) => {
    console.log(`[mock] Executing prompt: ${prompt}`);
    return { success: true, prompt, context };
  };

  globalRegistry.registerAgent('explore', EXPLORE_AGENT, mockExecutor);
  globalRegistry.registerAgent('plan', PLAN_AGENT, mockExecutor);
  globalRegistry.registerAgent('execute', EXECUTE_AGENT, mockExecutor);
  globalRegistry.registerAgent('review', REVIEW_AGENT, mockExecutor);
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null;
}

// ============================================================================
// Public API
// ============================================================================

export {
  AgentRegistry,
  EXPLORE_AGENT,
  PLAN_AGENT,
  EXECUTE_AGENT,
  REVIEW_AGENT,
  analyzeTaskComplexity
};
