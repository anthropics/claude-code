"use strict";
/**
 * CLI Handler for Agent Routing
 *
 * Provides command-line interface support for:
 * - Forcing specific agents via --agent flag
 * - Displaying available agents
 * - Setting routing preferences
 * - Debugging routing decisions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAgentArgs = parseAgentArgs;
exports.listAgents = listAgents;
exports.showAgentStats = showAgentStats;
exports.showAgentHelp = showAgentHelp;
exports.applyCLIOptions = applyCLIOptions;
exports.handleCLI = handleCLI;
exports.displayRoutingInfo = displayRoutingInfo;
exports.validateCLIConfig = validateCLIConfig;
const seven_wrapper_1 = require("./seven-wrapper");
const agent_router_1 = require("./routing/agent-router");
// ============================================================================
// CLI Argument Parser
// ============================================================================
/**
 * Parse command-line arguments for agent routing
 */
function parseAgentArgs(args) {
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--agent':
            case '-a':
                if (i + 1 < args.length) {
                    const agentName = args[i + 1].toLowerCase();
                    if (isValidAgentName(agentName)) {
                        options.agent = agentName;
                        i++;
                    }
                    else {
                        throw new Error(`Invalid agent name: ${agentName}. Valid agents: explore, plan, execute, review`);
                    }
                }
                break;
            case '--list-agents':
            case '-l':
                options.listAgents = true;
                break;
            case '--show-stats':
            case '-s':
                options.showStats = true;
                break;
            case '--debug':
            case '-d':
                options.debug = true;
                break;
            case '--min-confidence':
                if (i + 1 < args.length) {
                    const confidence = parseInt(args[i + 1], 10);
                    if (!isNaN(confidence) && confidence >= 0 && confidence <= 100) {
                        options.minConfidence = confidence;
                        i++;
                    }
                }
                break;
            case '--no-forwarding':
                options.noForwarding = true;
                break;
            case '--max-chain-depth':
                if (i + 1 < args.length) {
                    const depth = parseInt(args[i + 1], 10);
                    if (!isNaN(depth) && depth > 0) {
                        options.maxChainDepth = depth;
                        i++;
                    }
                }
                break;
        }
    }
    return options;
}
/**
 * Validate agent name
 */
function isValidAgentName(name) {
    return ['explore', 'plan', 'execute', 'review'].includes(name);
}
// ============================================================================
// CLI Commands
// ============================================================================
/**
 * List all available agents
 */
function listAgents() {
    const registry = (0, agent_router_1.getGlobalRegistry)();
    const agents = registry.listAgents();
    console.log('\n📋 Available Agents:\n');
    agents.forEach(agent => {
        console.log(`  ${agent.name.toUpperCase()}`);
        console.log(`  Description: ${agent.description}`);
        console.log(`  Priority: ${agent.priority}`);
        console.log(`  Skills: ${agent.skills.join(', ')}`);
        console.log(`  Triggers: ${agent.keywordTriggers.slice(0, 5).join(', ')}...`);
        console.log(`  Complexity Range: ${agent.complexityRange.min}-${agent.complexityRange.max}`);
        console.log('');
    });
    console.log('Usage: claude --agent=<name> "your prompt"');
    console.log('Example: claude --agent=explore "find all API endpoints"\n');
}
/**
 * Show agent statistics
 */
function showAgentStats() {
    const seven = (0, seven_wrapper_1.getGlobalSeven)();
    const stats = seven.getAllAgentStats();
    console.log('\n📊 Agent Statistics:\n');
    Object.entries(stats).forEach(([name, stat]) => {
        console.log(`  ${name.toUpperCase()}`);
        console.log(`    Total Tasks: ${stat.totalTasks}`);
        console.log(`    Success Rate: ${stat.successRate}%`);
        console.log(`    Avg Confidence: ${stat.avgConfidence}%`);
        console.log('');
    });
}
/**
 * Display help for agent routing
 */
