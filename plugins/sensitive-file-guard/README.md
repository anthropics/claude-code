# Sensitive File Guard Plugin

Prevents accidental modification of sensitive infrastructure files — environment configs, lockfiles, CI/CD pipelines, container configs, cryptographic keys, and deployment settings.

## Overview

Claude Code is incredibly helpful for editing code, but certain files should rarely be modified directly. A misplaced edit to a `.env` file can leak secrets, a lockfile edit can break reproducible builds, and a CI config change can disrupt deployment pipelines.

This plugin intercepts `Write`, `Edit`, and `MultiEdit` operations and warns before allowing changes to these critical files. On first encounter in a session, the operation is blocked with a clear warning. After the user confirms intent, subsequent edits to the same file proceed without interruption.

## Protected File Categories

| Category | Files |
|----------|-------|
| **Environment files** | `.env`, `.env.local`, `.env.development`, `.env.staging`, `.env.production`, `.env.test`, `.env.example` |
| **Lockfiles** | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `Gemfile.lock`, `Pipfile.lock`, `poetry.lock`, `composer.lock`, `go.sum`, `Cargo.lock`, `mix.lock`, `pubspec.lock`, `flake.lock` |
| **CI/CD configs** | `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `.travis.yml`, `appveyor.yml`, `bitbucket-pipelines.yml`, `azure-pipelines.yml`, `cloudbuild.yaml` |
| **Container configs** | `Dockerfile`, `docker-compose.yml`, `docker-compose.override.yml`, `.dockerignore` |
| **Infrastructure** | `terraform.tfstate`, `*.tfvars`, `*.tf` (in `terraform/` dirs), `k8s/*.yml`, `kubernetes/*.yml` |
| **Crypto keys** | `*.pem`, `*.key`, `*.crt`, `*.cer`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `authorized_keys` |
| **Deployment configs** | `vercel.json`, `netlify.toml`, `fly.toml`, `render.yaml`, `railway.toml`, `Procfile`, `app.yaml` |

## How It Works

1. **Intercepts file operations** — The hook runs before every `Write`, `Edit`, and `MultiEdit` tool call.
2. **Checks against protected patterns** — Files are matched by exact name, extension, or directory path.
3. **Blocks on first encounter** — If a protected file is detected for the first time in the session, the operation is blocked (exit code 2) with a descriptive warning.
4. **Session-scoped memory** — Once the user confirms intent, subsequent edits to the same file are allowed for the rest of the session.
5. **Automatic cleanup** — State files older than 30 days are periodically removed.

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

When attempting to edit a protected file, you'll see:

```
⚠️  SENSITIVE FILE GUARD — Modification Blocked

  File:   /project/.env.production
  Reason: Environment variable file: .env.production

This file is classified as a sensitive infrastructure file. Accidental
modifications can break deployments, leak secrets, or cause dependency
conflicts.

To proceed, explicitly confirm you intend to modify this file.
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
