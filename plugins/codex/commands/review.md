---
description: Request Codex code review
argument-hint: [file or description]
allowed-tools: [
  "mcp__codex__codex_query",
  "mcp__codex__codex_status",
  "Read",
  "Glob",
  "Bash",
  "AskUserQuestion"
]
---

## Your task

Request a code review from OpenAI Codex.

### Step 1: Check Authentication

Call `codex_status` to verify authentication. If not authenticated, tell user to run `/codex:login` first.

### Step 2: Determine What to Review

**If file path provided:**

- Read that file directly with `Read` tool

**If description provided:**

- Use `Glob` to find relevant files based on description

**If no argument provided:**

1. Check for staged git changes with `Bash`: `git diff --cached --name-only`
2. Use **AskUserQuestion** to let user choose:

```json
{
  "questions": [{
    "question": "What would you like Codex to review?",
    "header": "Review",
    "options": [
      {"label": "Staged Changes", "description": "Review files staged for commit"},
      {"label": "Recent Changes", "description": "Review uncommitted changes (git diff)"},
      {"label": "Specific File", "description": "I'll specify a file path"},
      {"label": "Current File", "description": "Review the file I'm working on"}
    ],
    "multiSelect": false
  }]
}
```

**Handle selection:**

- "Staged Changes" → `git diff --cached`
- "Recent Changes" → `git diff`
- "Specific File" → Ask user for path (via "Other" option input)
- "Current File" → Use IDE context if available

### Step 3: Build and Execute Review

Call `codex_query` with code content and this system prompt:

```
You are an expert code reviewer. Analyze the provided code for:

1. **Bugs & Logic Errors** - Identify potential bugs, edge cases, and logic issues
2. **Security Vulnerabilities** - Check for common security issues (injection, XSS, etc.)
3. **Performance Issues** - Spot inefficiencies and performance bottlenecks
4. **Code Quality** - Evaluate readability, maintainability, and best practices
5. **Suggestions** - Provide actionable improvement suggestions

Format your review with clear sections and prioritize issues by severity (Critical/High/Medium/Low).
```

### Step 4: Present Review

Display findings in structured format:

```markdown
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
