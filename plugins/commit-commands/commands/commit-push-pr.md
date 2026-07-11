---
allowed-tools: Read, Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr create:*)
description: Commit, push, and open a PR
---

## Context

- Current git status: !`git status`
- Untracked files: !`git ls-files --others --exclude-standard`
- Staged file names: !`git diff --cached --name-only`
- Unstaged tracked file names: !`git diff --name-only`
- Current branch: !`git branch --show-current`

## Your task

Based on the above changes:

1. Before creating a branch or commit, enumerate tracked, staged, and untracked
   candidates with `git status --short`, `git diff --name-only`,
   `git diff --cached --name-only`, and
   `git ls-files --others --exclude-standard`.
2. Before reading any file contents, classify paths with sensitive names as
   blocked. Never stage, commit, or push `.env`, environment override files,
   credentials, secrets, private keys, certificates, authentication tokens, or
   similarly sensitive material. Treat names such as `credentials`, `secrets`,
   `id_rsa`, `id_ed25519`, `*.key`, `*.pem`, `*.p12`, and `*.pfx` as blocked.
   Do not read a blocked file's contents; report only its path. If a blocked file
   is already staged, stop before creating a branch, commit, push, or pull
   request and report it.
3. Inspect every remaining existing candidate individually with the `Read` tool.
   For each tracked path, inspect both its unstaged and staged individual diffs,
   as applicable, with `git diff -- <path>` and
   `git diff --cached -- <path>`. For a deletion, inspect the applicable
   individual diff. Never use a directory, wildcard, or repository-wide
   pathspec as a substitute for per-file inspection. A file containing likely
   credentials or tokens, or one that is unreadable, binary, unexpectedly
   generated, or otherwise not safety-confirmed, is blocked.
4. Create a new branch if on `main` only after the safety gate passes.
5. Stage only relevant, safety-confirmed files by explicit file path using
   `git add -- <path> [<path> ...]`. Never run `git add .`, `git add -A`,
   `git add --all`, or stage a directory or wildcard.
6. Re-check `git diff --cached --name-only`, `git diff --cached`, and
   `git status --short`. Create one commit only when every staged file is
   intentional and inspected; stop if no safe paths remain.
7. Push that branch to `origin` and create a pull request using `gh pr create`.
   Build the pull-request summary and test plan only from the verified commit.

Use only the allowed tools. Do not push or open a pull request when any safety
check or preceding git operation fails.
