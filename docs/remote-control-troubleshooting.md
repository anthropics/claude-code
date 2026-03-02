# Remote Control Troubleshooting Guide

> **Last updated:** 2026-03-02  
> **Tracks issues:** #28817, #28816, #29037, #29185, #29449, #29638, #29980 and related

## Overview

This guide addresses the widespread `Remote Control environments are not available for your account` and `Remote Control is not yet available on your plan` errors reported by Claude Pro and Max plan users when running `claude remote-control`.

---

## Current Rollout Status

> **Important:** Remote Control is a **research preview feature** undergoing a **phased rollout**.

| Plan | Status |
|------|--------|
| **Max** | Generally available (rolling out to all Max users) |
| **Pro** | **Rollout in progress** — not yet available for all Pro accounts |
| **Team** | Not available |
| **Enterprise** | Not available |
| **API key** | Not supported |

The documentation at `code.claude.com/docs/en/remote-control` contains two statements that appear contradictory:

- _"Remote Control is available as a research preview on Max and Pro plans."_ (feature overview section)
- _"Subscription: requires a Max plan. Pro plan support is coming soon."_ (requirements section)

The **requirements section is the authoritative, current status**. Pro plan availability is actively being rolled out but is not yet available to all accounts. This documentation inconsistency is tracked in issue #28817 (assigned to the Anthropic docs team).

---

## Error Messages & What They Mean

### 1. `Remote Control environments are not available for your account.`
**Cause:** Your account has not yet been included in the Pro rollout, OR there is a session/config state issue.  
**Platform:** All platforms (Windows, macOS, Linux)

### 2. `Remote Control is not yet available on your plan.`  
**Cause:** Your plan (Pro or earlier) has not been enabled for Remote Control yet.  
**Platform:** All platforms

### 3. `Remote Control is not enabled for your account. Contact your administrator.`  
**Cause:** Account-level flag not set. Common on enterprise-adjacent accounts.  
**Platform:** All platforms

### 4. `Subscription: requires a Pro or Max plan. API keys are not supported.`  
**Cause:** You are authenticated via an API key instead of claude.ai account login.  
**Fix:** Log out and log back in using `/login` (claude.ai account, not API key)

---

## Troubleshooting Steps

Try these steps in order before concluding your account lacks access.

### Step 1 — Verify authentication method

Remote Control **only works with claude.ai account login**, not API keys.

```bash
claude auth status
```

If it shows `API key` authentication, switch to account-based auth:

```bash
claude auth logout
claude auth login
# Select the claude.ai account option (not API key)
```

### Step 2 — Check for conflicting environment variables

Ensure `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is not set:

**Linux/macOS:**
```bash
unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
claude remote-control
```

**Windows PowerShell:**
```powershell
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = $null
claude remote-control
```

Also check that `ANTHROPIC_API_KEY` is NOT set if you intend to use claude.ai account auth:
```bash
# Linux/macOS
unset ANTHROPIC_API_KEY

# Windows PowerShell
$env:ANTHROPIC_API_KEY = $null
```

### Step 3 — Reset local settings

Corrupted or overly customized `settings.json` can block Remote Control.

**Linux/macOS:**
```bash
cat ~/.claude/settings.json
# If it has complex settings, back it up and reset:
cp ~/.claude/settings.json ~/.claude/settings.json.backup
echo '{"env": {}}' > ~/.claude/settings.json
```

**Windows:**
```powershell
Copy-Item "$env:USERPROFILE\.claude\settings.json" "$env:USERPROFILE\.claude\settings.json.backup"
Set-Content "$env:USERPROFILE\.claude\settings.json" '{"env": {}}'
```

Then log out and back in:
```bash
claude auth logout
claude auth login
claude remote-control
```

### Step 4 — Update to the latest version

```bash
# macOS/Linux
curl -fsSL https://claude.ai/install.sh | bash

# Windows PowerShell
irm https://claude.ai/install.ps1 | iex

# Homebrew
brew upgrade --cask claude-code

# WinGet
winget upgrade Anthropic.ClaudeCode
```

> **Note:** If you previously installed via `npm install -g @anthropic-ai/claude-code`, uninstall it first:
> ```bash
> npm -g uninstall @anthropic-ai/claude-code
> ```
> Then reinstall using the native installer above. Running both the npm and native versions simultaneously causes conflicts.

### Step 5 — Check `claude doctor`

```bash
claude doctor
```

Look for warnings about multiple installations (especially leftover npm global installs at paths like `C:\Users\<user>\AppData\Roaming\npm\claude` on Windows). If found, uninstall the npm version:
```bash
npm -g uninstall @anthropic-ai/claude-code
```

### Step 6 — Re-authenticate fresh

Full clean re-authentication cycle:

```bash
claude auth logout
# Delete any cached tokens if needed:
# macOS/Linux: rm -rf ~/.claude/auth.json
# Windows: del %USERPROFILE%\.claude\auth.json
claude auth login
claude remote-control
```

---

## Platform-Specific Notes

### Windows

- Use `claude remote-control` in **PowerShell** (not Command Prompt) for best results.
- If using WSL, Remote Control may have limitations — test in native Windows PowerShell first.
- Check for leftover npm global installs with `claude doctor`.

### macOS

- VS Code integrated terminal and iTerm both work.
- Some users on macOS have reported success after upgrading to Max plan — if Pro rollout hasn't reached your account yet, this is the current fallback.

### Linux / WSL

- Ensure no proxy or firewall is blocking outbound connections to `claude.ai`.
- Try `unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` before running.

---

## If None of the Above Work

If you have tried all steps above and still get the error, your account most likely has **not yet been included in the Pro rollout**. This is a server-side eligibility check — no local fix can override it.

Options:
1. **Wait** — Anthropic is actively rolling out Remote Control to all Pro users.
2. **Upgrade to Max** — Remote Control is more broadly available on Max plans.
3. **Upvote** issue [#28817](https://github.com/anthropics/claude-code/issues/28817) to increase visibility with the team.
4. **Check the changelog** at [CHANGELOG.md](../CHANGELOG.md) for updates on Remote Control Pro availability.

---

## Related Issues

| Issue | Description | Status |
|-------|-------------|--------|
| [#28817](https://github.com/anthropics/claude-code/issues/28817) | Remote Control unavailable despite Pro plan (primary tracking issue) | Open, assigned |
| [#28816](https://github.com/anthropics/claude-code/issues/28816) | Same error on Max plan | Open |
| [#29037](https://github.com/anthropics/claude-code/issues/29037) | Remote Control not available despite active Pro plan | Open |
| [#29185](https://github.com/anthropics/claude-code/issues/29185) | Remote Control not available on Pro — requesting access | Open |
| [#29449](https://github.com/anthropics/claude-code/issues/29449) | CLI returns error immediately after answering `y` | Open |
| [#29638](https://github.com/anthropics/claude-code/issues/29638) | Feature request: Remote Control support for Pro | Open |
| [#29980](https://github.com/anthropics/claude-code/issues/29980) | Same error on Windows 11 Pro plan | Open |

---

_This document was contributed by the community to consolidate troubleshooting information while the official docs are updated. See [CONTRIBUTING](../CONTRIBUTING.md) if you have additional fixes to add._
