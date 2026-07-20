# Sensitive File Guard Plugin

Prevents accidental modification of sensitive infrastructure files — environment configs, lockfiles, CI/CD pipelines, container configs, cryptographic keys, and deployment settings.

## Overview

Claude Code is incredibly helpful for editing code, but certain files should rarely be modified directly. A misplaced edit to a `.env` file can leak secrets, a lockfile edit can break reproducible builds, and a CI config change can disrupt deployment pipelines.

This plugin intercepts `Write`, `Edit`, and `MultiEdit` operations and applies a risk-based decision:

- High-risk files are hard-blocked with a structured `deny` decision
- Medium-risk files trigger a structured `ask` confirmation prompt
- Medium-risk files are added to a session allowlist only after the exact asked tool call succeeds, so later edits to that same file can proceed without another prompt

## Protected File Categories

| Category | Risk | Files |
|----------|-------|
| **Environment files** | `deny` for real `.env*`, `ask` for `.env.example` | `.env`, `.env.local`, `.env.development`, `.env.staging`, `.env.production`, `.env.test`, `.env.example` |
| **Lockfiles** | `ask` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `Gemfile.lock`, `Pipfile.lock`, `poetry.lock`, `composer.lock`, `go.sum`, `Cargo.lock`, `mix.lock`, `pubspec.lock`, `flake.lock` |
| **CI/CD configs** | `ask` | `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `.travis.yml`, `appveyor.yml`, `bitbucket-pipelines.yml`, `azure-pipelines.yml`, `cloudbuild.yaml` |
| **Container configs** | `ask` | `Dockerfile`, `docker-compose.yml`, `docker-compose.override.yml`, `.dockerignore` |
| **Infrastructure** | `deny` for `terraform.tfstate*`, `ask` for `*.tfvars`, `*.tf` in `terraform/`, `k8s/*.yml`, `kubernetes/*.yml` | `terraform.tfstate`, `*.tfvars`, `*.tf` (in `terraform/` dirs), `k8s/*.yml`, `kubernetes/*.yml` |
| **Crypto keys** | `deny` for private key material, `ask` for public certs / public keys | `*.pem`, `*.key`, `*.crt`, `*.cer`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `authorized_keys` |
| **Deployment configs** | `ask` | `vercel.json`, `netlify.toml`, `fly.toml`, `render.yaml`, `railway.toml`, `Procfile`, `app.yaml` |

## How It Works

1. **Intercepts file operations** — `PreToolUse` evaluates every `Write`, `Edit`, and `MultiEdit` call.
2. **Checks against protected patterns** — Files are matched by exact name, extension, or directory path.
3. **Returns structured hook decisions** — High-risk files return `deny`; medium-risk files return `ask`.
4. **Tracks asked tool calls** — `PreToolUse` marks medium-risk edits as pending confirmation using the current tool call ID.
5. **Confirms before allowlisting** — `PostToolUse` only allowlists a file when that exact pending tool call succeeds.
6. **Cleans up failed edits** — `PostToolUseFailure` clears pending confirmation state so failed runs never become trusted.
7. **Session-scoped memory** — Once a medium-risk file is truly confirmed, later edits to the same file are auto-allowed for the rest of the session.
8. **Automatic cleanup** — State files older than 30 days are periodically removed.

## Configuration

### Disabling the Guard

Set the environment variable to disable protection:

```bash
SENSITIVE_FILE_GUARD_ENABLED=0
```

### Debug Logging

Debug logs are written to:

```
/tmp/sensitive-file-guard-log.txt
```

## Installation

This plugin is included in the Claude Code repository. To use it in your project:

1. Install Claude Code
2. Use the `/plugin` command to install, or configure in `.claude/settings.json`:

```json
{
  "plugins": ["sensitive-file-guard"]
}
```

## Example Warning

When attempting to edit a medium-risk protected file, you'll get a confirmation prompt with a reason like:

```
Sensitive File Guard requires confirmation before editing
Container configuration: Dockerfile.
If you approve and the edit runs, this file will be auto-allowed
for the rest of the session.
```

## Relationship to Other Plugins

| Plugin | Focus |
|--------|-------|
| **security-guidance** | Warns about security *patterns in code* (eval, innerHTML, command injection) |
| **data-protection** | Protects *ML training data* (checkpoints, model weights, training results) |
| **sensitive-file-guard** | Protects *infrastructure files* (env configs, lockfiles, CI pipelines, keys) |

## Author

teee32 (3318867918@qq.com)

## Version

1.0.0
