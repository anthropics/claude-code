# diff

The diff pane as a plugin: `/diff` opens the session's uncommitted changes
beside the transcript, one row per changed file and every file's hunks
beneath, and closes it again; each toggle leaves `Diff panel shown` or
`Diff panel hidden` in the transcript. The header, the file list and its
toggles stay put while the wheel moves the hunks under them three rows a
tick, or the list a file a tick while the wheel is over a list longer than
its eight rows (the plugin answers the pane's `ui.scroll` itself); a row's
click puts that file's hunks at the top; the list also scrolls under the
built-in's list keys (`ctrl+up`/`ctrl+down`, `opt+up`/`opt+down`), and
`ctrl+x b` moves the comparison base on, as the built-in's chord does: both
through Buttons that declare the engine's own actions. The pane refreshes
as Claude edits and runs shell commands, and while it is open it polls
the repository's HEAD so a commit or checkout made elsewhere shows too.
The main loop's first successful edit of a session opens the pane by
itself, as the built-in panel opens on its first checkpoint: where the
layout docks it beside the transcript (the fullscreen layout, which each
drawing's `viewport` says), the terminal is wide enough (144 columns when
the person never chose, 110 when they kept it open before; a person who
closed it is left alone) and file checkpointing is on; a subagent's edit
opens nothing, and where the surface does not say, nothing opens by
itself. A docked pane fetches before it opens, as the built-in panel
primes its data, so it never lands on `Loading diff…`; an open the engine
leaves waiting undrawn is withdrawn, so no later resize seats it, and the
next edit asks again. A session resumed or continued whose transcript
already holds such an edit opens the pane on the same terms as soon as the
width is known, as the built-in opens on the history it restores.

Under the fullscreen layout a terminal under 110 columns gets the
built-in's line asking for a wider one and nothing opens. Without that
layout (`CLAUDE_CODE_NO_FLICKER=0`, which `/diff` learns from the command's
`presentation`) the pane opens inline at any width, focused and as tall
as its content (the open's `rows`), in the built-in dialog's shape: the
title, the count, five file rows at a time round the selected one (`❯`,
where the focus ring starts; the plugin follows the ring's walk through
`ui.focus` and re-centres the rows as the built-in does), the key hints;
Enter shows that file's hunks alone,
Escape backs out to the list and then closes, leaving `Diff dialog
dismissed`; toasts are held while it is up. A file's ask button arms that
file: its hunks ride the next prompt as context, once.

The pane compares the working tree against HEAD, split at the session's
start (the default; the start the engine gives in `$.session.usage()`, so a
resumed session keeps its first and `/clear` begins anew), against HEAD
plainly, or against the merge-base with
the default branch; the base line under the header names a base other than
the session's, and the choice is kept per repository in the plugin's store.
A picker shows one earlier turn's edits instead of the working tree, read
from the session's messages. Files that changed before the session started
(by their timestamp, among the paths already dirty when the pane first
read the repository), and noise (lockfiles, generated and test files), are
listed apart and folded until asked for; a rename lists as git prints it.
Outside a git repository `/diff` says so and does nothing else.

Git runs when the built-in panel's would: nothing at the session's start;
one `git rev-parse`, in the directory the session started in, when `/diff`
or the first edit a pane has room to open on first needs the repository
(an answer of no repository is kept too, until `/clear` or `/resume`
forgets it); and the working tree is read only by a fetch for a pane that
is open, after an edit that landed or a shell command that ran. The one
read the built-in has no counterpart for is a `git status` at a pane's
first fetch, which stands in for the change time the built-in dates a
moved file by.

`hooks/register.ts` is the module; everything under `hooks/` is its parts.

## What it hooks

| event | what the hook does |
| --- | --- |
| `session.start` | Binds the engine once and registers `/diff` (a session where another `/diff` is listed leaves the plugin idle); asks nothing of the repository, which `/diff` or the first edit pins when it comes; off its dispatch, reads the transcript, and for a resumed session whose turns edited opens the pane as the first edit would. |
| `ui.render` of `PromptHint` | Reads the terminal's width and whether its layout docks a pane, which decide whether the first edit opens the pane. |
| `ui.render` of `Pane` | Draws the pane: docked, the header, base line, source picker, file list and toggles over the window of hunks; inline, the dialog. |
| `command.run` of `diff` | Pins the repository when none is, opens or closes the pane (focused and closing on Escape without the fullscreen layout), says which, and remembers the choice. |
| `ui.close` of the pane | Backs out of the dialog's detail view instead of closing; else remembers the person's close as `/diff`'s. |
| `ui.scroll` of the pane | Docked, moves the hunks under the pinned header and list (three rows a wheel tick, a page a page key), or the list when the wheel is over it, and keeps the engine's window still. |
| `ui.focus` in the pane | In the dialog's list, selects the file the ring lands on, re-centres the five rows on it, and lands the ring where that row now sits. |
| `command.run` of `clear`, `resume` | Closes the pane and forgets the session's state, the pinned repository with it. |
| `tool.call` of `Edit`, `Write`, `NotebookEdit` | After an edit that landed (not refused, not failed), refreshes an open pane; the main loop's first such edit opens it, pinning the repository then if the terminal has the room and checkpointing is on. |
| `tool.call` of `Bash`, `PowerShell` | After a command that was not refused, failed and interrupted ones too, refreshes an open pane. |
| `prompt.submit` | Adds the armed file's hunks to the prompt's context and disarms. |

## What it calls on `$`

`clock.after`, `clock.every`, `clock.now`, `command.register`, `env.get`
(`CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING`), `fs.list`, `fs.read`, `fs.stat`,
`process.run` (git, read-only), `session.id`, `session.messages`,
`settings.read`, `store.get`, `store.set`, `telemetry.log`, `telemetry.mark`,
`ui.close`, `ui.invalidate`, `ui.log`, `ui.open`, `ui.resolve`, `ui.status`.

`$.telemetry` is the telemetry plugin's noun; where it is absent the rows
are dropped and nothing else changes.

## Try it

```sh
claude --plugin-dir /path/to/diff
```

then `/diff` inside a git repository with a modified file.
