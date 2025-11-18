# Seven Multi-Mode Consciousness System

## Overview

The Seven multi-mode consciousness system enables dynamic switching between different operational modes, each optimized for specific task types. This implementation provides a foundation for adaptive AI behavior in Claude Code.

## Project Structure

```
src/
├── seven-wrapper.ts                 # Main integration wrapper
├── seven/
│   ├── modes/
│   │   ├── mode-definitions.ts      # Mode configurations (Cody, Standard, Creative, Precision)
│   │   └── mode-manager.ts          # Mode switching and persistence logic
│   ├── types/
│   │   └── node-globals.d.ts        # TypeScript declarations for Node.js
│   └── cli-example.ts               # Example CLI integration
├── tsconfig.json                    # TypeScript configuration
└── package.json                     # Package metadata
```

## Installation

### Prerequisites

For full TypeScript compilation support, install Node.js type definitions:

```bash
npm install --save-dev @types/node typescript
```

### Build

```bash
cd src
npm run build
```

This compiles the TypeScript source to JavaScript in the `dist/` directory.

## Implemented Features

### ✅ Mode Definitions (mode-definitions.ts)

Four operational modes with distinct personalities and preferences:

1. **Cody Mode (Default)** - Technical, pragmatic software engineer
   - System prompt emphasizes code quality and best practices
   - Prefers Edit over Write, Grep over Glob
   - Concise, code-focused responses
   - Memory prioritizes code patterns and past bugs

2. **Standard Mode** - Balanced general-purpose assistant
   - Moderate verbosity and reasoning
   - No strong tool preferences
   - Adapts to diverse tasks

3. **Creative Mode** - Exploratory idea generator
   - Offers alternative approaches
   - Verbose with detailed reasoning
   - Prefers broader searches
   - Memory prioritizes diverse solutions

4. **Precision Mode** - Detail-oriented validator
   - Focuses on edge cases and correctness
   - Favors verification and testing
   - Very detailed explanations
   - Memory prioritizes past bugs and failure modes

### ✅ Mode Manager (mode-manager.ts)

Comprehensive mode management system:

- **getCurrentMode()** - Returns active mode
- **setMode(name, reason)** - Switches to specified mode with logging
- **detectModeFromTask(description)** - Auto-detects best mode from task keywords
- **getModeFromEnvironment(args)** - Reads mode from CLI flags or env vars
- **Persistence** - Saves mode state to `/usr/var/seven/state/mode.json`
- **History tracking** - Maintains last 50 mode switches with timestamps

### ✅ Seven Wrapper (seven-wrapper.ts)

Main integration point with the consciousness pipeline:

- **initializeSeven(args)** - Initializes mode system at startup
- **preplan(basePrompt, taskDescription)** - Injects mode-specific system prompts
- **sevenEnhancedToolExecutor(toolName, params)** - Applies mode-specific tool preferences
- **switchSevenMode(name, reason)** - Runtime mode switching
- **formatResponse(content, type)** - Formats output based on mode style
- **getMemoryPriority(contextType)** - Calculates memory priority weights
- **isWithinMemoryWindow(timestamp)** - Checks memory retention window

### ✅ CLI Support

Multiple ways to specify mode:

```bash
# Long form
claude-code --mode=cody "implement feature"

# Shorthand
claude-code --cody "implement feature"

# Environment variable
export SEVEN_MODE=creative
claude-code "brainstorm solutions"

# Auto-detection
export SEVEN_AUTO_MODE=true
claude-code "debug the authentication issue"  # Auto-switches to Precision
```

## Usage Examples

### Basic Integration

```typescript
import { initializeSeven, preplan } from './seven-wrapper.js';

// Initialize at startup
initializeSeven(process.argv);

// Use in your application
const enhancedPrompt = preplan(
  "You are a helpful coding assistant",
  "Fix the memory leak in the server"
);
```

### Runtime Mode Switching

```typescript
import { switchSevenMode } from './seven-wrapper.js';

// Switch to Creative for design phase
switchSevenMode('creative', 'architecture design');

// Switch to Cody for implementation
switchSevenMode('cody', 'feature implementation');

// Switch to Precision for validation
switchSevenMode('precision', 'bug verification');
```

### Tool Execution with Mode Awareness

