---
allowed-tools: Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*), Bash(git push:*), Bash(git commit:*), Bash(gh pr create:*)
description: Commit, push, and open a PR
argument-hint: "[conventional]"
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Arguments: "$ARGUMENTS"

## Your task

Based on the above changes:

1. Create a new branch if on main.
   - **Default naming**: `<custom-prefix>/<generated-name>` as you would normally choose.
   - **Conventional Branch naming**: if the arguments contain `conventional`, name the branch following the Conventional Branch 1.0.0 spec (https://conventionalbranch.org/):
     - Format: `<type>/<description>`
     - Pick `<type>` from the diff: `feature` (new capability), `bugfix` (fix), `hotfix` (urgent prod fix), `release` (release prep), `chore` (tooling/deps/maintenance), `docs` (docs-only), `test` (tests-only).
     - `<description>` rules: lowercase, hyphen-separated, alphanumeric + hyphens only, no consecutive hyphens, no trailing hyphens, short and descriptive.
2. Create a single commit with an appropriate message
3. Push the branch to origin
4. Create a pull request using `gh pr create`
5. You have the capability to call multiple tools in a single response. You MUST do all of the above in a single message. Do not use any other tools or do anything else. Do not send any other text or messages besides these tool calls.
