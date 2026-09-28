# sec-default

The security default for organizations. Function hooks give every plugin a
say on every event, in chain order, and the plugins a person installs sit
in the user tier, beneath the organization's prepend tier and above its
append tier. Some of what an organization sets today (its classic hooks,
its managed CLAUDE.md and rules, its settings, its MCP allowlist) was never
within a person's reach before function hooks; seated outermost, this
plugin keeps exactly those out of the user tier's reach and adds no policy
of its own. Everything else passes through untouched.

It has three moves and nothing else: continue past the user tier
(`next.to(e, "append")`), refuse a user-tier caller by name (`{ deny }`
when `next.origin.tier` is `user`), or pass (`next(e)`). A subject's
provenance is the event's pinned `e.provider`; policy is read through
`$.settings.read({ source: "policy" })`, one read serving a burst; both
fail closed, so an unreadable policy counts as a policy in force.

`hooks/register.ts` is the module; `hooks/policy/` reads the managed
settings it decides by.

## The rows

| event | from the outermost seat |
| --- | --- |
| `classic.*` | Continue past the user tier: the organization's settings hooks see the engine's input and their answer stands. |
| `prompt.section`, `prompt.context`, `skill.prompt`, `attribution.text` | Continue past the user tier: managed CLAUDE.md, rules and policy skills reach the model as written. A person's plugins keep `prompt.submit` and its additive context. |
| `session.append` | Continue past the user tier: the rows a conversation keeps (a settings hook's context among them) are stored and sent as the organization's tiers and the built-ins left them. A person's plugins keep `prompt.submit`, `tool.call` and the other events that shape a row before it is kept. |
| `settings.read` | Continue past the user tier: no user hook rewrites what any caller reads as settings, this plugin's own policy reads included. |
| `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn` | When the subject's pinned `e.provider.tier` is `prepend` or `append` (a policy-installed plugin, the managed folder, a policy MCP server), continue past the user tier; a subject provided by `user`, `builtin` or `core` passes. |
| `tool.register` | A caller in `prepend` or `append` continues past the user tier. A `user`-tier caller is refused by name while managed settings hold `allowedMcpServers` (set at all, empty included); otherwise it passes. |
| `tool.list` | The tools of the organization's managed MCP servers are listed as the organization's tiers listed them; every other tool as the user tier left it. With no policy to read, or a refusal from either listing, the organization's listing stands whole. |
| everything else | Passes: `prompt.submit`, `turn.*`, `tool.call`, `tool.check`, `command.run`, `command.register`, `session.*` other than `session.append`, `ui.*`, `fs.*`, `http.fetch`, `process.run`, `store.*`, `clock.*`, `model.*`, `mcp.call`, `audio.*`, `agent.list`, `engine.create`. |

## What it hooks

`classic.*`, `prompt.section`, `prompt.context`, `skill.prompt`,
`attribution.text`, `settings.read`, `tool.describe`, `command.describe`,
`agent.offer`, `agent.spawn`, `tool.register`, `tool.list`,
`session.append`.

## What it calls on `$`

`settings.read`. It continues to the `append` tier with `next.to`, which
only a plugin in a managed tier may do.

## Where it is seated

The CLI seats it first in the prepend tier wherever hooks modules load on a
machine with managed settings or for a Team or Enterprise organization,
unless managed settings define `prependPlugins`: then that list is the
whole prepend tier, and the organization names `sec-default@builtin` in it
at the position it wants, e.g. `"prependPlugins": ["acme-guard@acme-tools",
"sec-default@builtin"]`, or leaves it out. It is a plugin folder like any
other, but its one move that matters, `next.to`, is refused outside a
managed tier, so loading it with `--plugin-dir` seats a plugin that can
only pass.
