---
allowed-tools: Bash(git diff:*), Bash(git log:*), Grep, Read, Edit, Write, Glob
description: Search for similar patterns after fixing a bug
---

## Context

- Recent changes (unstaged): !`git diff`
- Recent changes (staged): !`git diff --cached`
- Last commit: !`git log --oneline -1`

## Your task

You just fixed a bug. Now search the codebase for similar patterns that might have the same problem.

### Step 1: Identify the pattern

Look at the diff above. Identify:
- **What was the old (buggy) code?** Extract the pattern from the removed lines (lines starting with `-`)
- **What is the new (fixed) code?** Extract the pattern from the added lines (lines starting with `+`)
- **What makes this a bug?** Understand the root cause so you can find similar instances

If there's no diff (no recent changes), ask the user to describe the pattern they want to sweep for.

### Step 2: Search the codebase

Use Grep to search for the old (buggy) pattern across the codebase. Try multiple search strategies:

1. **Exact match**: Search for the literal buggy code
2. **Structural match**: Search for the general pattern (e.g., if the fix changed `==` to `===`, search for all `==` comparisons in similar contexts)
3. **Related files**: Check files of the same type in the same directories

Exclude the file you already fixed from the results.

### Step 3: Report findings

Present a numbered list of all matches found:

```
Found N similar patterns:

1. src/utils/validate.ts:42 - Same == comparison instead of ===
2. src/helpers/check.ts:18 - Same pattern in different function
3. tests/validate.test.ts:55 - Test file uses same buggy pattern
```

If no similar patterns are found, say so and stop.

### Step 4: Fix with confirmation

Ask the user: "Fix all N instances? Or select specific numbers to fix."

Then apply the same fix pattern to each confirmed instance using the Edit tool. After fixing, show a summary of all changes made.
