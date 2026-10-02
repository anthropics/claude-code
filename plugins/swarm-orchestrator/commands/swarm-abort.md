---
description: Drop an abort marker so a teammate commits WIP and exits cleanly
argument-hint: <teammate-name> [--team <name>] [--reason "<text>"]
allowed-tools: Write, Read, Bash
---

# /swarm-abort

Gracefully interrupt a running teammate without losing in-progress work. Drops the abort marker file the teammate polls at every phase boundary; on detection the teammate commits current WIP, pushes, and exits cleanly.

This is the **graceful alternative to `TaskStop`** (which is a hard kill that loses uncommitted work).

## Inputs

- **Teammate name** (positional, required): the name of the teammate to abort.
- `--team <name>` (optional): the team the teammate belongs to. Default: infer from current session's team context.
- `--reason "<text>"` (optional): human-readable explanation written into the marker file. Useful for the teammate's commit message and the audit timeline.

## Behavior

1. Resolve the teammate's worktree path from the team config.
2. Write `<worktree>/.claude/abort-<teammate-name>` with the reason payload + timestamp.
3. Print confirmation + expected commit boundary (typically <2 min for an active teammate).
4. **Does not block** — the teammate's next phase boundary check picks up the marker; the operator gets a `<teammate-message>` when the WIP commit + push lands.

## Example

```
/swarm-abort builder-2 --team refactor-pkg --reason "Going in wrong direction — type-hint approach won't work for the metaclass path. Will redispatch fresh."

✓ Marker dropped at .ai/.claude/workspace/worktrees/agent-X/.claude/abort-builder-2
  Expected commit: within ~2 min (Builder phase boundary cadence)
  You'll receive a <teammate-message> when the WIP commit lands.
```

## Notes

- The abort contract is documented in every teammate's spawn prompt; new heads are expected to honor it.
- If the marker is still present 5 min after detection (teammate didn't pick it up), the meta-supervisor escalates to `TaskStop` (hard kill).
- Markers are namespaced per-teammate so aborting one doesn't affect siblings.
