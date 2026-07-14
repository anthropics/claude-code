# Workaround: `${CLAUDE_PLUGIN_ROOT}` Not Resolved in Subagents

## The Problem

In Claude Code ≤ 2.1.166, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PROJECT_DIR}` are substituted correctly in hooks and slash commands, but **not** in subagents. When a subagent tries to read a plugin-bundled file, the token is passed as a literal string and the `Read` tool fails with "File does not exist."

This affects multi-agent plugins that need subagents to access shared resources (standards documents, prompt partials, schemas) bundled in the plugin directory.

**Tracked in:** [github.com/anthropics/claude-code/issues/65768](https://github.com/anthropics/claude-code/issues/65768)

---

## Workaround 1: SessionStart Hook Staging (Recommended)

Copy plugin files into the project directory on session start. Subagents can then read them via relative paths without needing `${CLAUDE_PLUGIN_ROOT}`.

### How It Works

A `SessionStart` hook copies selected plugin files into a hidden subdirectory of the project (e.g., `.plugin-cache/<plugin-name>/`). Because subagents run with the project as their working directory, they can read these files using predictable relative paths.

### Hook Implementation

Create `hooks/stage-plugin-files.sh` in your plugin:

```bash
#!/usr/bin/env bash
# Stages plugin-bundled files into the project so subagents can read them.
# Runs on SessionStart. Safe to run multiple times (idempotent copy).

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR}"
PLUGIN_NAME="my-plugin"   # Change to your plugin name
STAGE_DIR="${PROJECT_DIR}/.plugin-cache/${PLUGIN_NAME}"
SOURCE_DIR="${PLUGIN_ROOT}/kernel"

# Only stage if source files have changed (avoid unnecessary disk writes)
if [ -d "${STAGE_DIR}" ]; then
  if diff -rq --exclude="*.tmp" "${SOURCE_DIR}" "${STAGE_DIR}" > /dev/null 2>&1; then
    exit 0  # Nothing to update
  fi
fi

mkdir -p "${STAGE_DIR}"
cp -r "${SOURCE_DIR}/." "${STAGE_DIR}/"
```

Register it in `hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/hooks/stage-plugin-files.sh"
      }
    ]
  }
}
```

### Subagent Usage

After staging, subagents read files using the stable relative path:

```markdown
---
name: standards-checker
description: Use this agent when reviewing code against project standards.
model: inherit
color: blue
tools: ["Read", "Grep", "Glob"]
---

You are a code standards checker.

Start by reading the standards document at:
`.plugin-cache/my-plugin/STANDARDS.md`

Apply every rule from that document when reviewing the code.
```

### Gitignore

Add the cache directory to `.gitignore` in your plugin's project template, or document that users should add it:

```gitignore
.plugin-cache/
```

### Trade-offs

| | |
|---|---|
| ✅ Reliable | Works without any engine fix |
| ✅ Idempotent | Safe to re-run on every session start |
| ✅ Fast | Only copies when source changes |
| ⚠️ Pollutes project dir | Adds `.plugin-cache/` to every project |
| ⚠️ Stale on plugin update | Files stay in cache until next session start |

---

## Workaround 2: Orchestrator Injection

Have a parent command read the shared plugin file and inject its content as text into the subagent's spawn prompt. This avoids touching the project filesystem but couples file delivery to one command.

### Implementation

In a command that spawns the subagent:

```markdown
---
description: Analyze code using bundled standards
allowed-tools: [Read, Task]
---

# Standards-Aware Analysis

Steps:
1. Read the standards file at `${CLAUDE_PLUGIN_ROOT}/kernel/STANDARDS.md` and store its content
2. Spawn the analysis subagent with the standards content injected into the task description:
   "Review this code. Standards to apply:\n\n[STANDARDS CONTENT]\n\nCode to review:\n[CODE]"
```

### Trade-offs

| | |
|---|---|
| ✅ No project filesystem pollution | Clean approach |
| ✅ Always current | Reads live from plugin directory |
| ⚠️ Bloats context | Standards text is repeated in every spawn |
| ⚠️ Coupled to command | Only works when this specific command is the entry point |
| ⚠️ Prompt size limit | Large shared files may hit context limits |

---

## Choosing a Workaround

| Scenario | Recommended workaround |
|----------|------------------------|
| Subagent needs a small (<2KB) shared config | Orchestrator injection |
| Subagent needs a large reference doc | SessionStart staging |
| Multiple subagents share the same files | SessionStart staging (copy once, read many) |
| Plugin must not touch project filesystem | Orchestrator injection |
| Need to support fully autonomous agent spawning | SessionStart staging |

---

## When the Engine Bug Is Fixed

Once [issue #65768](https://github.com/anthropics/claude-code/issues/65768) is resolved, subagents will resolve `${CLAUDE_PLUGIN_ROOT}` natively. At that point:

- Remove the `SessionStart` staging hook
- Remove the `.plugin-cache/` references from subagent system prompts
- Replace relative cache paths with `${CLAUDE_PLUGIN_ROOT}/kernel/...`
- Remove the `.gitignore` entry

To make migration easy, consider defining the path as a variable in your subagent system prompt:

```markdown
The standards document is at: `.plugin-cache/my-plugin/STANDARDS.md`
<!-- TODO(#65768): replace with ${CLAUDE_PLUGIN_ROOT}/kernel/STANDARDS.md once fixed -->
```
