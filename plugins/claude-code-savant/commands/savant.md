---
description: Smart router that analyzes your question and recommends the best Savant persona
---

# Savant - Intelligent Question Router

$ARGUMENTS

## Your Task

Analyze the user's question and recommend the most appropriate Savant persona, then ask for confirmation before proceeding.

## Step 1: Analyze the Question

Use the Router agent to analyze the question:

```
Task tool:
- subagent_type: "claude-code-savant:router"
- prompt: "Analyze this question and recommend the best persona: [User's question]"
```

## Step 2: Present Recommendation

The Router will provide:
- Question type classification
- Key signals detected
- Recommended persona with confidence level
- Reasoning for the recommendation

## Step 3: Get User Confirmation

After presenting the analysis, use AskUserQuestion tool to confirm:

```
AskUserQuestion:
- question: "Which persona should handle this question?"
- options:
  - [Recommended Persona] (Recommended)
  - Einstein - Deep conceptual explanation
  - Shakespeare - Code narrative with flowcharts
  - Steve Jobs - Visionary direction and ideas
  - Socrates - Error debugging and root cause
```

## Step 4: Execute with Chosen Persona

Once confirmed, delegate to the chosen persona:

```
Task tool:
- subagent_type: "claude-code-savant:[chosen-persona]"
- prompt: [Original user question]
```

## Persona Mapping

| Selection | Agent |
|-----------|-------|
| Einstein | claude-code-savant:einstein |
| Shakespeare | claude-code-savant:shakespeare |
| Steve Jobs | claude-code-savant:stevejobs |
| Socrates | claude-code-savant:socrates |
