# push-guardrails

Guardrails to prevent accidental exposure of private code to public repositories.

## Problem

Claude Code can unintentionally push proprietary or private files to public repositories. In a [real-world incident](https://github.com/anthropics/claude-code/issues/29225), a user's proprietary trading algorithms were exposed on a public GitHub PR because Claude pushed code without checking repository visibility.

This plugin adds pre-push and pre-commit safety checks to catch these situations before they happen.

## What it does

### 1. Pre-push visibility check

Before `git push` or `gh pr create`, the plugin checks repository visibility via the GitHub API. If the repository is **public**, it:

- Warns that the repo is public and code will be visible to everyone
- Lists the files that will be pushed
- Flags any sensitive files in the push
- Blocks the command until acknowledged

### 2. Fork visibility warning

If the repository is a **fork of a public repo**, the plugin warns that forks of public repos are always public on GitHub. This is a common blind spot — users may think their fork is private.

### 3. Sensitive file detection

Before `git commit` or broad `git add` (e.g., `git add .`, `git add -A`), the plugin checks for sensitive file patterns:

**Credentials & keys:**
`.env`, `.pem`, `.key`, `.p12`, `.pfx`, `.jks`, `id_rsa`, `id_ed25519`, `id_ecdsa`, `.keystore`, `credentials.*`, `secrets.*`

**API & auth tokens:**
`api_key`, `token.*`, `auth_token`, `.npmrc`, `.pypirc`, `.netrc`, `.htpasswd`

**Cloud provider configs:**
`.aws/`, `gcloud*.json`, `kubeconfig`, `terraform.tfvars`

**Application configs:**
`database.yml`, `wp-config.php`

## Installation

Install via Claude Code:

```
/install-plugin plugins/push-guardrails
```

## Commands intercepted

| Command | Check performed |
|:---|:---|
| `git push` (all variants) | Repository visibility + sensitive file scan |
| `gh pr create` | Repository visibility + sensitive file scan |
| `git commit` | Sensitive file scan on staged files |
| `git add .` / `git add -A` | Sensitive file scan on files to be staged |

## Behavior

- **First warning per session**: Blocks the command (exit code 2) and shows a detailed warning
- **Subsequent runs for same repo**: Allows silently (session-based dedup)
- **Private repos**: No action, immediate pass-through
- **`gh` CLI not available**: Warns but does not block

## Configuration

### Disable the plugin

Set the environment variable:

```bash
export PUSH_GUARDRAILS_DISABLED=1
```

### Debug logging

Debug logs are written to `/tmp/push-guardrails-log.txt`.

## Requirements

- Python 3.6+
- `gh` CLI (for repository visibility checks) — optional but recommended
- `git` CLI
