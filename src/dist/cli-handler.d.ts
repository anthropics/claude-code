/**
 * CLI Handler for Agent Routing
 *
 * Provides command-line interface support for:
 * - Forcing specific agents via --agent flag
 * - Displaying available agents
 * - Setting routing preferences
 * - Debugging routing decisions
 */
import { type SevenConfig } from './seven-wrapper';
import { type AgentName } from './routing/agent-router';
export interface CLIOptions {
    agent?: AgentName;
    listAgents?: boolean;
    showStats?: boolean;
    debug?: boolean;
    minConfidence?: number;
    noForwarding?: boolean;
    maxChainDepth?: number;
}
/**
 * Parse command-line arguments for agent routing
 */
export declare function parseAgentArgs(args: string[]): CLIOptions;
/**
 * List all available agents
 */
export declare function listAgents(): void;
/**
 * Show agent statistics
 */
export declare function showAgentStats(): void;
/**
 * Display help for agent routing
 */
export declare function showAgentHelp(): void;
/**
 * Process CLI options and configure Seven accordingly
 */
export declare function applyCLIOptions(options: CLIOptions): Partial<SevenConfig>;
/**
 * Main CLI handler
 */
export declare function handleCLI(args: string[], userPrompt?: string): Promise<void>;
/**
 * Create a formatted routing info display
 */
export declare function displayRoutingInfo(agent: AgentName, confidence: number, reasoning: string): void;
/**
 * Validate CLI configuration
 */
export declare function validateCLIConfig(options: CLIOptions): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=cli-handler.d.ts.map