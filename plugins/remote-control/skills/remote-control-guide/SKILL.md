# Remote Control Guide Skill

Use this skill when the user asks about Claude Code Remote Control — how it works, how to set it up, troubleshooting connection issues, or understanding its security model.

## What is Remote Control?

Claude Code Remote Control lets you continue a local Claude Code session running on your machine from any other device — phone, tablet, or web browser. Your machine stays in control and Claude keeps running locally; nothing moves to the cloud.

**Key points:**
- Start with `claude remote-control` or `/remote-control` in an active session
- Connect via claude.ai/code in a browser, or the Claude iOS/Android app
- Your full local filesystem, MCP servers, and project config stay available
- Messages can be sent from terminal, browser, or phone interchangeably

## Requirements

| Requirement | Detail |
|-------------|--------|
| Plan | Pro, Max, Team, or Enterprise |
| Version | Claude Code v2.1.51+ (`claude --version`) |
| Auth | Claude.ai OAuth (not API key) |
| Team/Enterprise | Admin enables at claude.ai/admin-settings/claude-code |

## Starting Remote Control

**As a standalone session (no terminal interaction):**
```bash
claude remote-control
claude remote-control --name "My Project"
```

**Alongside an interactive terminal session:**
```bash
claude --remote-control
claude --remote-control "My Project"
```

**From within an active session:**
```
/remote-control
/remote-control My Project
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Remote Control is not yet enabled for your account" | Upgrade plan at claude.ai/upgrade, or ask your Team/Enterprise admin to enable it |
| "Not logged in" / auth errors | Run `claude auth login` to authenticate with Claude.ai OAuth |
| Session not visible in app | Wait a few seconds and refresh the sessions list |
| Disconnected after sleep | Reconnects automatically when your machine wakes up |

## Security Model

- Only outbound HTTPS requests — no inbound ports opened on your machine
- All traffic encrypted with TLS through Anthropic's API
- Multiple short-lived credentials, each scoped to specific purposes
- Same security model as normal Claude Code sessions
