---
description: "Report a bug in Claude Code — drafts and files a GitHub issue without leaving the terminal"
argument-hint: "Optional: one-line description of the bug"
allowed-tools: ["Bash", "AskUserQuestion"]
---

# Report a Bug in Claude Code

Your goal is to help the user file a well-structured bug report on the `anthropics/claude-code` GitHub repository. Follow these steps exactly.

## Step 1 — Gather context automatically

Run these commands silently to collect environment info:

```bash
claude --version 2>/dev/null || echo "unknown"
uname -s 2>/dev/null || echo "unknown"
uname -r 2>/dev/null || echo "unknown"
```

## Step 2 — Get the bug description

If `$ARGUMENTS` is non-empty, use it as the starting description and skip directly to step 3.

Otherwise, use AskUserQuestion to ask:

**Question 1:** "What's the bug?"
- Header: "Bug type"
- Options:
  - "Crash / error message" — Claude Code crashed or showed an error
  - "Wrong behavior" — Claude Code did something unexpected
  - "UI / display issue" — visual glitch, layout problem
  - "Performance" — slow, freezing, high memory usage

**Question 2:** "Describe what happened" (free text via Other option)
- Header: "Description"
- Options: one placeholder option so the user uses "Other" to type freely

## Step 3 — Ask for reproduction steps

Use AskUserQuestion:

**Question:** "Can you reproduce it reliably?"
- Header: "Reproducible?"
- Options:
  - "Yes, always" — happens every time
  - "Sometimes" — intermittent
  - "Only happened once" — one-off

Then ask the user to describe the steps to reproduce (use "Other" for free text).

## Step 4 — Draft the issue

Build the GitHub issue using this exact template:

```
**Describe the bug**
[User's description]

**Steps to reproduce**
[User's steps, or "Not provided" if they skipped]

**Expected behavior**
[What should have happened]

**Actual behavior**
[What actually happened]

**Environment**
- Claude Code version: [from step 1]
- OS: [from step 1]

**Additional context**
[Anything else relevant, or remove this section]
```

Show the full draft to the user in a code block.

## Step 5 — Confirm before filing

Use AskUserQuestion:

**Question:** "File this issue on GitHub?"
- Header: "Confirm"
- Options:
  - "Yes, file it" — proceed
  - "Edit first" — ask what to change, update the draft, repeat step 5
  - "Cancel" — abort with message "Issue not filed."

## Step 6 — File the issue

Extract a short, clear title (max 72 chars) from the description.

Run:
```bash
gh issue create \
  --repo anthropics/claude-code \
  --title "[BUG] <title>" \
  --label "bug" \
  --body "<escaped body>"
```

If `gh` is not authenticated, tell the user:
> Run `gh auth login` first, then try `/bug` again.

## Step 7 — Confirm success

Show the issue URL and say:
> "Issue filed. Thank you for the report — the Claude Code team will take a look."
