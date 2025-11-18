# Agent Routing System - Quick Start Guide

## Installation

```bash
cd src
npm install
npm run build
```

## Basic Usage

### 1. Simple Routing

```typescript
import { routeTask } from './routing/agent-router';

// Auto-route based on task analysis
const result = routeTask('Find all API endpoints');
console.log(`Agent: ${result.agent}`);
console.log(`Confidence: ${result.confidence}%`);
console.log(`Forwarded Prompt: ${result.forwardedPrompt}`);
```

**Output:**
```
Agent: explore
Confidence: 85%
Forwarded Prompt: Search the codebase to find: Find all API endpoints
```

### 2. Using Seven Wrapper (Recommended)

```typescript
import { SevenWrapper } from './seven-wrapper';

// Create Seven instance
const seven = new SevenWrapper({
  enableRouting: true,
  enablePromptForwarding: true,
  logRoutingDecisions: true
});

// Process a task (preplan + execute + postprocess)
await seven.process('Implement user authentication');
```

**Console Output:**
```
[seven] === PREPLAN PHASE ===
[seven] User prompt: Implement user authentication...
[seven] Routing to plan agent (confidence: 92%)
[seven] Reasoning: 1 keyword matches; complexity 7 in range [5, 10]
[seven] === EXECUTE PHASE ===
[seven] Executing plan agent...
[seven] Execution succeeded in 123ms
[seven] === POSTPROCESS PHASE ===
```

### 3. CLI Usage

```bash
# Auto-routing
claude "find authentication code"

# Force specific agent
claude --agent=explore "where is the login handler?"

# Enable debug mode
claude --debug "refactor API layer"

# List available agents
claude --list-agents

# Show performance statistics
claude --show-stats
```

## Common Routing Patterns

### Search/Navigation → Explore Agent

```typescript
routeTask('Find all React components');
routeTask('Where is the database connection defined?');
routeTask('Show me files related to authentication');
routeTask('Explain how the routing works');
// → All route to 'explore' agent
```

### Complex Tasks → Plan Agent

```typescript
routeTask('Implement user authentication system');
routeTask('Refactor the entire API layer');
routeTask('Migrate from REST to GraphQL');
routeTask('Create a caching strategy for the app');
// → All route to 'plan' agent
```

### Direct Changes → Execute Agent

```typescript
routeTask('Fix the typo in app.ts line 42');
routeTask('Update the API endpoint to use HTTPS');
routeTask('Run the test suite');
routeTask('Delete the deprecated helper file');
// → All route to 'execute' agent
```

### Quality Checks → Review Agent

```typescript
routeTask('Review this code for security issues');
routeTask('Check for performance bottlenecks');
routeTask('Audit the authentication flow');
routeTask('Analyze code quality in src/utils');
// → All route to 'review' agent
```

## Advanced Features

### Force Agent Selection

```typescript
// Override auto-routing
const result = routeTask('some task', undefined, {
  forceAgent: 'plan'
});
```

### Disable Prompt Forwarding

```typescript
const result = routeTask('some task', undefined, {
  enablePromptForwarding: false
});
// Prompt will NOT be rewritten
```

### Context-Aware Routing

```typescript
import { type TaskContext } from './routing/agent-router';

const context: TaskContext = {
  conversationHistory: ['Find auth module', 'Where is user model?'],
  previousAgent: 'explore',
  userPreferences: { preferredAgent: 'explore' },
  chainDepth: 0
};

const result = routeTask('Show me the login flow', context);
// Routing considers conversation history and preferences
```

### Agent Chaining

```typescript
import { delegateTask } from './routing/agent-router';

// Agent can delegate to another agent
async function complexTask(prompt: string, context: TaskContext) {
  // Do some work...

  // Delegate sub-task to another agent
  const result = await delegateTask('plan', 'Execute step 1', context);

  return result;
}
```

### Statistics and Learning

```typescript
const seven = new SevenWrapper();

// Process several tasks
await seven.process('Find API endpoints');
await seven.process('Implement auth');
await seven.process('Fix bug in app.ts');

// Get performance statistics
const stats = seven.getAllAgentStats();
console.log(stats);
// {
//   explore: { totalTasks: 10, successRate: 95, avgConfidence: 82 },
//   plan: { totalTasks: 5, successRate: 80, avgConfidence: 88 },
//   execute: { totalTasks: 8, successRate: 87, avgConfidence: 76 },
//   review: { totalTasks: 2, successRate: 100, avgConfidence: 71 }
// }
```

## Configuration Options

### SevenConfig

```typescript
const seven = new SevenWrapper({
  // Enable/disable routing (default: true)
  enableRouting: true,

  // Enable/disable prompt forwarding (default: true)
  enablePromptForwarding: true,

  // Minimum confidence threshold (default: 20)
  minConfidence: 30,

  // Maximum agent chain depth (default: 3)
  maxChainDepth: 5,

  // Log routing decisions (default: true)
  logRoutingDecisions: true,

  // Force specific agent (optional)
  forcedAgent: 'explore'
});
```

### RoutingOptions

```typescript
const result = routeTask('task', context, {
  // Force specific agent
  forceAgent: 'plan',

  // Set confidence threshold
  minConfidence: 50,

  // Enable/disable forwarding
  enablePromptForwarding: false,

  // Set max chain depth
  maxChainDepth: 2
});
```

## Running Examples

```bash
# Run all examples
npm run examples

# Or run specific examples in Node.js/ts-node
ts-node examples/basic-usage.ts
```

## CLI Flags Reference

| Flag | Description | Example |
|------|-------------|---------|
| `--agent=<name>` | Force specific agent | `--agent=explore` |
| `--list-agents` | Show all agents | `--list-agents` |
| `--show-stats` | Display statistics | `--show-stats` |
| `--debug` | Enable debug logging | `--debug` |
| `--min-confidence=N` | Set threshold | `--min-confidence=50` |
| `--no-forwarding` | Disable forwarding | `--no-forwarding` |
| `--max-chain-depth=N` | Set chain depth | `--max-chain-depth=5` |

## Troubleshooting

### Wrong Agent Selected

**Problem:** Task routed to unexpected agent

**Solutions:**
1. Check routing with debug mode: `--debug`
2. Force correct agent: `--agent=<name>`
3. Improve prompt with better keywords
4. Review agent capabilities: `--list-agents`

### Low Confidence Scores

**Problem:** All agents have low confidence

**Solutions:**
1. Reduce threshold: `--min-confidence=10`
2. Make prompt more specific
3. Add relevant keywords
4. Check task matches agent capabilities

### Agent Chaining Loops

**Problem:** "Maximum agent chain depth exceeded"

**Solutions:**
1. Reduce max depth: `--max-chain-depth=2`
2. Check delegation logic in custom agents
3. Review chain depth in logs (`--debug`)

## Next Steps

- Read full documentation: [AGENT_ROUTING.md](./AGENT_ROUTING.md)
- Review examples: [examples/basic-usage.ts](./examples/basic-usage.ts)
- Extend with custom agents
- Integrate into your workflow

## Support

For issues or questions:
- Check documentation in `AGENT_ROUTING.md`
- Review examples in `examples/`
- File issues on GitHub

---

**Happy routing!** 🚀
