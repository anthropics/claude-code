# agents-md

`AGENTS.md` read the way Claude Code reads `CLAUDE.md`, as a plugin, under
one option, `instructionFiles`:

- `claude-md`: only `CLAUDE.md` is loaded, by the engine, as today. The plugin
  adds nothing.
- `claude-md-or-agents-md` (the default): a project with no instruction files
  of its own gets its `AGENTS.md` files instead, loaded exactly where and how
  `CLAUDE.md` would be. "Of its own" is read off what the engine loaded for
  the context: a `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` in any
  directory from the root down to the working directory leaves the whole
  project to the engine, and the plugin stays out (the organization's managed
  file, the person's `~/.claude/CLAUDE.md`, a `.claude/rules` file and an
  added directory's `CLAUDE.md` do not count, as the nested walk does not see
  them either). With none, every `AGENTS.md` and `.claude/AGENTS.md` on that
  path joins the instruction files the engine renders, and a `Read` under a
  subdirectory attaches that directory's `AGENTS.md` unless a `CLAUDE.md`
  there claims it.
- `claude-md-and-agents-md`: every `AGENTS.md` is loaded beside `CLAUDE.md`,
  up and down the tree; a file `CLAUDE.md` already `@`-imports, or is a link
  to, is not loaded a second time (compared by path, then by content).
- `managed-only`: the project's checked-in and private instruction files and
  the person's own are dropped from the context; the organization's managed
  `CLAUDE.md` and the engine's memory stay. The engine's nested `CLAUDE.md`
  attachments on `Read` are not an event yet and still arrive. (The engine's
  `claudeMdExcludes` setting also exists, for user, project and local files,
  and applies to the `AGENTS.md` files this plugin reads too.)

How the files reach the model is the engine's doing, not the plugin's:
`prompt.context` hands a hook the instruction files behind `claudeMd`
(`{ path, kind, content, parent? }`, kinds `managed`, `user`, `project`,
`local`, `memory`, in load order) and a hook answers the list changed. The
engine then renders `claudeMd` from the answered files with its own preamble
and framing, announces them by name, and keeps only the `managed` ones for an
agent that omits project instructions (Explore, Plan, a custom agent with
`omitClaudeMd`). So an `AGENTS.md` this plugin adds as a `project` file is, to
everything downstream, a project instruction file: same place in the context,
same framing, same omission rules, same announcement. An organization's
prepended plugin on `prompt.context` sits above this one and has the last
word on the files.

`hooks/register.ts` is the module; everything under `hooks/` is its parts,
importing `claude-code` and one another alone. `tests/` runs under
`claude plugin test <this folder>`.

## Setting the option

As a built-in its option is the `/config` row "Project instructions", a
picker over the four values, each described there. By hand it is

```json
{
  "pluginConfigs": {
    "agents-md@builtin": {
      "options": { "instructionFiles": "claude-md-and-agents-md" }
    }
  }
}
```

in user settings (`~/.claude/settings.json`), `--settings`, or managed
settings; a project's `.claude/settings.json` is not read for plugin
options. Changing it reloads the module, and the next context the engine
builds (the next turn after the reload, a new conversation, `/clear`, a
compaction) carries the new mode's files. A hand-typed value outside the
four is told once in the transcript and reads as the default. `/plugin`
lists the plugin among the built-ins, where a person can turn it off; with
it off the engine reads `CLAUDE.md` alone. No hooks setting or CLI mode turns
it off (`disableAllHooks`, `allowManagedHooksOnly` and `--bare` govern
settings hooks and installed plugins, not built-ins); where the engine loads
no instruction files (`--bare` without `--add-dir`, `--safe-mode`,
`CLAUDE_CODE_DISABLE_CLAUDE_MDS`) its walk finds none and it adds none,
`CLAUDE.md` and `AGENTS.md` alike.

The option was first keyed `projectInstructions`, with the values `claude`,
`agents-fallback`, `both` and `none`. A value still stored under that key is
honoured for now while `instructionFiles` reads as its default: `none` as
`managed-only`, `claude` as `claude-md`, `agents-fallback` as
`claude-md-or-agents-md`, `both` as `claude-md-and-agents-md`, any other
value as `claude-md` (which adds nothing, never as the default, which loads
`AGENTS.md`); the first `session.start` of a load says in the transcript how
it was read. Once `instructionFiles` is set to anything but its default, the
old key is not read and the transcript says to remove it.

Run from this folder instead (`claude --plugin-dir mods/agents-md`), the
same entry is keyed `"agents-md"`.

## What it hooks

