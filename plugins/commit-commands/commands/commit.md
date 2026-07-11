---
allowed-tools: Read, Bash(git add:*), Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), Bash(git commit:*)
description: Create a git commit
---

## Context

- Current git status: !`git status`
- Untracked files: !`git ls-files --others --exclude-standard`
- Staged file names: !`git diff --cached --name-only`
- Unstaged tracked file names: !`git diff --name-only`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Based on the above changes, create a single git commit, but only after completing
this safety gate:

1. Enumerate tracked, staged, and untracked candidates with `git status --short`,
   `git diff --name-only`, `git diff --cached --name-only`, and
   `git ls-files --others --exclude-standard`. Never infer the untracked set from
   `git diff`, because it does not include untracked files.
2. Before reading any file contents, classify paths with sensitive names as
   blocked. Never stage or commit `.env`, environment override files,
   credentials, secrets, private keys, certificates, authentication tokens, or
   similarly sensitive material. Treat names such as `credentials`, `secrets`,
   `id_rsa`, `id_ed25519`, `*.key`, `*.pem`, `*.p12`, and `*.pfx` as blocked.
   Do not read a blocked file's contents; report only its path. If a blocked file
   is already staged, stop without creating the commit and report it.
3. Inspect every remaining existing candidate individually with the `Read` tool.
   For each tracked path, inspect both its unstaged and staged individual diffs,
   as applicable, with `git diff -- <path>` and
   `git diff --cached -- <path>`. For a deletion, inspect the applicable
   individual diff. Do not use a directory, wildcard, or repository-wide
   pathspec as a substitute for per-file inspection. Block any file containing
   likely credentials or tokens, and any file that is unreadable, binary,
   unexpectedly generated, or otherwise not safety-confirmed.
4. Select only files that are relevant to the requested commit. Stage each
   selected file by its explicit path using `git add -- <path> [<path> ...]`.
   Never run `git add .`, `git add -A`, `git add --all`, or stage a directory or
   wildcard.
5. Re-check `git diff --cached --name-only`, `git diff --cached`, and
   `git status --short`. Commit only when every staged path has been inspected,
   is intentional, and is safety-confirmed. If no safe paths remain, stop without
   creating an empty commit.

Use only the allowed tools. Draft an appropriate message from the verified staged
diff, create one commit, and report the resulting status.
