---
description: Request Codex code review
argument-hint: [file or description]
allowed-tools: Bash, Read, Glob
---

## Your task

Request a code review from OpenAI Codex.

### Codex CLI Path
```
/Users/jiusi/Documents/codex/codex-cli/bin/codex.js
```

### Step 1: Determine What to Review

**If file path provided:**
- Read that file directly with `Read` tool

**If description provided:**
- Use `Glob` to find relevant files

**If no argument:**
- Check for staged git changes: `git diff --cached --name-only`
- Or recent changes: `git diff --name-only`

### Step 2: Check API Key

```bash
[ -n "$OPENAI_API_KEY" ] && echo "OK" || echo "Please set OPENAI_API_KEY"
```

### Step 3: Execute Review

Send the code to Codex for review:

```bash
node /Users/jiusi/Documents/codex/codex-cli/bin/codex.js --quiet "Review this code for bugs, security issues, and improvements:

<code>
{file_content}
</code>"
```

### Step 4: Present Review

Display Codex's code review to the user.

### Output Format

```
## Code Review: {filename}

{Codex review response}

---
Reviewed by: OpenAI Codex
```