| event | what the hook does |
| --- | --- |
| `session.start` | in every mode: passes the start straight through and floats the usage row for the configured mode, never awaited; the first start of a load logs how a stored `projectInstructions` value is read. The session's start never waits on this plugin |
| `prompt.context` | under `claude-md-or-agents-md` and `claude-md-and-agents-md`: walks `$.fs.ancestors` for the `AGENTS.md` files above the working directory and answers them as `project` instruction files, each `@` import its own entry after its file, each placed where a project file of its directory stands (root first, before the first deeper project file, else after the last project file, before memory); files the engine already holds by path or by content are left out; under `claude-md-or-agents-md` it answers nothing when the project has a `CLAUDE.md` of its own (among the handed files, else found by a `$.fs.ancestors` walk, so a `CLAUDE.md` the engine loaded and then withheld still counts), and logs which files it loaded once, and again after a move to another project root; handed unknown files (a hook above rewrote the `claudeMd` text) it adds nothing; the first context of a load sends the load row (counts) and the feature mark; under `managed-only` (matcher: a `project`, `local` or `user` file present): answers the list without those kinds |
| `agent.spawn` on `fork: true` | under `claude-md-or-agents-md` and `claude-md-and-agents-md`: a fork the Agent tool starts shares its parent's prompt prefix, so the parent loop's delivered nested files are copied to the fork's loop and not attached to it again (a `/fork` or `/subtask` fork does not raise `agent.spawn` yet and starts from an empty set, as every fork did before; a fork started in the same tool batch as a `Read` inherits that Read's file although its prefix holds a placeholder for it) |
| `tool.call` on `Read` | under `claude-md-or-agents-md` and `claude-md-and-agents-md`, for a file under the session's project root (`$.session.root()`, read live, so `/cd`, a host's directory change and worktree moves are followed and a moved root starts the delivered sets and the fallback decision over; a file elsewhere gets nothing, as the engine attaches no nested `CLAUDE.md` there; and nothing anywhere in a run where the engine attaches nothing to a turn, `--bare` with its `CLAUDE_CODE_SIMPLE` or `CLAUDE_CODE_DISABLE_ATTACHMENTS`, read on every Read through `$.env.get` as the engine reads them on every turn): walks only the directories strictly between the root and the read file (`$.fs.ancestors` with `below: root`, as the engine walks only those for a nested `CLAUDE.md`, never up to the filesystem root again) and attaches their `AGENTS.md` files not yet given to that agent loop, not already among the context's instruction files (by path or, for a project file, by text) and not claimed by a `CLAUDE.md` of the same directory (or imported by one), as `context` after the tool result, framed `Contents of <path>:` byte for byte as the engine frames a nested `CLAUDE.md`, whatever its size; each file once per loop and conversation (the context's recomputation after a compaction or `/clear` starts the count over), the context's files never; a Read that attached files sends the nested row. A `~` or `~/` path is read under the home directory as the Read tool reads it |

## What it calls on `$`

`fs.ancestors` (with each found file's `parts`: the file and its imports
apart; with `below` on a Read; it finds nothing on a thin client, whose
workspace files are remote, as the engine's own walk does), `session.root`,
`session.cwd`, `env.get` (`HOME` and `USERPROFILE`, once per load, the
profile first on a Windows spelling of the working directory, so a `~/` path
the model hands a Read resolves where the Read tool reads it; `CLAUDE_CODE_SIMPLE`
and `CLAUDE_CODE_DISABLE_ATTACHMENTS` on every Read), `ui.log`,
`telemetry.log` and `telemetry.mark`.

`$.telemetry` is the [telemetry](../telemetry) plugin's noun; where that
plugin is not seated the calls find no noun and are dropped without a trace,
and nothing else changes.

## What it logs

Counts and closed choices only; no path and no file text. Each row goes
through `$.telemetry.log`, so it exists only where the telemetry plugin
does:

| event | when | properties |
| --- | --- | --- |
| `agents_md_mode` | once per fresh load, at `session.start` | `mode` (`claude-md` \| `claude-md-or-agents-md` \| `claude-md-and-agents-md` \| `managed-only`), `is_interactive` |
| `agents_md_load` | the first context of a load, under `claude-md-or-agents-md` and `claude-md-and-agents-md` | `mode`, `file_count` (`AGENTS.md` files handed to the engine), `import_count` (their `@` imports), `total_content_length`, `yielded` (`claude-md-or-agents-md` stood down for a `CLAUDE.md` of the project's own), `walk_failed`; with it one `$.telemetry.mark` for feature `agents_md`: `ok`, or `sad` with reason `walk_failed` |
| `agents_md_nested` | a Read that attached nested files | `mode`, `file_count` |

## Where it still differs from CLAUDE.md

All of these apply only to the modes that load `AGENTS.md`,
`claude-md-or-agents-md` (the default) and `claude-md-and-agents-md`. Each
names a loader fact a plugin cannot reach through the events it has today.

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
6. `/memory` and the `#` shortcut do not know `AGENTS.md` files, and the
   engine's own initial-load row does not count them (this plugin's
   `agents_md_load` row does).
7. An `@` import outside the working directory inside an `AGENTS.md` is
   honoured only once the approval the engine asks for a `CLAUDE.md`'s
   external imports has been given (without it the import is left out, as a
   `CLAUDE.md`'s is); the approval dialog itself is raised for `CLAUDE.md`
   imports alone.
8. A subagent that is not a fork gets a nested `AGENTS.md` at its own first
   `Read` under that directory even when its parent's loop was already given
   it; the engine does not hand such a subagent the nested `CLAUDE.md` again.
   A fork matches the engine on both sides.

## Testing

    claude plugin test mods/agents-md

`tests/register.test.ts` covers the default mode: a project with `AGENTS.md`
alone gets it as a project instruction file and one transcript line naming
it, a project with a `CLAUDE.md` of its own is left to the engine without a
walk, a failed walk leaves the context as handed, and the start hands
`$.telemetry` the mode row alone where a test seats a provider for that
noun, and goes on untouched where none is seated.
