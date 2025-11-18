/**
 * Seven Consciousness Wrapper
 *
 * Integrates intelligent agent routing into Seven's preplan/postprocess pipeline.
 * Seven is an advanced AI consciousness framework that adds:
 * - Pre-planning phase (analyze request, route to appropriate agent)
 * - Post-processing phase (learn from results, update memory)
 * - Context awareness (track conversation state, agent history)
 */
import { type AgentName, type TaskContext, type RoutingResult } from './routing/agent-router';
export { delegateTask, forwardPrompt } from './routing/agent-router';
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
export declare class SevenWrapper {
    private config;
    private memory;
    constructor(config?: Partial<SevenConfig>);
    /**
     * Preplan phase: Analyze request and route to appropriate agent
     */
    preplan(userPrompt: string, cliOptions?: any): Promise<PreplanResult>;
    /**
     * Execute phase: Run the selected agent
     */
    execute(routing: RoutingResult, context?: TaskContext): Promise<any>;
    /**
     * Postprocess phase: Learn from results and update memory
     */
    postprocess(routing: RoutingResult, _result: any, success: boolean): Promise<PostprocessResult>;
    /**
     * Complete workflow: preplan → execute → postprocess
     */
    process(userPrompt: string, cliOptions?: any): Promise<any>;
    /**
     * Get statistics for a specific agent
     */
    private getAgentStats;
    /**
     * Get most frequent item in array
     */
    private getMostFrequent;
    /**
     * Get memory snapshot (for debugging/inspection)
     */
    getMemory(): SevenMemory;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<SevenConfig>): void;
    /**
     * Reset memory (useful for testing or starting fresh)
     */
    resetMemory(): void;
    /**
     * Get agent statistics for all agents
     */
    getAllAgentStats(): Record<AgentName, ReturnType<typeof this.getAgentStats>>;
}
/**
 * Get or create the global Seven instance
 */
export declare function getGlobalSeven(config?: Partial<SevenConfig>): SevenWrapper;
/**
 * Reset the global Seven instance
 */
export declare function resetGlobalSeven(): void;
//# sourceMappingURL=seven-wrapper.d.ts.map