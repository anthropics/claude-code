# Remote Control Troubleshooting Guide

> **Last updated:** 2026-03-02
> **Tracks issues:** #28817, #28816, #29037, #29185, #29449, #29638, #29980 and related

## Overview

This guide addresses the widespread `Remote Control environments are not available for your account` and `Remote Control is not yet available on your plan` errors reported by Claude Code users when running `claude remote-control`.

---

## Current Plan Eligibility (IMPORTANT)

> **As of March 2026, Remote Control is available for Max plan only.**
> Pro plan support is listed as "coming soon" in the official docs.
> API keys are not supported.

Source: https://code.claude.com/docs/en/remote-control

| Plan | Remote Control Status |
|------|----------------------|
| Max ($100-$200/mo) | Available (research preview) |
| Pro ($20/mo) | Coming soon — NOT yet available |
| Team / Enterprise | Not available |
| API Key | Not supported |

**If you are on Pro plan:** The error `Remote Control environments are not available for your account` is expected and is a server-side restriction, not a local configuration issue. No local fix will resolve this. See workarounds below.

---

## Error Messages Explained

### 1. `Remote Control environments are not available for your account.`
- **Meaning:** Your account tier does not have the Remote Control feature flag enabled server-side.
- **Who sees this:** Pro plan users (feature not yet rolled out), and occasionally Max users during rollout.
- **Fix:** If on Pro plan — wait for rollout or upgrade to Max. If on Max — see troubleshooting steps below.

### 2. `Remote Control is not yet available on your plan`
- **Meaning:** Same as above — the backend eligibility check returned ineligible.
- **Fix:** Same as above.

### 3. `Remote Control Failed.`
- **Meaning:** The remote environment was provisioned but failed to connect (network/firewall issue).
- **Fix:** Check firewall settings; ensure outbound connections to `*.claude.ai` on port 443 are allowed.

### 4. `Error: Remote Control is not enabled for your account. Contact your administrator.`
- **Meaning:** Team/Enterprise account where the admin has not enabled the feature.
- **Fix:** Contact your workspace admin or Claude Code administrator.

---

## Known UX Bugs (for Anthropic team)

These are confirmed UX bugs that need fixing regardless of plan rollout:

### Bug 1: Prompt shown before eligibility check
The CLI shows `Enable Remote Control? (y/n)` to **all users including ineligible ones** before checking whether their account supports the feature. The eligibility check only happens after the user answers `y`. This is a misleading UX.

**Expected behavior:** Check eligibility first. If ineligible, skip the prompt and show:
```
Remote Control requires a Max plan subscription.
Pro plan support is coming soon.
Visit https://claude.ai/upgrade for plan details.
```

### Bug 2: Failed state cached as preference
After the first failed attempt, the CLI caches the state and skips the prompt on subsequent runs — but still attempts to provision and fails. The cached failed state should not persist; users should be re-prompted after an account upgrade.

### Bug 3: Error message is vague
The current error message does not tell users:
- Whether this is a plan tier restriction or a temporary outage
- What plan they need
- When Pro support is coming
- Where to get more information

---

## Troubleshooting Steps (Max Plan Users)

If you are on Max plan and still seeing the error:

### Step 1: Verify authentication method
```bash
claude auth status
```
Ensure output shows `claude.ai` account authentication, **not** API key. Remote Control does not work with API keys.

### Step 2: Check for conflicting environment variables
```bash
unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
unset DISABLE_TELEMETRY
```
Then retry `claude remote-control`.

### Step 3: Update to the latest version
```bash
npm update -g @anthropic-ai/claude-code
claude --version
```

### Step 4: Reset settings
```bash
echo '{"env": {}}' > ~/.claude/settings.json
```

### Step 5: Re-authenticate
```bash
claude /logout
claude /login
```
Make sure you sign in via claude.ai, not console.anthropic.com.

### Step 6: Run diagnostics
```bash
claude doctor
```
This checks for conflicting global npm installations and auth issues.

### Step 7: Node.js version (Windows users)
Ensure Node.js is up to date (v18+ required). Outdated Node.js causes provisioning failures:
```bash
node --version  # should be v18 or higher
npm install -g n && n latest  # update Node
```

---

## Alternatives to Remote Control (While Waiting for Pro Rollout)

### Option 1: SSH + tmux (recommended for developers)
```bash
# On your development machine:
tmux new -s claude-session
claude
# Detach: Ctrl+B then D

# From any device via SSH:
ssh user@your-machine
tmux attach -t claude-session
```

### Option 2: VS Code Remote SSH
Use VS Code's built-in Remote SSH extension to connect to your dev machine from any device. Full IDE + Claude Code extension works seamlessly.

### Option 3: Tailscale + SSH
For machines behind NAT/firewall, use Tailscale for secure remote access:
```bash
# Install Tailscale, then SSH from anywhere:
ssh user@your-tailscale-hostname
tmux attach -t claude-session
```

---

## Platform-Specific Notes

### macOS
- Ghostty and iTerm2 users: ensure your terminal is not blocking outbound WebSocket connections
- Check System Preferences > Security & Privacy for any firewall rules blocking `claude`

### Windows / WSL
- Must use WSL2 (not WSL1)
- Run `claude remote-control` from within WSL, not PowerShell or CMD
- Ensure WSL2 network adapter has internet access: `curl https://api.anthropic.com`

### Linux
- No special requirements beyond Node.js v18+ and outbound HTTPS access

---

## Related Issues

| Issue | Description |
|-------|-------------|
| #28817 | Remote Control unavailable despite Pro plan authentication |
| #28816 | Remote Control not working on Pro plan |
| #29185 | Remote Control not available on Pro plan — requesting access |
| #29430 | Remote Control regression - "not yet available on your plan" on Claude Max |
| #29449 | "Remote Control environments are not available for your account." for Claude Code Pro Plan user |
| #29980 | Remote Control feature unavailable on Pro plan despite account eligibility |

---

## Summary

- **Pro plan users:** Remote Control is not yet available. This is a server-side rollout restriction. No local fix exists. Use SSH + tmux as an alternative.
- **Max plan users:** Follow the 7-step troubleshooting checklist above. Most issues are auth method or environment variable conflicts.
- **Team/Enterprise users:** Feature is not available at any tier currently.
