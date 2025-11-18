/**
 * Agent Routing System for Claude Code
 *
 * Provides intelligent routing of tasks to specialized agents based on:
 * - Task analysis (keywords, intent, complexity)
 * - Agent capabilities (skills, strengths)
 * - Context (conversation history, current state)
 * - Load balancing (optional, for multi-agent scenarios)
 */
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
    complexityRange: {
        min: number;
        max: number;
    };
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
declare class AgentRegistry {
    private agents;
    /**
     * Register an agent with its capabilities and executor
     */
    registerAgent(name: AgentName, capabilities: AgentCapabilities, executor: AgentExecutor): void;
    /**
     * Get a registered agent by name
     */
    getAgent(name: AgentName): RegisteredAgent | undefined;
    /**
     * List all registered agents
     */
    listAgents(): AgentCapabilities[];
    /**
     * Check if an agent is registered
     */
    hasAgent(name: AgentName): boolean;
    /**
     * Get agent executor
     */
    getExecutor(name: AgentName): AgentExecutor | undefined;
}
declare const EXPLORE_AGENT: AgentCapabilities;
declare const PLAN_AGENT: AgentCapabilities;
declare const EXECUTE_AGENT: AgentCapabilities;
declare const REVIEW_AGENT: AgentCapabilities;
/**
 * Analyze task complexity based on various factors
 */
declare function analyzeTaskComplexity(taskDescription: string): number;
/**
 * Rewrite prompt for a specific target agent
 */
export declare function forwardPrompt(originalPrompt: string, targetAgent: AgentName, context?: TaskContext): string;
/**
 * Route a task to the most appropriate agent
 */
export declare function routeTask(taskDescription: string, context?: TaskContext, options?: RoutingOptions): RoutingResult;
/**
 * Delegate a task to another agent (for agent chaining)
 */
export declare function delegateTask(fromAgent: AgentName, taskDescription: string, context?: TaskContext, options?: RoutingOptions): Promise<any>;
/**
 * Get or create the global agent registry
 */
export declare function getGlobalRegistry(): AgentRegistry;
/**
 * Reset the global registry (useful for testing)
 */
export declare function resetGlobalRegistry(): void;
export { AgentRegistry, EXPLORE_AGENT, PLAN_AGENT, EXECUTE_AGENT, REVIEW_AGENT, analyzeTaskComplexity };
//# sourceMappingURL=agent-router.d.ts.map