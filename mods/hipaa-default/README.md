# hipaa-default

For an organization under HIPAA. A mod's own call and a settings hook's call
are their author's code, and Claude Code does not hold them to the rules it
holds the model to. This mod holds them to what an administrator blocked or
denied, unless the code is the organization's own.

| Rule | Event | What it holds |
| --- | --- | --- |
| [`blocked-tool`](hooks/rules/blocked-tool.ts) | `tool.check`, where `ceiling` is `deny` | Refuses the call of a person's mod or a built-in one, by any road, and of a settings `mcp_tool` hook not known as the organization's, which is skipped while the call it guards goes on. The refusal names the tool. |
| [`unread-ceiling`](hooks/rules/unread-ceiling.ts) | `tool.check`, where `isCeilingUnread` is set | Refuses the same callers where the call could not be matched against the deny rules in managed settings. |
| [`direct-call`](hooks/rules/direct-call.ts) | `tool.check`, where `op` is set | Refuses the file or process call of a person's mod by those two rules. |

`ceiling` is `deny` on an MCP tool that is blocked for the organization or the
member's role, that a host marks `always_deny`, or that a deny rule in managed
settings names. A rule or a switch of the person's or a repository's is not a
block. Where Claude Desktop starts Claude Code through an SSH host's own
launcher, a deny sent as `--settings` or `--disallowedTools` is a block too, so
there a tool the person switched off counts as blocked. The same holds at any
start whose `--managed-settings` cannot be read.

The organization's own code passes, as `next.origin.isOrganizations` tells it:

- A settings hook known as the organization's. One whose owner could not be
  told is refused like a person's or a repository's.
- The `$.mcp.call`, `$.tool.call`, `$.agent.spawn` or `$.ui.ask` of a mod that
  managed settings seated in `prepend` or `append`, as it made the call. A seat from a person's own
  settings does not count, nor does a `requiredByOrganization` mark. A call a
  hook rewrote is refused, and so is one a script or a `Monitor` watch makes
  for the mod.

A connector the organization blocked still refuses these calls at its gateway.

`ceiling` is also `deny` on such a call of any tool where a deny rule in managed
settings covers it, content included (`Bash(rm *)`, `Read(path)`), matched as
for the model. At the starts named above, a deny sent as `--settings` or
`--disallowedTools` counts as managed. At any other start by Claude Desktop, one sent as
`--disallowedTools` holds a mod's own call where it holds the model's, and leaves a hook's call
and a watch's poll alone. Not held: a shell form that
Claude Code only asks the model's user about, and any other rule that a tool applies
only while it runs. A `Grep` or `Glob` over a folder that any of these `Read` rules
reaches under is refused whole, as unread. A mod's `file_upload` to Claude in Chrome,
alone or in a `browser_batch`, or to the Desktop Browser pane is refused where one
covers a path, and as unread where one exists and a path cannot be judged.

A mod's `$.fs.read`, `$.fs.list`, `$.fs.write`, `$.process.run` and
`$.process.spawn` meet the same two rules as the tool call that does the same
(`Read`, `Write`, or a `Bash` line), with `op` naming the call. There a built-in
mod passes as the organization's does, each unless a hook rewrote its call. A
content rule holds a command's plain form only, and neither it nor a file rule
holds what a program does once it runs. A `PowerShell` rule is not matched: it
makes a process unreadable where the program is PowerShell or there is no Bash.
In Cowork on the person's computer, and while no session is bound,
`--disallowedTools` counts for these calls only at the starts where it counts as
managed. At the Code tab's other starts, an entry of it that names a path or a
command does not count for them.

Everything else passes untouched. A tool set to ask runs for a mod or a hook
with nobody asked. The mod shows no card and calls nothing on `$`. Where a
hook fails, its `.catch` refuses and passes the same callers.

## Where it sits

First in the `prepend` tier, ahead of `sec-default` and whatever
`prependPlugins` lists, so no other hook answers over it or goes on past it.
It is there once the session knows its organization is under HIPAA, from the
start or from the moment it learns so. Until the organization's answer comes,
this machine's record of the same login under HIPAA counts as knowing; a login
that cannot be told does not.

## What turns it off

`"cc-plugin-hipaa-default@builtin": false` under `enabledPlugins` in managed settings.
No other settings file does, and neither does `/plugin disable`.

## Adding a rule

One file under `hooks/rules/`, one hook with its `.catch` in
`hooks/register.ts`, one row above.
