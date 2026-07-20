# My Project — AI Session Protocol (MEP)

## ⚡ Session Protocol (MANDATORY)

### On Session Start — BEFORE responding to the user:
1. Run `git pull`
2. Read `handoff.md` — load context from last session
3. Briefly tell the user what's pending (2–3 lines)

### On Session End — triggered by: `/eol`, `done`, `wrap up`, `heading out`
1. Update `handoff.md` — newest entry on top, three sections: what happened / pending / watch out
2. `git add handoff.md && git commit -m "EOL: [summary]" && git push`
3. Say: "End of Line."

### Conflict Recovery (if push fails)
Re-read both versions of `handoff.md`. Newest date goes on top. Resolve, rebase, push. No human needed.
