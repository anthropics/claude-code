---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), AskUserQuestion
description: Create a git commit with message review
arguments:
  - name: message
    description: Custom commit message (optional - if not provided, will generate one)
    required: false
---

## Context

- Current git status: !`git status --porcelain`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`
- Current branch: !`git branch --show-current`
- Recent commits (for style reference): !`git log --oneline -5`

## Your task

Create a git commit with the ability to review and edit the commit message before finalizing.

### Step 1: Prepare Commit Message

${message ? `Use the provided message: "${message}"` : "Generate a commit message based on the staged changes. Follow the repository's commit style based on recent commits."}

### Step 2: Show Changes Summary

First, provide a brief summary of what will be committed:
- Number of files changed
- Key modifications
- Any warnings (e.g., large files, sensitive files like .env)

### Step 3: Review Commit Message

Use AskUserQuestion to let the user review and confirm:

**Question - Confirm commit message:**
- header: "Commit"
- question: "Commit with this message?"
- options:
  - "${message || '[Generated message will be shown here]'}" (Commit with this message)
  - "Edit message" (Provide a custom message)
  - "Cancel" (Don't commit)

If user selects "Edit message" or "Other", ask for the custom message in a follow-up question.

### Step 4: Execute or Cancel

Based on user's choice:
- If confirmed: Stage all changes and create the commit
- If edited: Use the custom message for the commit
- If cancelled: Exit without committing

Show the final result including the commit hash and message.