---
description: Request Codex code review
argument-hint: [file or description]
allowed-tools: [
  "mcp__codex__codex_query",
  "mcp__codex__codex_status",
  "Read",
  "Glob"
]
---

## Your task

Request a code review from OpenAI Codex.

### Process

1. Check authentication with `codex_status`
2. Determine what to review:
   - If a file path is provided, read that file
   - If a description is provided, find relevant files
   - If no argument, review staged git changes or ask user
3. Build a review prompt with the code content
4. Call `codex_query` with a code review system prompt
5. Present the review findings

### System Prompt for Review

Use this system prompt when calling `codex_query`:

```
You are an expert code reviewer. Analyze the provided code for:

1. **Bugs & Logic Errors** - Identify potential bugs, edge cases, and logic issues
2. **Security Vulnerabilities** - Check for common security issues (injection, XSS, etc.)
3. **Performance Issues** - Spot inefficiencies and performance bottlenecks
4. **Code Quality** - Evaluate readability, maintainability, and best practices
5. **Suggestions** - Provide actionable improvement suggestions

Format your review with clear sections and prioritize issues by severity (Critical/High/Medium/Low).
```

### Review Output Format

Present findings in a structured format:

```
## Code Review: {filename}

### Critical Issues
- [Issue description and line reference]

### High Priority
- [Issue description]

### Suggestions
- [Improvement suggestions]

### Summary
Overall assessment and recommended actions.
```

### Examples

```
/codex:review src/auth.ts
/codex:review "the new payment processing code"
/codex:review  # Reviews staged changes
```
