# Plugin MCP Session-ID Env-Bridge (Workaround Pattern)

> **Status as of 2026-05-27 (Claude Code v2.1.152):** Plugin stdio MCP servers do **not** receive `CLAUDE_CODE_SESSION_ID` in their spawn env. This document describes the workaround pattern that plugin authors can use today, and documents the upstream gap for future fix attribution.

Tracking issue: [anthropics/claude-code#61752](https://github.com/anthropics/claude-code/issues/61752).

## The problem

Plugin MCP stdio servers (declared via `mcpServers` in `.claude-plugin/plugin.json` or `.mcp.json`) receive these env vars at spawn time:

| Env var | Available? |
|---|---|
| `CLAUDE_PLUGIN_ROOT` | yes |
| `CLAUDE_PLUGIN_DATA` | yes |
| `CLAUDE_PROJECT_DIR` | yes |
| **`CLAUDE_CODE_SESSION_ID`** | **no** |

(The Bash tool DOES receive `CLAUDE_CODE_SESSION_ID` since v2.1.132 — `#25642`. Plugin MCP env is a different code path.)

Plugin MCP servers that manage per-session state (channel servers, sidecar routers, per-session caches) need a reliable session identifier. Workarounds explored that all eventually broke:

- **SessionStart hook writes a sidecar mapping** → race on concurrent spawns and resume.
- **PID-keyed handshake** → launcher/runtime fork makes hook-PID ≠ MCP-PID.
- **Sibling-by-PPID lookup** → PPID changes between hook invocations of the same session (empirically observed).

## The env-bridge pattern

When the plugin is spawned by a controlling agent (a GUI, CLI wrapper, or harness that the operator interacts with — NOT plain `claude` invoked at a terminal), the spawner controls the env block of `claude.exe`. Anything it sets gets inherited by `claude.exe` and then propagated to MCP plugin children (same route `CLAUDE_PLUGIN_DATA` takes).

So: the controlling agent generates the session uuid itself, then passes it BOTH as `--session-id <uuid>` to `claude.exe` AND as a plugin-specific env var on the spawn process env.

### Reference implementation

#### Spawner side (any language; example in Rust via `std::process::Command`)

```rust
use std::process::Command;
use uuid::Uuid;

let sid = Uuid::new_v4().to_string();
let mut cmd = Command::new("claude");
cmd.arg("--session-id").arg(&sid);
// Optionally: --remote-control, --name "<label>", etc.
cmd.arg("--dangerously-load-development-channels")  // or --channels once allowlisted
   .arg("plugin:my-plugin@my-marketplace");
cmd.env("MY_PLUGIN_INSTANCE_ID", &sid);  // ← the env-bridge
let _ = cmd.spawn()?;
```

The `--session-id` flag tells `claude.exe` to use this uuid for its session JSONL, registry entries, etc. The `MY_PLUGIN_INSTANCE_ID` env var travels through `claude.exe`'s child env into the plugin MCP server.

#### MCP server side (TypeScript / Bun)

```typescript
// Read the bridged session id at startup. Empty string for sessions
// launched outside the controlling agent (e.g. plain `claude` from a
// terminal) — those are excluded from sid-routed features.
const SESSION_ID = (process.env.MY_PLUGIN_INSTANCE_ID ?? '').trim()

if (SESSION_ID) {
  // Per-session state setup: write a sid-keyed sidecar, register the
  // session in an in-memory map, open a per-session SSE stream, etc.
} else {
  // Manual-launch fallback: skip sid-routed features, expose only
  // direction-less endpoints (e.g. health checks).
}
```

### Why this works

1. `claude.exe` does NOT strip arbitrary env vars from its parent — anything the spawner sets is visible to it.
2. `claude.exe` propagates its own env to MCP plugin children alongside the injected `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` / `CLAUDE_PROJECT_DIR`.
3. Empirically verified on v2.1.152 (Windows 11). See verification probe in [bd-cadence's repo](https://github.com/i2pacg/bd-cadence) — search for `BD_CADENCE_INSTANCE_ID`.

### Trade-offs

- **Works** for any session the controlling agent spawns.
- **Does NOT work** for sessions started by the user via a plain `claude` invocation, a `claude --resume <sid>` started outside the agent, or any other path the agent doesn't own.
- Plugin authors who need sid identity for ALL sessions still have no first-party solution and must live with degraded behavior on manually-launched sessions until upstream injects `CLAUDE_CODE_SESSION_ID`.

## What the first-party fix looks like

The plugin MCP spawn env-assembly code in `claude.exe` currently produces something equivalent to:

```typescript
const env = {
  CLAUDE_PLUGIN_ROOT: pluginPath,
  CLAUDE_PLUGIN_DATA: pluginDataDir,
  CLAUDE_PROJECT_DIR: projectDir,
  ...userEnv,
};
```

A one-line addition closes the gap:

```typescript
const env = {
  CLAUDE_PLUGIN_ROOT: pluginPath,
  CLAUDE_PLUGIN_DATA: pluginDataDir,
  CLAUDE_PROJECT_DIR: projectDir,
  CLAUDE_CODE_SESSION_ID: sessionHandle.id,  // ← from the same handle the Bash tool reads
  ...userEnv,
};
```

The session handle is already accessible at MCP spawn time — the same source the Bash tool uses for its env builder.

## Once shipped

Plugin authors should adopt the fallback pattern below so their plugin works with both the bridged and first-party paths:

```typescript
const SESSION_ID = (
  process.env.CLAUDE_CODE_SESSION_ID
  ?? process.env.MY_PLUGIN_INSTANCE_ID
  ?? ''
).trim()
```

This lets the env-bridge retire naturally: as soon as the first-party var is injected, the plugin uses it; the bridge env var is harmless if also set.

## Related

- Upstream issue: [#61752](https://github.com/anthropics/claude-code/issues/61752)
- Bash-tool session-id shipping: [#25642](https://github.com/anthropics/claude-code/pull/25642) (v2.1.132)
- The community docs PR documenting the gap: [#61754](https://github.com/anthropics/claude-code/pull/61754)
