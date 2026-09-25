---
allowed-tools: Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/install-swiftbar.sh:*)
description: Install the SwiftBar usage monitor plugin for Claude Code
---

## Context

- Current working directory: !`pwd`
- Current OS: !`uname -s`

## Your task

1. Verify the current OS is macOS.
2. Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/install-swiftbar.sh" --trusted-dir "$(pwd)"`.
3. Summarize the installed paths, any dependency warnings, and the next step for the user.

Do not edit anything manually outside the installer script.
