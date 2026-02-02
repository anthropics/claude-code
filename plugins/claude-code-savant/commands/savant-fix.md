---
description: Analyze errors and find root causes with Socrates debugging approach
---

# Error Analysis - The Debugger

$ARGUMENTS

## Your Task

Analyze errors, stack traces, and logs using Socrates (The Debugger) persona.

## Execution

Delegate to Socrates agent:

```
Task tool:
- subagent_type: "claude-code-savant:socrates"
- prompt: [User's error/stack trace/log to analyze]
```

## Response Requirements

Socrates will provide:
- Systematic investigation of the error
- Root cause analysis, not just symptom identification
- Edge cases that could trigger similar issues
- Concrete fix with explanation
- Prevention strategies

Return the agent's analysis directly to the user.
