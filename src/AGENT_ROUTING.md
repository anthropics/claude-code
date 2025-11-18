# Agent Routing System

Intelligent task routing system for Claude Code that automatically selects and invokes the most appropriate specialized agent based on task analysis, agent capabilities, and context.

## Overview

Claude Code uses multiple specialized agents to handle different types of tasks:

- **Explore Agent** 🔍 - Code search, file navigation, codebase understanding
- **Plan Agent** 📋 - Task breakdown, workflow planning, complex coordination
- **Execute Agent** ⚡ - Direct code changes, command execution, quick fixes
- **Review Agent** 👁️ - Code review, quality checks, security analysis

The routing system analyzes user prompts and automatically selects the best agent, improving task success rate and user experience.

## Architecture

```
User Prompt
    ↓
Seven Wrapper (Preplan Phase)
    ↓
Agent Router
    ├─ Task Analysis (complexity, keywords, intent)
    ├─ Capability Matching (skills, triggers)
    └─ Confidence Scoring
    ↓
Selected Agent + Forwarded Prompt
    ↓
Execute Phase
    ↓
Postprocess Phase (learning, memory updates)
```

## Components

### 1. Agent Router (`src/routing/agent-router.ts`)

Core routing logic and agent registry.

**Key Functions:**

- `routeTask(taskDescription, context?, options?)` - Routes a task to the best agent
- `forwardPrompt(originalPrompt, targetAgent, context?)` - Rewrites prompts for specific agents
- `delegateTask(fromAgent, taskDescription, context?, options?)` - Enables agent chaining

**Agent Registry:**

```typescript
const registry = getGlobalRegistry();

// Register custom agent
registry.registerAgent('myagent', capabilities, executor);

// Get agent
const agent = registry.getAgent('explore');

// List all agents
const agents = registry.listAgents();
```

### 2. Seven Wrapper (`src/seven-wrapper.ts`)

Integration layer that connects routing with Seven consciousness framework.

**Phases:**

1. **Preplan** - Analyze request, route to agent
2. **Execute** - Run the selected agent
3. **Postprocess** - Learn from results, update memory

**Usage:**

```typescript
import { SevenWrapper } from './seven-wrapper';

const seven = new SevenWrapper({
  enableRouting: true,
  enablePromptForwarding: true,
  minConfidence: 20,
  logRoutingDecisions: true
});

// Complete workflow
const result = await seven.process('Find all API endpoints');

// Or step by step
const preplan = await seven.preplan('Implement auth');
const result = await seven.execute(preplan.routing);
await seven.postprocess(preplan.routing, result, true);
```

### 3. CLI Handler (`src/cli-handler.ts`)

Command-line interface for agent routing.

**Flags:**

- `--agent=<name>` - Force specific agent
- `--list-agents` - Show available agents
- `--show-stats` - Display performance statistics
- `--debug` - Enable debug logging
- `--min-confidence=N` - Set confidence threshold
- `--no-forwarding` - Disable prompt forwarding
- `--max-chain-depth=N` - Set max chain depth

**Examples:**

```bash
# Auto-routing (default)
claude "find authentication code"

# Force explore agent
claude --agent=explore "where is the login handler?"

# Enable debug mode
claude --debug "refactor API layer"

# List agents
claude --list-agents

# Show statistics
claude --show-stats
```

## Routing Strategy

### Keyword Matching (40% weight)

Each agent has keyword triggers that indicate it's the right choice:

- **Explore**: find, search, where, locate, show, explain, understand
- **Plan**: implement, create, build, design, refactor, complex
- **Execute**: fix, update, change, modify, edit, run, test
- **Review**: review, check, analyze, audit, security, quality

### Complexity Analysis (30% weight)

Task complexity is analyzed based on:

- Multi-step indicators ("and then", "first", "second")
- Multiple files/components
- System-wide changes ("all", "every", "entire")
- Architectural terms ("refactor", "migrate", "system")
- Prompt length and detail

**Complexity Ranges:**

- Explore: 1-5 (simple searches to moderate exploration)
- Execute: 1-8 (quick fixes to complex changes)
- Review: 2-7 (basic checks to deep analysis)
- Plan: 5-10 (complex multi-step workflows)

### Priority (30% weight)

Agents have base priorities that influence selection:

1. Execute (priority 1) - Default for ambiguous tasks
2. Explore (priority 2) - High priority for search tasks
3. Review (priority 2) - High priority for quality tasks
4. Plan (priority 3) - Highest complexity tasks

### Example Routing Decisions

| Task | Selected Agent | Reasoning |
|------|---------------|-----------|
| "Find all API endpoints" | Explore | Keyword "find" + low complexity |
| "Implement user authentication" | Plan | Keyword "implement" + high complexity |
| "Fix typo in app.ts:42" | Execute | Keyword "fix" + low complexity |
| "Review PR for security issues" | Review | Keywords "review" + "security" |
| "Explain how auth works" | Explore | Keyword "explain" + understanding task |
| "Refactor entire codebase" | Plan | System-wide + high complexity |

## Prompt Forwarding

Prompts are rewritten to match the target agent's style and expectations:

**Examples:**

```typescript
// Explore agent
"Where's the login code?"
→ "Search the codebase to find: Where's the login code?"

// Plan agent
"Make the app faster"
→ "Create a detailed plan to: Make the app faster"

// Execute agent
"Fix bug"
→ "Fix bug" (no change, already direct)

// Review agent
"Check this code"
→ "Review and analyze: Check this code"
```

