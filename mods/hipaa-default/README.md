# hipaa-default

For an organization under HIPAA. A mod's own call and a settings hook's call
are their author's code, and Claude Code does not hold them to the rules it
holds the model to. This mod holds them to what an administrator blocked or
denied, unless the code is the organization's own.

| Rule | Event | What it holds |
| --- | --- | --- |
| [`blocked-tool`](hooks/rules/blocked-tool.ts) | `tool.check`, where `ceiling` is `deny` | Refuses the call of a person's mod or a built-in one, by any road, and of a settings `mcp_tool` hook not known as the organization's, which is skipped while the call it guards goes on. The refusal names the tool. |
| [`unread-ceiling`](hooks/rules/unread-ceiling.ts) | `tool.check`, where `isCeilingUnread` is set | Refuses the same callers where the call could not be matched against the deny rules in managed settings. |

`ceiling` is `deny` on an MCP tool that is blocked for the organization or the
member's role, that a host marks `always_deny`, or that a deny rule in managed
settings names. A rule or a switch of the person's or a repository's is not a
block.

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
for the model. Not held: a mod's `$.process` and `$.fs`, a shell form that
Claude Code only asks the model's user about, and a rule that a tool applies
only while it runs. A `Grep` or `Glob` over a folder that a managed `Read` rule
reaches under is refused whole, as unread.

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
