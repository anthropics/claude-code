# Remote Control Plugin

A Claude Code plugin that helps you set up and launch Remote Control sessions — bridging your local development environment to any browser or mobile device.

## Overview

Claude Code Remote Control lets you continue a local session running on your machine from any other device. Your machine stays in control, Claude runs locally, and all your tools, filesystem access, and project configuration remain available.

## Features

### Command: `/remote-control`

Checks availability and launches a Remote Control session.

**What it does:**
- Verifies Remote Control is enabled for your account
- Prompts for a session name (or uses the provided argument)
- Launches the session and displays the connection URL and QR code
- Guides you through connecting from a browser or mobile device

**Usage:**
```
/remote-control
/remote-control My Project
```

### Skill: `remote-control-guide`

Auto-invoked when you ask about Remote Control setup, requirements, or troubleshooting. Provides quick reference for:
- How Remote Control works
- Plan and version requirements
- All the ways to start a session
- Troubleshooting common errors
- Security model overview

## Requirements

| Requirement | Detail |
|-------------|--------|
| Plan | Claude Pro, Max, Team, or Enterprise |
| Version | Claude Code v2.1.51 or later |
| Auth | Claude.ai OAuth login (not API key) |
| Team/Enterprise | Admin must enable at claude.ai/admin-settings/claude-code |

## How Remote Control Works

1. Start a session with `claude remote-control` or `/remote-control`
2. Claude Code generates a session URL and QR code
3. Open the URL in any browser at claude.ai/code, or scan the QR code with the Claude mobile app
4. Continue your session from any device — messages sync across terminal, browser, and phone

Your machine makes only outbound HTTPS requests (no inbound ports), all traffic is TLS-encrypted, and your local environment never leaves your machine.

## Alternative Ways to Start Remote Control

You don't need this plugin to use Remote Control — it's built into Claude Code:

```bash
# Standalone remote session (no terminal)
claude remote-control
claude remote-control --name "My Project"

# Alongside interactive terminal session
claude --remote-control
claude --remote-control "My Project"

# From within an active session (VSCode and terminal)
/remote-control
/remote-control My Project
```

This plugin adds a guided setup experience with diagnostics when things aren't working.