Forwarding can be disabled with `enablePromptForwarding: false` or `--no-forwarding`.

## Agent Chaining

Agents can delegate sub-tasks to other agents:

```typescript
import { delegateTask } from './routing/agent-router';

// Plan agent delegates execution
async function planAgent(prompt: string, context: TaskContext) {
  // Create plan...
  const plan = createPlan(prompt);

  // Delegate execution to execute agent
  for (const step of plan.steps) {
    await delegateTask('plan', step, context);
  }
}
```

**Protection:**

- Max chain depth (default: 3) prevents infinite loops
- Chain depth tracked in context
- Errors if depth exceeded

## Configuration

### Seven Config

```typescript
interface SevenConfig {
  enableRouting: boolean;           // Enable/disable routing
  enablePromptForwarding: boolean;  // Enable/disable forwarding
  minConfidence: number;            // Min confidence threshold (0-100)
  maxChainDepth: number;            // Max agent chain depth
  logRoutingDecisions: boolean;     // Log routing info
  forcedAgent?: AgentName;          // Force specific agent
}
```

### Routing Options

```typescript
interface RoutingOptions {
  forceAgent?: AgentName;           // Override routing
  minConfidence?: number;           // Confidence threshold
  enablePromptForwarding?: boolean; // Enable forwarding
  maxChainDepth?: number;           // Chain depth limit
}
```

## Memory and Learning

Seven maintains memory across sessions:

**Conversation History:**
- Tracks recent user prompts
- Used for context-aware routing

**Agent History:**
- Records agent performance
- Tracks success rates
- Calculates confidence trends

**User Preferences:**
- Learns preferred agents
- Adapts to usage patterns

**Statistics:**

```typescript
const stats = seven.getAllAgentStats();
// {
//   explore: { totalTasks: 10, successRate: 90, avgConfidence: 75 },
//   plan: { totalTasks: 5, successRate: 80, avgConfidence: 65 },
//   ...
// }
```

## Extension Guide

### Adding a New Agent

1. **Define Capabilities:**

```typescript
const MY_AGENT: AgentCapabilities = {
  name: 'myagent',
  skills: ['skill1', 'skill2'],
  priority: 2,
  description: 'My custom agent',
  keywordTriggers: ['keyword1', 'keyword2'],
  complexityRange: { min: 1, max: 5 }
};
```

2. **Implement Executor:**

```typescript
const myExecutor: AgentExecutor = async (prompt, context) => {
  // Agent logic here
  return { success: true, result: '...' };
};
```

3. **Register:**

```typescript
const registry = getGlobalRegistry();
registry.registerAgent('myagent', MY_AGENT, myExecutor);
```

### Custom Routing Logic

Extend `calculateConfidence()` in `agent-router.ts`:

```typescript
function calculateConfidence(
  taskDescription: string,
  capabilities: AgentCapabilities,
  complexity: number
): { score: number; reasoning: string } {
  // Add custom scoring logic
  // ...
}
```

### Custom Prompt Forwarding

Extend `forwardPrompt()` templates:

```typescript
const templates = {
  myagent: (prompt: string) => {
    return `Custom template: ${prompt}`;
  }
};
```

## Best Practices

1. **Use Auto-Routing by Default**
   - Trust the routing system
   - Only force agents when necessary

2. **Enable Debug Mode for Development**
   ```bash
   claude --debug "your task"
   ```

3. **Monitor Agent Statistics**
   ```bash
   claude --show-stats
   ```

4. **Provide Clear Prompts**
   - Good: "Find all authentication-related files in the src/ directory"
   - Bad: "auth stuff"

5. **Use Appropriate Keywords**
   - For searching: "find", "where", "show"
   - For implementing: "create", "implement", "build"
   - For fixing: "fix", "update", "correct"
   - For reviewing: "review", "check", "analyze"

6. **Leverage Context**
   - Related tasks benefit from conversation history
   - Seven learns from your patterns

## Troubleshooting

### Agent Selection Issues

**Problem:** Wrong agent selected
**Solution:**
- Use `--debug` to see routing reasoning
- Force specific agent with `--agent=<name>`
- Improve prompt clarity with better keywords

**Problem:** Low confidence scores
**Solution:**
- Adjust `--min-confidence` threshold
- Check agent capabilities match task
- Review keyword triggers

### Performance Issues

**Problem:** Slow routing
**Solution:**
- Reduce conversation history size
- Disable prompt forwarding if not needed
- Reset memory periodically

**Problem:** Agent chaining loops
**Solution:**
- Reduce `--max-chain-depth`
- Check delegation logic in agents
- Review chain depth in debug logs

## Testing

Run examples:

```bash
cd src/examples
npm install
npm run examples
```

Or test specific examples:

```typescript
import {
  example1_basicRouting,
  example4_sevenWrapper
} from './examples/basic-usage';

await example1_basicRouting();
await example4_sevenWrapper();
```

## API Reference

See inline TypeScript documentation for full API details:

- `src/routing/agent-router.ts` - Core routing
- `src/seven-wrapper.ts` - Seven integration
- `src/cli-handler.ts` - CLI interface

## Future Enhancements

- [ ] Machine learning-based routing
- [ ] Custom agent plugins
- [ ] Parallel agent execution
- [ ] Agent performance benchmarking
- [ ] Advanced context analysis
- [ ] Multi-modal routing (code + images + docs)
- [ ] Agent collaboration protocols
- [ ] Real-time routing optimization

## License

Same as Claude Code main license.

## Contributing

See CONTRIBUTING.md for guidelines on extending the routing system.
