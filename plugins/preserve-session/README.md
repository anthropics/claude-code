# preserve-session

[한국어](./README.ko.md)

Keeps your Claude Code conversations alive when you rename, move, or copy your project folder.

## Demo

https://github.com/user-attachments/assets/05a3dd4b-dfaa-4540-a2f1-e0c2bf6583af

## Why you'd want this

Claude Code finds your past conversations by looking at the project folder's path. So if you rename or move the folder, those conversations disappear from `/resume`.

## The fix (one line)

Run `/preserve-session:fix` in the new location. The plugin tags each project with a unique ID and uses that to carry your conversations over to the new path.

## Install

```
claude plugin install preserve-session
```

No configuration needed — it turns itself on.

**For local testing:**
```
claude --plugin-dir /path/to/plugins/preserve-session
```

## Which command do I need?

Most of the time, just `/preserve-session:fix`. The others are for specific situations.

| When | Use |
|------|-----|
| You renamed or moved a project and can't see old conversations | `/preserve-session:fix` |
| You copied a project and want a **copy** of old conversations in the new one (original kept) | `/preserve-session:copy` |
| You copied a project and want to **move** old conversations into the copy (original emptied) | `/preserve-session:move` |
| Something feels off — check the plugin's view of things | `/preserve-session:doctor` |
| (Optional) Tidy up old entries or free up disk space | `/preserve-session:cleanup` |
| Uninstall and remove all plugin data | `/preserve-session:uninstall` |

> **Do I need `/cleanup`?** — No, it's optional. Claude Code already auto-deletes old conversation files after 30 days. Use `/cleanup` only if you want to free up disk space sooner or keep your project list tidy. *(Added in v1.3.0, hardened in v1.3.1 for Korean-path users.)*

> **Also note:**
> - ~~`/preserve-session:inherit`~~ was split into `copy` and `move` in v1.2.0 for clearer meanings. Use `copy` or `move` going forward. (`inherit` will be removed in a future major release.)
> - `/preserve-session:scan` (register many projects at once) is planned but not shipped yet.

## Common flows

**After renaming a folder:**
```
cd /new/project/name
claude
/preserve-session:fix
```

**After copying a project (fresh start, original kept as-is):**
```
# Nothing to do — just run claude in the copy;
# the plugin registers it as a brand-new project
```

**After copying a project (you want a copy of old conversations too):**
```
/preserve-session:fix             # register the copy first
/preserve-session:copy            # Claude asks which source to copy from
```

**After copying a project (you want to move old conversations in, dropping the original):**
```
/preserve-session:fix             # register the copy first
/preserve-session:move            # Claude asks which source to move from
```

> `copy` makes a duplicate — the original still has its conversations.
> `move` takes the conversations out of the original — the original is emptied.

**Check current state:**
```
/preserve-session:doctor
```

## Reading the doctor output

- `~ hook not found in settings.json` — normal. The hook is active through the plugin, no settings entry needed.
- `✗ path mismatch` — the folder moved but wasn't re-registered. Run `/preserve-session:fix`.
- `⚠ slug collision` — another registered project maps to the same internal folder. Common on non-ASCII paths. Workarounds in the note below.

## Things to know

- **Use the terminal, not the VS Code extension** — plugin commands don't fully work in the extension. Run `claude` in a terminal.
- **Add `.claude/hash.txt` to `.gitignore`** — if team members share this file, your records will collide.
- **`project-registry.json` is local only** — don't back it up or sync it across machines.
- **Close other Claude Code sessions before running `/fix`** (the terminal you're running `/fix` in is fine) — another session open on the same project can conflict with the folder rename. If you've already started a separate new conversation in the new location, the plugin merges automatically; the leftover old folder can be cleaned up later with `/preserve-session:cleanup`.

## About non-ASCII paths (CJK, Cyrillic, Arabic, accented Latin, etc.)

Claude Code's internal folder name is computed by replacing every character that isn't `[a-zA-Z0-9-]` with `-`. Slashes become `-` too, so **segment boundaries disappear** after the replacement. The practical consequences:

- Any two paths with the same *count* of non-ASCII characters (plus the same ASCII letters at the same positions) collide — even if the characters themselves differ, and even if the segment structure is different. For example, `~/외주/app`, `~/개인/app`, and `~/仕事/app` all become the same internal folder name.
- Their session files are physically stored together, and `/resume` shows conversations from different projects mixed in a single list.

**What this plugin does**:
- Detects collisions on session start and via `/preserve-session:doctor`.
- Blocks `fix`, `copy`, `move`, and `cleanup` from operations that would silently lose data during a collision.
- Handles the macOS NFD vs NFC encoding difference internally, so Korean/CJK paths don't break for *other* reasons.

**What this plugin can NOT do** (upstream Claude Code issue, tracked at [#40946](https://github.com/anthropics/claude-code/issues/40946)):
- Prevent Claude Code from writing two colliding projects to the same folder in the first place.
- Separate already-mixed sessions in `/resume`.

**Workarounds until the upstream fix lands**:
- Use ASCII-only names for projects where this matters.
- Or, make the **total count** of non-ASCII characters differ between colliding projects (changing segment order or length within the same count does *not* help — `/` also becomes `-`, erasing segment boundaries).
- Run `/preserve-session:doctor` in each non-ASCII-named project to see whether you've hit a collision.

Single non-ASCII projects with no siblings sharing their slug are safe.

## Files

| File | Location | Purpose |
|------|----------|---------|
| `hash.txt` | `<project>/.claude/hash.txt` | Per-project unique ID |
| `project-registry.json` | `~/.claude/project-registry.json` | Maps ID → current path |

## License

MIT © 2026 SEONGIL WON. [LICENSE](https://github.com/wonbywondev/claude-plugins/blob/main/LICENSE)
