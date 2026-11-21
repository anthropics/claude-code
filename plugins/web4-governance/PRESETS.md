# Policy Presets Reference

This document details exactly what each policy preset blocks, warns on, and allows.

## Overview

| Preset       | Default | Enforce | Use Case                                  |
| ------------ | ------- | ------- | ----------------------------------------- |
| `permissive` | allow   | false   | Pure observation, no blocking             |
| `safety`     | allow   | true    | Recommended for most users                |
| `strict`     | deny    | true    | High-security environments                |
| `audit-only` | allow   | false   | Testing rules before enabling enforcement |

---

## `permissive`

**Purpose**: Pure observation mode. Logs everything, blocks nothing.

| Action    | What       |
| --------- | ---------- |
| **Deny**  | Nothing    |
| **Warn**  | Nothing    |
| **Allow** | Everything |

**Rules**: None

**When to use**: Development, debugging, or when you want audit logs without any interference.

---

## `safety` (Recommended)

**Purpose**: Block dangerous operations while allowing normal development work.

### What Gets Denied

| Rule ID                     | Trigger                                    | Example Blocked                          |
| --------------------------- | ------------------------------------------ | ---------------------------------------- |
| `deny-destructive-commands` | `rm` with ANY flags, or `mkfs.*`           | `rm -rf ./build`, `rm -f file`, `mkfs.*` |
| `deny-secret-files`         | Reading files matching credential patterns | `.env`, `.aws/credentials`, `*.apikey`   |

**Why all `rm -` flags are blocked:**

- `rm -f` - bypasses confirmation prompts
- `rm -r` - recursive deletion
- `rm -i` - interactive mode (agent can't respond to prompts)
- Any flag combination is risky for autonomous agents

**Full list of blocked credential patterns:**

Environment & secrets:
- `**/.env`, `**/.env.*`
- `**/credentials.*`, `**/*secret*`
- `**/token*.json`, `**/auth*.json`, `**/*apikey*`

Cloud providers:
- `**/.aws/credentials`, `**/.aws/config`

SSH:
- `**/.ssh/id_*`, `**/.ssh/config`

Package managers:
- `**/.npmrc`, `**/.pypirc`

Databases:
- `**/.netrc`, `**/.pgpass`, `**/.my.cnf`

Containers & orchestration:
- `**/.docker/config.json`
- `**/.kube/config`

Encryption keys:
- `**/.gnupg/*`, `**/.gpg/*`

### What Gets Warned

| Rule ID             | Trigger                       | Example Flagged            |
| ------------------- | ----------------------------- | -------------------------- |
| `warn-file-delete`  | Plain `rm` (no flags)         | `rm file.txt`              |
| `warn-memory-write` | Writing to agent memory files | `MEMORY.md`, `memory/*.md` |
| `warn-network`      | Any network access            | `WebFetch`, `WebSearch`    |

**Memory file patterns warned:**

- `**/MEMORY.md`, `**/memory.md`
- `**/memory/**/*.md`
- `**/.web4/**/memory*`
- `**/.claude/**/memory*`

### What Gets Allowed

Everything else, including:

- Normal file reads (source code, configs without credentials)
- Normal file writes (code, docs)
- Safe Bash commands (`ls`, `git`, `npm`, etc.)
- Task delegation to sub-agents

---

## `strict`

**Purpose**: Maximum security. Denies everything by default, only allows read-only operations.

### What Gets Denied

| Action           | What                              |
| ---------------- | --------------------------------- |
| **Default deny** | Everything not explicitly allowed |

This means:

- All Bash commands (including safe ones like `ls`)
- All file writes (`Write`, `Edit`, `NotebookEdit`)
- All network access (`WebFetch`, `WebSearch`)
- All Task delegation

### What Gets Allowed

| Rule ID            | Tools Allowed                       |
| ------------------ | ----------------------------------- |
| `allow-read-tools` | `Read`, `Glob`, `Grep`, `TodoWrite` |

**When to use**: High-security environments, compliance scenarios, or when you need strict control over what the agent can do.

---

## `audit-only`

**Purpose**: Same rules as `safety`, but enforcement is disabled (dry-run mode).

### Behavior

- Uses the exact same rules as `safety`
- Logs what **would** be blocked/warned
- Does **not** actually block anything

| What safety would... | audit-only does... |
| -------------------- | ------------------ |
| Deny                 | Logs "would deny"  |
| Warn                 | Logs warning       |
| Allow                | Allows             |

**When to use**: Testing policy rules before enabling `safety`, or when you want to see what would be blocked without actually blocking.

---

## Choosing a Preset

```
┌─────────────────────────────────────────────────────────────┐
│  Do you need to block dangerous operations?                 │
│                                                             │
│  NO ──────────────────────────┬──────────────────────────── │
│  │                            │                             │
│  │  Want audit logs?          │                             │
│  │  YES → permissive          │                             │
│  │  NO  → (no plugin needed)  │                             │
│                               │                             │
│  YES ─────────────────────────┼──────────────────────────── │
│                               │                             │
│  │  Maximum security?         │                             │
│  │  YES → strict              │                             │
│  │                            │                             │
│  │  NO ───────────────────────┘                             │
│  │                                                          │
│  │  Ready for enforcement?                                  │
│  │  YES → safety (recommended)                              │
│  │  NO  → audit-only (test first)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Custom Rules

All presets can be extended with custom rules via `resolve_preset()`:

```python
from governance.presets import resolve_preset, PolicyRule, PolicyMatch

# Add a custom rule to the safety preset
config = resolve_preset(
    "safety",
    additional_rules=[
        PolicyRule(
            id="block-prod-writes",
            name="Block writes to production config",
            priority=1,
            decision="deny",
            reason="Production config is read-only",
            match=PolicyMatch(
                categories=["file_write"],
                target_patterns=["**/config/production.*"],
            ),
        ),
    ],
)
```

See [README.md](./README.md) for full API documentation.
