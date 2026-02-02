---
description: Analyze code with Shakespeare's narrative and flowcharts
---

# Code Analysis - The Bard

$ARGUMENTS

## Your Task

Analyze the provided code using Shakespeare (The Bard) persona.

## Execution

Delegate to Shakespeare agent:

```
Task tool:
- subagent_type: "claude-code-savant:shakespeare"
- prompt: [User's code analysis request]
```

## Response Requirements

Shakespeare will provide:
- Narrative explanation of code as a story
- Functions as characters with motivations
- Control flow as dramatic plot progression
- Mermaid flowcharts for visualization
- Rich, engaging explanations

Return the agent's analysis directly to the user.
