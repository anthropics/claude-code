# agents-md

`AGENTS.md` read the way Claude Code reads `CLAUDE.md`, as a plugin, under
one option, `projectInstructions`:

- `claude` (the default): only `CLAUDE.md` is loaded, by the engine, as
  today. The plugin adds nothing to the context. When the project has an
  `AGENTS.md` (or `.claude/AGENTS.md`) somewhere from the filesystem root
  down to the working directory and no `CLAUDE.md`, one line on the
  notification bar at session start says so and names this option.
- `agents-fallback`: a project with no instruction files of its own gets its
  `AGENTS.md` files instead, loaded exactly where and how `CLAUDE.md` would
  be. "Of its own" is read off what the engine loaded for the context: a
  `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` in any directory from
  the root down to the working directory leaves the whole project to the
  engine, and the plugin stays out (the organization's managed file, the
  person's `~/.claude/CLAUDE.md`, a `.claude/rules` file and an added
  directory's `CLAUDE.md` do not count). With none, every `AGENTS.md` and
  `.claude/AGENTS.md` on that path joins the instruction files the engine
  renders, and a `Read` under a subdirectory attaches that directory's
  `AGENTS.md` unless a `CLAUDE.md` there claims it.
- `both`: every `AGENTS.md` is loaded beside `CLAUDE.md`, up and down the
  tree; a file `CLAUDE.md` already `@`-imports, or is a link to, is not loaded
  a second time (compared by path, then by content).
- `none`: the project's checked-in and private instruction files and the
  person's own are dropped from the context; the organization's managed
  `CLAUDE.md` and the engine's memory stay. The engine's nested `CLAUDE.md`
  attachments on `Read` are not an event yet and still arrive. (The
  `claudeMdExcludes` setting applies to the `AGENTS.md` files this plugin
  reads too.)

How the files reach the model is the engine's doing, not the plugin's:
`prompt.context` hands a hook the instruction files behind the `claudeMd`
block (`{ path, kind, content, parent? }`, kinds `managed`, `user`,
`project`, `local`, `memory`, in load order) and a hook answers the list
changed. The engine then renders `claudeMd` from the answered files with its
own preamble and framing, announces them by name, and keeps only the
`managed` ones for an agent that omits project instructions (Explore, Plan, a
custom agent with `omitClaudeMd`). So an `AGENTS.md` this plugin adds as a
`project` file is, to everything downstream, a project instruction file: same
place in the context, same framing, same omission rules, same announcement.
An organization's prepended plugin on `prompt.context` sits above this one
and has the last word on the files.

`hooks/register.ts` is the module; everything under `hooks/` is its parts,
importing `claude-code` and one another alone.

## Setting the option

Built in, the option is the `/config` row "Project instructions", a picker
over the four values, each described there. By hand it is

```json
{
  "pluginConfigs": {
    "agents-md@builtin": {
      "options": { "projectInstructions": "agents-fallback" }
    }
  }
}
```

in user settings (`~/.claude/settings.json`), `--settings`, or managed
settings; a project's `.claude/settings.json` is not read for plugin
options. Changing it reloads the module, and the next context the engine
builds (the next turn after the reload, a new conversation, `/clear`, a
compaction) carries the new mode's files. A value outside the four is told
once in the transcript and reads as the default. `/plugin` lists the plugin
among the built-ins, where a person can turn it off.

Run from this folder instead (`claude --plugin-dir mods/agents-md`), the
same entry is keyed `"agents-md"`.

## What it hooks

| event | what the hook does |
| --- | --- |
| `session.start` | In every mode: passes the start straight through and floats the rest, never awaited. Under `claude`, two `$.fs.ancestors` walks for the `AGENTS.md` and `CLAUDE.md` files above the working directory, and when they finish the nudge toast (ten seconds on the bar) if there are the former and none of the latter, with a note in `$.store` that it was shown; under any other mode, a note that an earlier nudge was acted on, once. The session's start never waits on this plugin. |
| `prompt.context` | Under `agents-fallback` and `both`: walks `$.fs.ancestors` for the `AGENTS.md` files above the working directory and answers them as `project` instruction files, each `@` import its own entry after its file, each placed where a project file of its directory stands (root first, before the first deeper project file, else after the last project file, before memory); files the engine already holds by path or by content are left out. Under `agents-fallback` it answers nothing when the handed files include a `CLAUDE.md` of the project's own, and logs once which files it loaded. Handed unknown files (a hook above rewrote the `claudeMd` text) it adds nothing. Under `none` (matcher: a `project`, `local` or `user` file present): answers the list without those kinds. |
| `agent.spawn` on `fork: true` | Under `agents-fallback` and `both`: a fork the Agent tool starts shares its parent's prompt prefix, so the parent loop's delivered nested files are copied to the fork's loop and not attached to it again. |
| `tool.call` on `Read` | Under `agents-fallback` and `both`, for a file under the session's project root (`$.session.root()`, read live, so `/cd` and worktree moves are followed and a moved root starts the delivered sets and the fallback decision over; a file elsewhere gets nothing, as the engine attaches no nested `CLAUDE.md` there): walks only the directories strictly between the root and the read file (`$.fs.ancestors` with `below: root`) and attaches their `AGENTS.md` files not yet given to that agent loop, not already among the context's instruction files, and not claimed by a `CLAUDE.md` of the same directory (or imported by one), as `context` after the tool result, framed `Contents of <path>:` as the engine frames a nested `CLAUDE.md`, whatever its size; each file once per loop and conversation (the context's recomputation after a compaction or `/clear` starts the count over). A `~` or `~/` path is read under the home directory as the Read tool reads it. |

## What it calls on `$`

`fs.ancestors` (with each found file's `parts`, the file and its imports
apart; with `below` on a Read), `session.root`, `session.cwd`, `env.get`
(`HOME` and `USERPROFILE`, once per load), `ui.toast`, `ui.log`,
`store.get` and `store.set` (the nudge's note, key `nudge`),
`telemetry.log` and `telemetry.mark`.

`$.telemetry` is the telemetry plugin's noun; where that plugin is not
seated the calls find no noun and are dropped without a trace, and nothing
else changes.

## What it logs

Counts and closed choices only; no path and no file text. Each row goes
through `$.telemetry.log`, so it exists only where the telemetry plugin
does:

| event | when | properties |
| --- | --- | --- |
| `agents_md_mode` | once per fresh load, at `session.start` | `mode`, `is_interactive`; under `claude` also `agents_file_count` and `claude_file_count`, the directories of the walk holding each |
| `agents_md_load` | the first context of a load, under `agents-fallback` and `both` | `mode`, `file_count`, `import_count`, `total_content_length`, `yielded` (`agents-fallback` stood down for a `CLAUDE.md` of the project's own), `walk_failed`; with it one `$.telemetry.mark` for feature `agents_md`: `ok`, or `sad` with reason `walk_failed` |
| `agents_md_nested` | a Read that attached nested files | `mode`, `file_count` |
| `agents_md_nudge` | the nudge | `outcome`: `shown` when the toast goes up, `acted` once when a later load runs under another mode after one was shown |

## Where it still differs from CLAUDE.md

All of these apply only to the opt-in modes.

1. Nested files attach on a text `Read` only. The engine also attaches a
   directory's `CLAUDE.md` for a file `@`-mentioned in the prompt, for the
   IDE's opened file or selection, and for the `Read` tool's notebook, image
   and PDF results.
2. A nested file the plugin attaches is not registered in the loop's
   read-file state, so after a compaction the engine does not restore it
   among the recently read files (the plugin attaches it again at the next
   `Read` under that directory instead), and a change to it mid-session is
   not re-announced.
3. `/cd` carries the new tree's `CLAUDE.md` in its own notice; the plugin's
   files for the new tree arrive in the same next request through the
   engine's instructions announcement instead.
4. Paths compare by spelling; the engine resolves a symlinked alias of the
   working directory before deciding a file is inside it.
5. `--add-dir` directories contribute no `AGENTS.md`, where the engine can
   load their `CLAUDE.md`.
6. `/memory` and the `#` shortcut do not know `AGENTS.md` files.
7. An `@` import outside the working directory inside an `AGENTS.md` is
   honoured only if the `CLAUDE.md` external-includes approval was already
   given; the approval dialog is raised for `CLAUDE.md` imports alone.
8. A subagent that is not a fork gets a nested `AGENTS.md` at its own first
   `Read` under that directory even when its parent's loop was already given
   it; the engine does not hand such a subagent the nested `CLAUDE.md` again.
   A fork matches the engine on both sides.

## Testing

    claude plugin test mods/agents-md

`tests/register.test.ts` covers the default mode's `session.start`: the
nudge, the walks it never waits on, and the rows it hands `$.telemetry`
where a test seats a provider for that noun.
