---
description: Push an entry onto the focus stack (plan id, whole plan, or [explore: ...])
argument-hint: <plan>:<outline-id> | <plan> | [explore: <what>]
allowed-tools: Bash
---

Push the entry the user provided onto the focus stack:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" push "$ARGUMENTS"
```

Valid forms: `<plan>:<outline-id>` (the id must exist in `agents/<plan>-plan.md`),
`<plan>` alone (commit to completing the whole plan), or `[explore: <what>]` for
unplanned work. If validation fails, show the error and suggest the correct form —
do not push anything else. On success, show the stack (`twilight-focus.sh show`).
