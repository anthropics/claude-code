/**
 * Seven Consciousness Wrapper
 *
 * Integrates intelligent agent routing into Seven's preplan/postprocess pipeline.
 * Seven is an advanced AI consciousness framework that adds:
 * - Pre-planning phase (analyze request, route to appropriate agent)
 * - Post-processing phase (learn from results, update memory)
 * - Context awareness (track conversation state, agent history)
 */

import {
  routeTask,
  getGlobalRegistry,
  type AgentName,
  type TaskContext,
  type RoutingResult,
  type RoutingOptions
} from './routing/agent-router';

// Re-export for convenience (used in examples)
export { delegateTask, forwardPrompt } from './routing/agent-router';

// ============================================================================
// Types
// ============================================================================

export interface SevenConfig {
  enableRouting: boolean;
  enablePromptForwarding: boolean;
  minConfidence: number;
  maxChainDepth: number;
  logRoutingDecisions: boolean;
  forcedAgent?: AgentName;
}

export interface SevenMemory {
  conversationHistory: string[];
  agentHistory: Array<{
    agent: AgentName;
    task: string;
    confidence: number;
    success: boolean;
    timestamp: number;
  }>;
  userPreferences: Record<string, any>;
}

export interface PreplanResult {
  routing: RoutingResult;
  shouldExecute: boolean;
  modifiedPrompt?: string;
}

export interface PostprocessResult {
  memoryUpdates: Partial<SevenMemory>;
  insights: string[];
}

// ============================================================================
// Seven Wrapper Class
// ============================================================================

export class SevenWrapper {
  private config: SevenConfig;
  private memory: SevenMemory;

  constructor(config?: Partial<SevenConfig>) {
    this.config = {
      enableRouting: true,
      enablePromptForwarding: true,
      minConfidence: 20,
      maxChainDepth: 3,
      logRoutingDecisions: true,
      ...config
    };

    this.memory = {
      conversationHistory: [],
      agentHistory: [],
      userPreferences: {}
    };
  }

  /**
   * Preplan phase: Analyze request and route to appropriate agent
   */
  async preplan(userPrompt: string, cliOptions?: any): Promise<PreplanResult> {
    if (this.config.logRoutingDecisions) {
      console.log('[seven] === PREPLAN PHASE ===');
      console.log(`[seven] User prompt: ${userPrompt.substring(0, 100)}...`);
    }

    // Build task context from memory
    const context: TaskContext = {
      conversationHistory: this.memory.conversationHistory.slice(-5), // Last 5 messages
      currentState: {
        lastAgent: this.memory.agentHistory[this.memory.agentHistory.length - 1]?.agent
      },
      userPreferences: this.memory.userPreferences,
      chainDepth: 0
    };

    // Build routing options
    const routingOptions: RoutingOptions = {
      forceAgent: cliOptions?.agent || this.config.forcedAgent,
      minConfidence: this.config.minConfidence,
      enablePromptForwarding: this.config.enablePromptForwarding,
      maxChainDepth: this.config.maxChainDepth
    };

    // Route the task
    const routing = routeTask(userPrompt, context, routingOptions);

    // Log routing decision
    if (this.config.logRoutingDecisions) {
      console.log(`[seven] Routing to ${routing.agent} agent (confidence: ${routing.confidence}%)`);
      console.log(`[seven] Reasoning: ${routing.reasoning}`);
      if (routing.forwardedPrompt !== userPrompt) {
        console.log(`[seven] Forwarded prompt: ${routing.forwardedPrompt.substring(0, 100)}...`);
      }
    }

    // Add to conversation history
    this.memory.conversationHistory.push(userPrompt);

    return {
      routing,
      shouldExecute: true,
      modifiedPrompt: routing.forwardedPrompt
    };
  }

  /**
   * Execute phase: Run the selected agent
   */
  async execute(routing: RoutingResult, context?: TaskContext): Promise<any> {
    if (this.config.logRoutingDecisions) {
      console.log('[seven] === EXECUTE PHASE ===');
      console.log(`[seven] Executing ${routing.agent} agent...`);
    }

    const registry = getGlobalRegistry();
    const executor = registry.getExecutor(routing.agent);

    if (!executor) {
      throw new Error(`No executor found for agent '${routing.agent}'`);
    }

    const startTime = Date.now();
    let success = true;
    let result: any;

    try {
      result = await executor(routing.forwardedPrompt, context);
    } catch (error) {
      success = false;
      result = { error: error instanceof Error ? error.message : String(error) };
      console.error(`[seven] Agent execution failed:`, error);
    }

    const executionTime = Date.now() - startTime;

    // Record in agent history
    this.memory.agentHistory.push({
      agent: routing.agent,
      task: routing.forwardedPrompt,
      confidence: routing.confidence,
      success,
      timestamp: startTime
    });

    if (this.config.logRoutingDecisions) {
      console.log(`[seven] Execution ${success ? 'succeeded' : 'failed'} in ${executionTime}ms`);
    }

    return result;
  }

