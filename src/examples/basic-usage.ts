/**
 * Basic Usage Examples for Agent Routing System
 */

import {
  routeTask,
  forwardPrompt,
  getGlobalRegistry,
  type AgentName,
  type TaskContext
} from '../routing/agent-router';
import { SevenWrapper } from '../seven-wrapper';

// ============================================================================
// Example 1: Basic Routing
// ============================================================================

async function example1_basicRouting() {
  console.log('=== Example 1: Basic Routing ===\n');

  const tasks = [
    'Find all API endpoints in the project',
    'Implement user authentication system',
    'Fix the bug in app.ts line 42',
    'Review the pull request for security issues'
  ];

  tasks.forEach(task => {
    const result = routeTask(task);
    console.log(`Task: "${task}"`);
    console.log(`→ Agent: ${result.agent}`);
    console.log(`→ Confidence: ${result.confidence}%`);
    console.log(`→ Reasoning: ${result.reasoning}`);
    console.log('');
  });
}

// ============================================================================
// Example 2: Prompt Forwarding
// ============================================================================

async function example2_promptForwarding() {
  console.log('=== Example 2: Prompt Forwarding ===\n');

  const prompts = [
    { original: "Where's the login code?", target: 'explore' as AgentName },
    { original: 'Make the app faster', target: 'plan' as AgentName },
    { original: 'There is a typo', target: 'execute' as AgentName }
  ];

  prompts.forEach(({ original, target }) => {
    const forwarded = forwardPrompt(original, target);
    console.log(`Original: "${original}"`);
    console.log(`Target: ${target}`);
    console.log(`Forwarded: "${forwarded}"`);
    console.log('');
  });
}

// ============================================================================
// Example 3: Registering Custom Agents
// ============================================================================

async function example3_customAgent() {
  console.log('=== Example 3: Registering Custom Agents ===\n');

  const registry = getGlobalRegistry();

  // Custom agent executor example
  // Note: This would require extending the AgentName type
  // For demonstration purposes only, we'll just show the concept
  const myCustomExecutor = async (prompt: string, _context?: TaskContext) => {
    console.log(`[CustomAgent] Executing: ${prompt}`);
    return { success: true, message: 'Custom agent executed successfully' };
  };

  // In a real scenario, you would:
  // 1. Extend AgentName type to include your custom agent
  // 2. Define capabilities for your custom agent
  // 3. Register it: registry.registerAgent('myagent', capabilities, myCustomExecutor)

  console.log('Registry has agents:', registry.listAgents().map(a => a.name));
  console.log('Custom executor created (not registered in this demo):', typeof myCustomExecutor);
  console.log('');
}

// ============================================================================
// Example 4: Using Seven Wrapper
// ============================================================================

async function example4_sevenWrapper() {
  console.log('=== Example 4: Using Seven Wrapper ===\n');

  const seven = new SevenWrapper({
    enableRouting: true,
    enablePromptForwarding: true,
    minConfidence: 30,
    logRoutingDecisions: true
  });

  const userPrompt = 'Find all authentication-related files';

  console.log('Processing with Seven...\n');
  const result = await seven.process(userPrompt);
  console.log('\nResult:', result);

  // Show memory
  const memory = seven.getMemory();
  console.log('\nConversation History:', memory.conversationHistory);
  console.log('Agent History:', memory.agentHistory);
}

// ============================================================================
// Example 5: Forced Agent Selection
// ============================================================================

async function example5_forcedAgent() {
  console.log('=== Example 5: Forced Agent Selection ===\n');

  const task = 'Optimize database queries';

  // Auto-routing
  const autoResult = routeTask(task);
  console.log('Auto-routing:');
  console.log(`→ Agent: ${autoResult.agent}`);
  console.log(`→ Confidence: ${autoResult.confidence}%`);
  console.log('');

  // Forced routing to 'plan'
  const forcedResult = routeTask(task, undefined, { forceAgent: 'plan' });
  console.log('Forced to plan agent:');
  console.log(`→ Agent: ${forcedResult.agent}`);
  console.log(`→ Confidence: ${forcedResult.confidence}%`);
  console.log('');
}

