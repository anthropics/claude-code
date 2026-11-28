# commit-guard

A Claude Code plugin that blocks `git add` and `git commit` of sensitive files before they enter version control.

## Problem

Claude Code's security-guidance plugin checks for code injection patterns during file edits, and hookify provides configurable edit-time warnings. But neither intercepts the **commit stage** — the last line of defense before secrets enter git history.

Once a `.env` file or private key is committed, removing it from git history requires `git filter-branch` or BFG Repo-Cleaner, and the secret must be rotated.

## What it catches

| Pattern | Examples |
|---------|----------|
| Environment files | `.env`, `.env.local`, `.env.production` |
| Credential files | `credentials.json`, `credentials.yml` |
| Service accounts | `service-account.json`, `service_account_key.json` |
| Private keys | `*.pem`, `*.key`, `*.p12`, `*.pfx` |
| SSH keys | `id_rsa`, `id_ed25519`, `id_ecdsa` |
| Auth tokens | `token.json`, `*.secret` |
| Keystores | `*.keystore`, `*.jks` |
| System files | `htpasswd`, `shadow` |

## How it works

`PreToolUse` hook on the `Bash` tool:

1. Detects `git add` or `git commit -a/--all` commands
2. For specific files: checks each filename against sensitive patterns
3. For broad adds (`git add .`, `git add -A`): scans the working tree for sensitive files
4. If found: blocks with exit 2 and suggests safer alternatives

## Installation

```bash
/plugin install commit-guard
# or
claude --plugin-dir /path/to/commit-guard
```

## Known limitations

- Only detects sensitive files by filename pattern, not by content
- `find` scans to maxdepth 3 to keep the hook fast
- Does not check files already in git history
