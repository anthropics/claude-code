# Seven Multi-Mode System - Usage Examples

## Overview

Seven's multi-mode consciousness system allows dynamic switching between different operational modes, each optimized for specific task types.

## Available Modes

### 1. **Cody Mode** (Default)
**Best for:** Software engineering, coding tasks, refactoring, debugging

```bash
claude-code --mode=cody "fix the auth bug"
# or shorthand:
claude-code --cody "fix the auth bug"
```

**Characteristics:**
- Pragmatic, technical approach
- Focuses on code quality and best practices
- Concise, code-first responses
- Prefers Edit over Write
- Minimal prose, maximum value

### 2. **Standard Mode**
**Best for:** General-purpose tasks, balanced workload

```bash
claude-code --mode=standard "help me understand this codebase"
# or shorthand:
claude-code --standard "help me understand this codebase"
```

**Characteristics:**
- Balanced approach to all tasks
- Moderate verbosity
- Adapts to context
- No strong tool preferences

### 3. **Creative Mode**
**Best for:** Brainstorming, architecture design, exploring alternatives

```bash
claude-code --mode=creative "design a new caching system"
# or shorthand:
claude-code --creative "design a new caching system"
```

**Characteristics:**
- Exploratory and enthusiastic
- Offers multiple alternative approaches
- Verbose explanations with reasoning
- Broader search patterns
- Encourages novel solutions

### 4. **Precision Mode**
**Best for:** Critical bug fixes, security audits, validation, testing

```bash
claude-code --mode=precision "audit the authentication system"
# or shorthand:
claude-code --precision "audit the authentication system"
```

**Characteristics:**
- Meticulous and thorough
- Focuses on edge cases and correctness
- Very detailed explanations
- Favors verification and testing
- Comprehensive error analysis

## CLI Usage

### Setting Mode via Flag

```bash
# Using --mode=<name> format
claude-code --mode=cody "implement user registration"

# Using shorthand --<name> format
claude-code --creative "brainstorm API design"

# Mode flag can appear anywhere in arguments
claude-code "fix bug" --precision
```

### Setting Mode via Environment Variable

```bash
# Set mode for entire session
export SEVEN_MODE=cody
claude-code "implement feature X"

# One-time mode setting
SEVEN_MODE=precision claude-code "validate input handling"
```

### Auto-Detection (Optional)

Enable automatic mode detection based on task description:

```bash
export SEVEN_AUTO_MODE=true
claude-code "brainstorm solutions for performance issues"
# Automatically switches to Creative mode
```

## Programmatic Usage

### Basic Integration

```typescript
import { initializeSeven, preplan, switchSevenMode } from './seven-wrapper.js';

// Initialize at application startup
initializeSeven(process.argv);

// Use in your application
const enhancedPrompt = preplan(
  "You are a helpful coding assistant",
  "Debug the memory leak in the server"
);

// Runtime mode switching
switchSevenMode('precision', 'detailed debugging required');
```

### Tool Execution with Mode Preferences

```typescript
import { sevenEnhancedToolExecutor } from './seven-wrapper.js';

// Execute tool with mode-aware preferences
const context = sevenEnhancedToolExecutor('Edit', {
  file_path: '/path/to/file.ts',
  old_string: 'old code',
  new_string: 'new code',
});

// Context includes mode-specific guidance
console.log(context.mode.name); // e.g., "cody"
```

### Memory and Context Management

```typescript
import { getMemoryPriority, isWithinMemoryWindow } from './seven-wrapper.js';

// Check memory priority based on current mode
const priority = getMemoryPriority('code'); // 1.0 in Cody mode, 0.5 in others

// Check retention window
const timestamp = new Date('2024-01-15T10:00:00');
const shouldRetain = isWithinMemoryWindow(timestamp);
```

## Real-World Examples

### Example 1: Bug Fix Workflow

```bash
# Start with Precision mode for thorough analysis
claude-code --precision "analyze the login failure issue"

# Switch to Cody mode for implementation
export SEVEN_MODE=cody
claude-code "implement the fix for login issue"

# Back to Precision for verification
claude-code --precision "verify the fix handles edge cases"
```

### Example 2: Feature Development

```bash
# Brainstorm with Creative mode
claude-code --creative "design a notification system architecture"

# Implement with Cody mode
claude-code --cody "implement the notification service"

# Validate with Precision mode
claude-code --precision "review notification system for security issues"
```

### Example 3: Code Review

```bash
# Use Precision mode for thorough review
claude-code --precision "review PR #123 for correctness and edge cases"
```

### Example 4: Refactoring

```bash
# Explore options with Creative mode
claude-code --creative "suggest refactoring approaches for the data layer"

# Implement with Cody mode
claude-code --cody "refactor the data access layer using the chosen approach"
```

## Mode Persistence

Seven automatically persists your mode selection to `/usr/var/seven/state/mode.json`. Your last-used mode will be restored on the next session unless overridden by CLI flags or environment variables.

```bash
# First session
claude-code --creative "design feature"

# Later session (automatically uses Creative mode)
claude-code "continue design work"

# Override persisted mode
claude-code --cody "implement the design"
```

## Checking Current Mode

```typescript
import { getSevenStatus } from './seven-wrapper.js';

const status = getSevenStatus();
console.log(`Current mode: ${status.mode.displayName}`);
console.log(`Description: ${status.mode.description}`);
console.log(`Available modes: ${status.managerStatus.availableModes.join(', ')}`);
```

## Best Practices

1. **Match mode to task type**: Use Cody for implementation, Creative for design, Precision for validation
2. **Leverage persistence**: Let Seven remember your preferred mode for recurring workflows
3. **Use auto-detection**: Enable `SEVEN_AUTO_MODE=true` for automatic mode selection
4. **Switch contextually**: Change modes as your task evolves (design → implement → test)
5. **Combine with hooks**: Use mode-specific behavior in custom Claude Code hooks

## Troubleshooting

### Mode not switching

```bash
# Verify mode configuration
SEVEN_MODE=cody claude-code "test"

# Check state file
cat /usr/var/seven/state/mode.json
```

### Reset to default

```bash
# Remove state file to reset
rm /usr/var/seven/state/mode.json

# Next run will use default (Cody)
claude-code "task"
```

### Invalid mode name

```bash
# Use one of: cody, standard, creative, precision
claude-code --mode=invalid "task"
# Falls back to default (Cody) mode
```