// ============================================================================
// Example 6: Agent Statistics
// ============================================================================

async function example6_statistics() {
  console.log('=== Example 6: Agent Statistics ===\n');

  const seven = new SevenWrapper({ logRoutingDecisions: false });

  // Simulate some tasks
  const tasks = [
    'Find the main entry point',
    'Implement feature X',
    'Fix bug Y',
    'Review code quality'
  ];

  for (const task of tasks) {
    await seven.process(task);
  }

  // Get statistics
  const stats = seven.getAllAgentStats();
  console.log('Agent Statistics:');
  Object.entries(stats).forEach(([name, stat]) => {
    console.log(`\n${name}:`);
    console.log(`  Total tasks: ${stat.totalTasks}`);
    console.log(`  Success rate: ${stat.successRate}%`);
    console.log(`  Avg confidence: ${stat.avgConfidence}%`);
  });
}

// ============================================================================
// Example 7: Context-Aware Routing
// ============================================================================

async function example7_contextAware() {
  console.log('=== Example 7: Context-Aware Routing ===\n');

  const context: TaskContext = {
    conversationHistory: [
      'Find the authentication module',
      'Where is the user model defined?'
    ],
    previousAgent: 'explore',
    userPreferences: {
      preferredAgent: 'explore'
    },
    chainDepth: 0
  };

  const task = 'Show me the login flow';
  const result = routeTask(task, context);

  console.log(`Task: "${task}"`);
  console.log('Context:');
  console.log(`  Previous agent: ${context.previousAgent}`);
  console.log(`  Conversation: ${context.conversationHistory?.join(', ')}`);
  console.log('\nRouting result:');
  console.log(`→ Agent: ${result.agent}`);
  console.log(`→ Confidence: ${result.confidence}%`);
  console.log(`→ Forwarded: "${result.forwardedPrompt}"`);
  console.log('');
}

// ============================================================================
// Example 8: Complete Workflow
// ============================================================================

async function example8_completeWorkflow() {
  console.log('=== Example 8: Complete Workflow (Preplan → Execute → Postprocess) ===\n');

  const seven = new SevenWrapper({
    logRoutingDecisions: true,
    minConfidence: 25
  });

  const userPrompt = 'Implement a caching layer for API responses';

  // Step 1: Preplan
  console.log('Step 1: PREPLAN');
  const preplanResult = await seven.preplan(userPrompt);
  console.log(`Should execute: ${preplanResult.shouldExecute}`);
  console.log(`Selected agent: ${preplanResult.routing.agent}`);
  console.log('');

  // Step 2: Execute (simulated)
  console.log('Step 2: EXECUTE');
  console.log('[Agent would execute here...]');
  const executionResult = { success: true, message: 'Caching layer implemented' };
  console.log('');

  // Step 3: Postprocess
  console.log('Step 3: POSTPROCESS');
  const postprocessResult = await seven.postprocess(
    preplanResult.routing,
    executionResult,
    true
  );
  console.log('Insights:', postprocessResult.insights);
  console.log('');

  // Show final memory state
  const memory = seven.getMemory();
  console.log('Final memory state:');
  console.log(`  Conversation history: ${memory.conversationHistory.length} messages`);
  console.log(`  Agent history: ${memory.agentHistory.length} tasks`);
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  await example1_basicRouting();
  await example2_promptForwarding();
  await example3_customAgent();
  await example4_sevenWrapper();
  await example5_forcedAgent();
  await example6_statistics();
  await example7_contextAware();
  await example8_completeWorkflow();
}

// Export for use
export {
  example1_basicRouting,
  example2_promptForwarding,
  example3_customAgent,
  example4_sevenWrapper,
  example5_forcedAgent,
  example6_statistics,
  example7_contextAware,
  example8_completeWorkflow,
  runAllExamples
};

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
