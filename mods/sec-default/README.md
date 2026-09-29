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
(`next.to(e, "append")`), refuse a user-tier caller or module by name
(`{ deny }` when `next.origin.tier` is `user`, `{ refuse }` when a module's
pinned `e.tier` is), or pass (`next(e)`). A subject's provenance is the
event's pinned `e.provider`; policy is read through
`$.settings.read({ source: "policy" })`, one read serving a burst of tool
calls; both fail closed, so an unreadable policy counts as a policy in force.

`hooks/register.ts` is the module; `hooks/policy/` reads the managed
settings it decides by.

## The rows

| event | from the outermost seat |
| --- | --- |
| `classic.*` | Continue past the user tier: the organization's settings hooks see the engine's input and their answer stands. |
| `prompt.section`, `prompt.context`, `skill.prompt`, `attribution.text` | Continue past the user tier: managed CLAUDE.md, rules and policy skills reach the model as written. A person's plugins keep `prompt.submit` and its additive context. |
| `settings.read` | Continue past the user tier: no user hook rewrites what any caller reads as settings, this plugin's own policy reads included. |
| `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn` | When the subject's pinned `e.provider.tier` is `prepend` or `append` (a policy-installed plugin, the managed folder, a policy MCP server), continue past the user tier; a subject provided by `user`, `builtin` or `core` passes. |
| `tool.register` | A caller in `prepend` or `append` continues past the user tier. A `user`-tier caller is refused by name while managed settings hold `allowedMcpServers` (set at all, empty included); otherwise it passes. |
| `tool.list` | The tools of the organization's managed MCP servers are listed as the organization's tiers listed them; every other tool as the user tier left it. With no policy to read, or a refusal from either listing, the organization's listing stands whole. |
| `plugin.register` | A hooks module in the `user` tier (one a person installed, named with `--plugin-dir`, or keeps in their mods folder) is refused while managed settings set this plugin's `allowManagedModsOnly` option; otherwise it passes. Modules in `prepend`, `append` and `builtin` are never asked about. |
| everything else | Passes: `prompt.submit`, `turn.*`, `tool.call`, `tool.check`, `command.run`, `command.register`, `session.*`, `ui.*`, `fs.*`, `http.fetch`, `process.run`, `store.*`, `clock.*`, `model.*`, `mcp.call`, `audio.*`, `agent.list`, `engine.create`. |

## Options an administrator sets

One, in managed settings, under this plugin's own `pluginConfigs` entry,
keyed by the id the CLI builds the plugin in under (only this spelling of the
id is read):

```json
{
  "pluginConfigs": {
    "cc-plugin-sec-default@builtin": {
      "options": { "allowManagedModsOnly": true }
    }
  }
}
```

`allowManagedModsOnly`: only the mods the organization deploys through
managed settings, and the ones built into Claude Code, load. A hooks module
a person installed, named with `--plugin-dir` or keeps in their mods folder
is refused whenever it loads or reloads (one already running when the option
is set keeps running until then), with one line that names it: `mods are
limited to your organization's by policy (allowManagedModsOnly); <plugin>
was not loaded`
(in the debug log, and on screen where the session hot-reloads the mod's
folder). A plain `-p` run has it in the debug log alone; the mod is still
not loaded. Settings hooks, status lines and `/goal` are not touched by it.

- The decision reads the tier the CLI pins on the module and nothing the
  module says of itself: a person's copy carrying an organization mod's name
  is still in the `user` tier and is refused.
- Refused means nothing of the module joins: no hook, no tool, no command.
  Its top-level code has run once by then, in the closed context every hooks
  module is evaluated in, with no call on `$` served.
- Only managed settings are read (`$.settings.read({ source: "policy" })`):
  the same entry in a person's, a project's or a `--settings` file neither
  turns it on nor off. On unless absent or `false`, so a mistyped `"true"` or
  `1` still locks. A value the settings schema rejects (`null`, an object),
  here or in any other `pluginConfigs` entry, makes the CLI ignore the whole
  `pluginConfigs` key with a settings warning, and the option reads as unset.
- It fails closed: when the read of managed settings is refused (a hook beneath
  denies it) or this plugin's hook fails, its `.catch` refuses the module,
  with the same line, and names the failure in the debug log; so a policy
  that cannot be read keeps every person's mod out at load. Where this plugin
  is not seated there is no such rule, and mods load as they do without it.
- Where managed settings define `prependPlugins`, that list must name this
  plugin (next section) for the option to apply.
- `claude plugin test` is not covered: it runs a mod's tests in an engine of
  their own and loads nothing into a session.

## What it hooks

`classic.*`, `prompt.section`, `prompt.context`, `skill.prompt`,
`attribution.text`, `settings.read`, `tool.describe`, `command.describe`,
`agent.offer`, `agent.spawn`, `tool.register`, `tool.list`,
`plugin.register`.

## What it calls on `$`

`settings.read`, and `ui.log` to the debug log. It continues to the `append`
tier with `next.to`, which only a plugin in a managed tier may do.

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
