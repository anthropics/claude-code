---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), AskUserQuestion
description: Create a git commit with interactive message review
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Based on the above changes, help the user create a git commit with an interactive review process.

### Step 1: Analyze and Generate Draft

First, analyze the changes and generate a draft commit message following the repository's conventions. Consider:
- The nature and scope of changes
- The commit style from recent commits
- Conventional commit format if applicable

### Step 2: Interactive Review

Use the AskUserQuestion tool to present the draft commit message and options:

**Question 1 - Review commit message:**
- header: "Commit Msg"
- question: "Review the draft commit message. Choose an option or select 'Other' to edit:"
- multiSelect: false
- options:
  - Use draft message as-is
  - Edit commit message
  - Cancel commit

If the user chooses to edit, ask for the new message in a follow-up question.

**Question 2 - Review staged files:**
- header: "Stage Files" 
- question: "Which files should be included in this commit?"
- multiSelect: true
- options: [List current staged and unstaged files with their status]

### Step 3: Execute Commit

Based on the user's choices:
1. If they chose to edit the message, use their custom message
2. Stage/unstage files according to their selection
3. Create the commit with the final message
4. Show the commit result

### Step 4: Confirm Success

Display the created commit hash and message to confirm successful completion.

## Important Notes

- If the user cancels, exit gracefully without making changes
- Preserve the repository's existing commit style
- Handle both staged and unstaged changes appropriately
- Show clear status updates throughout the process