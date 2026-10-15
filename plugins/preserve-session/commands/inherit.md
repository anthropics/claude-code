---
description: (Deprecated v1.2.0) Use /preserve-session:copy or /preserve-session:move instead
allowed-tools: Bash(bash:*)
---

> ⚠️ **Deprecated (v1.2.0)** — the `inherit` command has been split into two
> dedicated commands with clearer semantics:
>
> - **`/preserve-session:copy`** — non-destructive. Creates independent session
>   copies in the current project (new `sessionId`, new filename, rewritten `cwd`).
>   The source project is not modified.
> - **`/preserve-session:move`** — destructive. Migrates session files out of
>   the source slug folder into the current one. The source project is emptied
>   of its session history.
>
> The `inherit` command will be removed in a future major release.

Tell the user that `/preserve-session:inherit` is deprecated, and ask which of
`copy` or `move` they want to use. Do not run the deprecation stub — simply
redirect the user to `/preserve-session:copy` or `/preserve-session:move`.

If the user explicitly insists on running the stub anyway:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/inherit.sh"
```

(The stub will print a redirect message and exit with code 1.)
