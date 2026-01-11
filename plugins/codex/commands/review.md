---
description: Request Codex code review
argument-hint: [file or description]
allowed-tools: Bash, Read, Glob, AskUserQuestion
---

## Your task

Request a code review from OpenAI Codex using the CLI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Check Authentication

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

If not authenticated, tell user to run `/codex:login` first.

### Step 2: Determine What to Review

**If file path provided:**

- Read that file directly with `Read` tool

**If description provided:**

- Use `Glob` to find relevant files based on description

**If no argument provided:**

1. Check for staged git changes: `git diff --cached --name-only`
2. Use **AskUserQuestion** to let user choose:

```json
{
  "questions": [{
    "question": "What would you like Codex to review?",
    "header": "Review",
    "options": [
      {"label": "Staged Changes", "description": "Review files staged for commit"},
      {"label": "Recent Changes", "description": "Review uncommitted changes (git diff)"},
      {"label": "Specific File", "description": "I'll specify a file path"}
    ],
    "multiSelect": false
  }]
}
```

**Handle selection:**

- "Staged Changes" → `git diff --cached`
- "Recent Changes" → `git diff`
- "Specific File" → Ask user for path

### Step 3: Build and Execute Review

Build a review prompt with the code content and system instruction:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" query "Review this code for bugs, security issues, performance problems, and code quality:\n\n{code_content}" --system "You are an expert code reviewer. Analyze for bugs, security issues, performance, and code quality. Prioritize by severity." --save-session
```

### Step 4: Present Review

Parse JSON response and display findings in structured format:

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
