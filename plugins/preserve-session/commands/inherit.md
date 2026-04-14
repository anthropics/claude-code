---
description: Copy session history from another registered project into the current one
allowed-tools: Bash(bash:*)
---

> ⚠️ **Hotfix v1.1.2 notice** — the `--from` copy mode is currently **disabled**.
> The previous `cp`-based implementation left the source session's `sessionId`,
> `parentUuid` chain, and `cwd` unchanged in the copied `.jsonl` files, which
> caused Claude Code (2.1.x) to treat the copy as the same session as the source.
> Resuming the "inherited" session could contaminate the original source's history.
> A proper fix (sessionId + filename + cwd rewrite) is in progress. Until it lands,
> only `--list` is available. Running the command will show the list; attempting a
> copy will show a blocking message explaining the situation.

**Step 1** — List available projects:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/inherit.sh" --list
```

Show the output to the user. Inform the user that **inherit copy is temporarily
disabled** due to the hotfix above, and that listing still works as a way to see
the available source projects. If they ask when copy will return, note that a
proper fix is being developed (see `plugins/preserve-session/compass/context.md`
for details).

**(Copy step removed while hotfix is active.)** Do not invoke `--from`; the script
will exit with a warning message and no files will be copied.