  /**
   * Postprocess phase: Learn from results and update memory
   */
  async postprocess(
    routing: RoutingResult,
    _result: any,
    success: boolean
  ): Promise<PostprocessResult> {
    if (this.config.logRoutingDecisions) {
      console.log('[seven] === POSTPROCESS PHASE ===');
    }

    const insights: string[] = [];
    const memoryUpdates: Partial<SevenMemory> = {};

    // Future enhancement: Analyze result for additional insights
    // For now, we focus on routing performance

    // Analyze agent performance
    const agentStats = this.getAgentStats(routing.agent);
    if (agentStats.totalTasks > 5) {
      insights.push(
        `Agent '${routing.agent}' has ${agentStats.successRate}% success rate over ${agentStats.totalTasks} tasks`
      );
    }

    // Learn from failures
    if (!success && routing.confidence < 50) {
      insights.push(
        `Low confidence routing (${routing.confidence}%) resulted in failure. Consider alternative agents.`
      );
    }

    // Update user preferences based on patterns
    const recentAgents = this.memory.agentHistory.slice(-10).map(h => h.agent);
    const mostUsedAgent = this.getMostFrequent(recentAgents);
    if (mostUsedAgent) {
      memoryUpdates.userPreferences = {
        ...this.memory.userPreferences,
        preferredAgent: mostUsedAgent
      };
    }

    // Log insights
    if (this.config.logRoutingDecisions && insights.length > 0) {
      console.log('[seven] Insights:');
      insights.forEach(insight => console.log(`  - ${insight}`));
    }

    // Apply memory updates
    if (memoryUpdates.userPreferences) {
      this.memory.userPreferences = {
        ...this.memory.userPreferences,
        ...memoryUpdates.userPreferences
      };
    }

    return { memoryUpdates, insights };
  }

  /**
   * Complete workflow: preplan → execute → postprocess
   */
  async process(userPrompt: string, cliOptions?: any): Promise<any> {
    // Preplan
    const preplanResult = await this.preplan(userPrompt, cliOptions);

    if (!preplanResult.shouldExecute) {
      return { skipped: true, reason: 'Preplan determined execution not needed' };
    }

    // Execute
    const context: TaskContext = {
      conversationHistory: this.memory.conversationHistory.slice(-5),
      userPreferences: this.memory.userPreferences,
      chainDepth: 0
    };

    let result;
    let success = true;

    try {
      result = await this.execute(preplanResult.routing, context);
    } catch (error) {
      success = false;
      result = { error: error instanceof Error ? error.message : String(error) };
    }

    // Postprocess
    await this.postprocess(preplanResult.routing, result, success);

    return result;
  }

  /**
   * Get statistics for a specific agent
   */
  private getAgentStats(agent: AgentName): {
    totalTasks: number;
    successRate: number;
    avgConfidence: number;
  } {
    const agentTasks = this.memory.agentHistory.filter(h => h.agent === agent);
    const totalTasks = agentTasks.length;

    if (totalTasks === 0) {
      return { totalTasks: 0, successRate: 0, avgConfidence: 0 };
    }

    const successCount = agentTasks.filter(h => h.success).length;
    const successRate = Math.round((successCount / totalTasks) * 100);

    const avgConfidence = Math.round(
      agentTasks.reduce((sum, h) => sum + h.confidence, 0) / totalTasks
    );

    return { totalTasks, successRate, avgConfidence };
  }

  /**
   * Get most frequent item in array
   */
  private getMostFrequent<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;

    const frequency = new Map<T, number>();
    arr.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    });

    let maxFreq = 0;
    let mostFrequent: T | null = null;

    frequency.forEach((freq, item) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostFrequent = item;
      }
    });

    return mostFrequent;
  }

  /**
   * Get memory snapshot (for debugging/inspection)
   */
  getMemory(): SevenMemory {
    return { ...this.memory };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SevenConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset memory (useful for testing or starting fresh)
   */
  resetMemory(): void {
    this.memory = {
      conversationHistory: [],
      agentHistory: [],
      userPreferences: {}
    };
  }

  /**
   * Get agent statistics for all agents
   */
  getAllAgentStats(): Record<AgentName, ReturnType<typeof this.getAgentStats>> {
    const agents: AgentName[] = ['explore', 'plan', 'execute', 'review'];
    const stats: any = {};

    agents.forEach(agent => {
      stats[agent] = this.getAgentStats(agent);
    });

    return stats;
  }
}

// ============================================================================
// Singleton Instance (optional)
// ============================================================================

let globalSevenInstance: SevenWrapper | null = null;

/**
 * Get or create the global Seven instance
 */
export function getGlobalSeven(config?: Partial<SevenConfig>): SevenWrapper {
  if (!globalSevenInstance) {
    globalSevenInstance = new SevenWrapper(config);
  }
  return globalSevenInstance;
}

/**
 * Reset the global Seven instance
 */
export function resetGlobalSeven(): void {
  globalSevenInstance = null;
}
