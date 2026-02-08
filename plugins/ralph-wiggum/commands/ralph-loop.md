---
description: "Start Ralph Wiggum loop in current session"
argument-hint: "[PROMPT] [--max-iterations N] [--completion-promise TEXT]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-ralph-loop.sh:*)"]
---

# Ralph Loop Command

You are setting up a Ralph Wiggum loop - an iterative development loop where you work on a task repeatedly until completion.

## Step 1: Parse Provided Arguments

Check what's already provided in `$ARGUMENTS`:

- **PROMPT**: Any text that's not a flag (e.g., `Fix the auth bug`)
- **--max-iterations N**: Check if this flag is present with a value
- **--completion-promise TEXT**: Check if this flag is present with a value

Note which values are missing and need to be gathered.

## Step 2: Gather Missing Values

For each missing value, prompt the user:

### If PROMPT is missing:

Ask the user directly:

"What task should Ralph work on? Describe the task or provide a file path containing the task description."

### If --completion-promise is missing:

Use `AskUserQuestion`:

```
question: "What phrase signals task completion?"
header: "Promise"
options:
  - label: "STOP (Recommended)"
    description: "Output <promise>STOP</promise> when genuinely complete"
  - label: "No completion phrase"
    description: "Loop stops only when max iterations reached"
multiSelect: false
```

Map: `STOP` → `--completion-promise 'STOP'`, `No completion phrase` → omit flag, Other → use custom input

### If --max-iterations is missing:

Use `AskUserQuestion`:

```
question: "Maximum iterations before auto-stop?"
header: "Max Iters"
options:
  - label: "20 (Recommended)"
    description: "Good balance for most tasks"
  - label: "10"
    description: "Quick iterations, simpler tasks"
  - label: "50"
    description: "Complex features needing many iterations"
  - label: "Unlimited"
    description: "No limit - runs until promise (dangerous!)"
multiSelect: false
```

Map: `20` → `--max-iterations 20`, `Unlimited` → omit flag

## Step 3: Execute Setup Script

Build the command combining provided arguments with gathered values:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ralph-loop.sh" [PROMPT] [--completion-promise 'PROMISE'] [--max-iterations N]
```

Only include flags that have values (from arguments or user input).

## Step 4: Begin Work

After the script outputs the activation message, begin working on the task.

When you try to exit, the Ralph loop will feed the SAME PROMPT back to you for the next iteration. You'll see your previous work in files and git history, allowing you to iterate and improve.

**CRITICAL RULE:** If a completion promise is set, you may ONLY output it when the statement is completely and unequivocally TRUE. Do not output false promises to escape the loop, even if you think you're stuck or should exit for other reasons. The loop is designed to continue until genuine completion.