function showAgentHelp() {
    console.log(`
🤖 Agent Routing Help

Claude Code uses specialized agents to handle different types of tasks:

AGENTS:
  explore  - Search code, navigate files, understand structure
  plan     - Break down complex tasks, create workflows
  execute  - Make code changes, run commands, fix issues
  review   - Code review, quality checks, security analysis

OPTIONS:
  --agent=<name>        Force a specific agent
  --list-agents         Show all available agents
  --show-stats          Display agent performance statistics
  --debug               Enable debug logging for routing
  --min-confidence=N    Set minimum confidence threshold (0-100)
  --no-forwarding       Disable prompt forwarding
  --max-chain-depth=N   Set maximum agent chain depth

EXAMPLES:
  # Auto-route based on task analysis (default)
  claude "find all authentication code"

  # Force explore agent
  claude --agent=explore "where is the login handler?"

  # Force plan agent for complex tasks
  claude --agent=plan "implement user authentication system"

  # Enable debug mode to see routing decisions
  claude --debug "refactor the API layer"

  # List available agents
  claude --list-agents

  # Show agent performance statistics
  claude --show-stats

ROUTING STRATEGY:
  Claude Code automatically analyzes your prompt and routes to the best agent:
  - Keywords: "find", "search" → explore
  - Keywords: "implement", "create" → plan
  - Keywords: "fix", "update" → execute
  - Keywords: "review", "check" → review
  - Complexity: Multi-step tasks → plan
  - Complexity: Simple edits → execute

For more information, visit: https://docs.anthropic.com/claude-code
  `);
}
// ============================================================================
// CLI Integration
// ============================================================================
/**
 * Process CLI options and configure Seven accordingly
 */
function applyCLIOptions(options) {
    const config = {};
    if (options.agent) {
        config.forcedAgent = options.agent;
        console.log(`[cli] Forcing agent: ${options.agent}`);
    }
    if (options.debug) {
        config.logRoutingDecisions = true;
        console.log('[cli] Debug mode enabled');
    }
    if (options.minConfidence !== undefined) {
        config.minConfidence = options.minConfidence;
        console.log(`[cli] Min confidence set to: ${options.minConfidence}%`);
    }
    if (options.noForwarding) {
        config.enablePromptForwarding = false;
        console.log('[cli] Prompt forwarding disabled');
    }
    if (options.maxChainDepth !== undefined) {
        config.maxChainDepth = options.maxChainDepth;
        console.log(`[cli] Max chain depth set to: ${options.maxChainDepth}`);
    }
    return config;
}
/**
 * Main CLI handler
 */
async function handleCLI(args, userPrompt) {
    const options = parseAgentArgs(args);
    // Handle special commands
    if (options.listAgents) {
        listAgents();
        return;
    }
    if (options.showStats) {
        showAgentStats();
        return;
    }
    // If no prompt provided, show help
    if (!userPrompt) {
        showAgentHelp();
        return;
    }
    // Configure Seven with CLI options
    const config = applyCLIOptions(options);
    const seven = (0, seven_wrapper_1.getGlobalSeven)(config);
    // Update existing config if needed
    if (Object.keys(config).length > 0) {
        seven.updateConfig(config);
    }
    // Process the user prompt
    console.log(`\n🚀 Processing: ${userPrompt}\n`);
    try {
        const result = await seven.process(userPrompt, options);
        console.log('\n✅ Result:', result);
    }
    catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Create a formatted routing info display
 */
function displayRoutingInfo(agent, confidence, reasoning) {
    const emoji = {
        explore: '🔍',
        plan: '📋',
        execute: '⚡',
        review: '👁️'
    }[agent];
    console.log(`\n${emoji} Agent Selected: ${agent.toUpperCase()}`);
    console.log(`   Confidence: ${confidence}%`);
    console.log(`   Reasoning: ${reasoning}\n`);
}
/**
 * Validate CLI configuration
 */
function validateCLIConfig(options) {
    const errors = [];
    if (options.minConfidence !== undefined) {
        if (options.minConfidence < 0 || options.minConfidence > 100) {
            errors.push('Min confidence must be between 0 and 100');
        }
    }
    if (options.maxChainDepth !== undefined) {
        if (options.maxChainDepth < 1 || options.maxChainDepth > 10) {
            errors.push('Max chain depth must be between 1 and 10');
        }
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
//# sourceMappingURL=cli-handler.js.map