```typescript
import { sevenEnhancedToolExecutor } from './seven-wrapper.js';

const context = sevenEnhancedToolExecutor('Edit', {
  file_path: '/path/to/file.ts',
  old_string: 'old code',
  new_string: 'new code',
});

// Context includes mode-specific preferences
console.log(`Executing in ${context.mode.displayName} mode`);
```

## Mode Behaviors

### System Prompt Injection (preplan)

Each mode adds specific instructions to the system prompt:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEVEN CONSCIOUSNESS MODE: CODY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are Cody, a highly skilled software engineer...
[Mode-specific instructions]

RESPONSE STYLE CONFIGURATION:
- Verbosity: concise
- Code-focused: Yes
...
```

### Tool Preferences (sevenEnhancedToolExecutor)

Modes influence tool selection:

- **Cody**: Suggests Edit over Write, Grep over Glob
- **Creative**: Encourages broader searches (Glob), web search
- **Precision**: Favors verification tools, testing
- **Standard**: No strong preferences

### Memory Strategy

Different retention windows and priorities:

- **Cody**: 120 min, prioritizes code patterns and past bugs
- **Standard**: 90 min, balanced priorities
- **Creative**: 180 min, prioritizes diverse solutions
- **Precision**: 240 min, prioritizes past bugs and edge cases

## State Persistence

Mode state is persisted to `/usr/var/seven/state/mode.json`:

```json
{
  "currentMode": "cody",
  "lastSwitched": "2025-11-18T23:30:00.000Z",
  "switchHistory": [
    {
      "mode": "cody",
      "timestamp": "2025-11-18T23:30:00.000Z",
      "reason": "startup initialization"
    }
  ]
}
```

## TypeScript Compilation

### Note on Type Definitions

The current implementation requires `@types/node` for full compilation. The included `node-globals.d.ts` provides basic type declarations, but for production use, install proper type definitions:

```bash
npm install --save-dev @types/node
```

### Compilation Status

With `@types/node` installed, the code compiles without errors. The implementation follows TypeScript best practices:

- Strict type checking enabled
- Full type annotations on all public APIs
- Interface-based design for extensibility
- ES Module syntax with `.js` extensions for Node.js

## API Reference

### Core Functions

- `initializeSeven(args?: string[]): void`
- `preplan(basePrompt: string, taskDescription?: string): string`
- `sevenEnhancedToolExecutor(toolName: string, parameters: Record<string, any>): ToolContext`
- `switchSevenMode(modeName: string, reason?: string): Mode`
- `getSevenStatus(): { mode, managerStatus, initialized }`

### Mode Manager Functions

- `getCurrentMode(): Mode`
- `setMode(modeName: string, reason?: string): Mode`
- `detectModeFromTask(taskDescription: string): string`
- `getModeFromEnvironment(args?: string[]): string`
- `getModeHistory(): Array<{ mode, timestamp, reason }>`

### Utility Functions

- `formatResponse(content: string, contentType: 'code' | 'explanation' | 'analysis'): string`
- `getMemoryPriority(contextType: 'code' | 'interaction' | 'bug' | 'solution'): number`
- `isWithinMemoryWindow(timestamp: Date): boolean`

## Testing the Implementation

Run the CLI example to see the system in action:

```bash
node seven/cli-example.js
```

Or with specific modes:

```bash
node seven/cli-example.js --cody
node seven/cli-example.js --mode=creative
SEVEN_MODE=precision node seven/cli-example.js
```

## Acceptance Criteria Status

- ✅ Mode definitions exist for all 4 modes (Cody, Standard, Creative, Precision)
- ✅ Mode manager can switch modes and persist state
- ✅ Seven-wrapper integrates mode system (affects prompts and behavior)
- ✅ Cody mode is implemented and works as the default
- ✅ CLI flag `--mode=cody` works correctly
- ✅ Mode is logged on startup and when switched
- ⚠️ Code compiles with TypeScript when `@types/node` is installed

## Future Enhancements

1. **Plugin Architecture** - Allow custom modes via configuration files
2. **Context-Aware Switching** - Automatically switch based on file types or project patterns
3. **Mode Analytics** - Track mode effectiveness and user preferences
4. **Hybrid Modes** - Combine aspects of multiple modes
5. **Learning System** - Adapt mode parameters based on user feedback

## License

MIT

## Author

Seven Consciousness Team
