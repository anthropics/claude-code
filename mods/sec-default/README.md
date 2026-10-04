# sec-default

The security default for organizations. Function hooks give every plugin a
say on every event, in chain order, and the plugins a person installs sit
in the user tier, beneath the organization's prepend tier and above its
append tier. Some of what an organization sets today (its classic hooks,
its managed CLAUDE.md and rules, its settings, its MCP allowlist, the deny
rules in force on its machines) was never within a person's reach before
function hooks; seated outermost, this plugin keeps exactly those out of the
user tier's reach and adds no policy of its own. Everything else passes
through untouched.

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
| `prompt.compose` | Continue past the user tier: the system prompt's list of sections is what the organization's tiers, the built-ins and the engine's own composition make it. A person's plugin neither drops, reorders nor rewrites a section, nor changes the facts the list is composed from, nor answers a list of its own in its place. The engine raises this event only when some loaded plugin hooks it, so where this plugin is seated every render of the system prompt runs the chain. |
| `settings.read` | Continue past the user tier: no user hook rewrites what any caller reads as settings, this plugin's own policy reads included. |
| `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn` | When the subject's pinned `e.provider.tier` is `prepend` or `append` (a policy-installed plugin, the managed folder, a policy MCP server), continue past the user tier; a subject provided by `user`, `builtin` or `core` passes. |
| `tool.register` | A caller in `prepend` or `append` continues past the user tier. A `user`-tier caller is refused by name while managed settings hold `allowedMcpServers` (set at all, empty included); otherwise it passes. |
| `tool.list` | The tools of the organization's managed MCP servers are listed as the organization's tiers listed them; every other tool as the user tier left it. With no policy to read, or a refusal from either listing, the organization's listing stands whole. |
| `tool.check` | A deny that a settings rule decided holds over the user tier: when a person's plugin loosened the verdict it was handed, the dispatch is run again past the user tier, and if that verdict is a deny naming its rule, it is the answer. See [Deny rules hold](#deny-rules-hold). Every other verdict passes as the chain left it. |
| `plugin.register` | A hooks module in the `user` tier (one a person installed, named with `--plugin-dir`, or keeps in their mods folder) is refused while managed settings set this plugin's `allowManagedModsOnly` option; otherwise it passes. Modules in `prepend`, `append` and `builtin` are never asked about. |
| everything else | Passes: `prompt.submit`, `turn.*`, `tool.call`, `command.run`, `command.register`, `session.*`, `ui.*`, `fs.*`, `http.fetch`, `process.run`, `store.*`, `clock.*`, `model.*`, `mcp.call`, `audio.*`, `agent.list`, `engine.create`. |

## Options an administrator sets

Two, in managed settings, under this plugin's own `pluginConfigs` entry,
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

`allowModsToOverrideDenyRules`: the plugins a person installs may answer
over a settings deny rule on `tool.check`, as they could before this plugin
held deny rules. Off unless it is the literal `true`; an option that reads
as unset leaves deny rules holding. See [Deny rules hold](#deny-rules-hold).

## What it hooks

`classic.*`, `prompt.section`, `prompt.context`, `prompt.compose`, `skill.prompt`,
`attribution.text`, `settings.read`, `tool.describe`, `command.describe`,
`agent.offer`, `agent.spawn`, `tool.register`, `tool.list`, `tool.check`,
`plugin.register`.

Hooking `tool.check` has a cost: the engine raises that event only when some
loaded plugin hooks it, so where this plugin is seated every tool call now
runs the `tool.check` chain, where before only a session with such a plugin
did.

## What it calls on `$`

`settings.read`, and `ui.log`: to the debug log, and for the one line a
person reads when a deny rule held over a plugin of theirs. It continues to
the `append` tier with `next.to`, which only a plugin in a managed tier may
do.

## Deny rules hold

On `tool.check` any hook may answer any verdict, so a plugin a person
installs to stop the permission prompts (`() => ({ decision: "allow" })`)
would also lift a deny rule, a managed one included. Where this plugin is
seated it does not:

- The hook first runs the chain as it is. If the answer is a deny, or no
  link that may hold a person's plugin answered more permissively than the
  verdict handed up to it, the answer passes: nothing of the person's
  loosened anything, and a plugin that only listens adds no run of its own.
  This is read off `next.trace`, whose tiers the engine pins: a link that never
  called `next` is measured against a deny, and since the engine lists
  neighbouring plugins that share a worker as one batch under its first
  member's tier, a `prepend` entry beneath this plugin counts as well as a
  `user` one. Whether a person's plugin did the loosening is never settled
  here, only by the next step.
- Otherwise it runs the dispatch once more with the user tier left out
  (`next.to(e, "append")`). That verdict never passed through a person's
  plugin, so neither the decision nor the rule it names can have been
  rewritten or erased, and a plugin that answered without calling `next`
  changes nothing: the rules are evaluated in this run. The two runs differ
  by the user tier alone, so a deny here that names its rule is a deny rule
  the user tier loosened, and it is returned in place of the chain's answer.
- Any deny rule counts, whatever settings file it came from: a verdict
  carries the rule as written, never where it was read from. A deny that
  names no rule (a settings hook's, a tool's own check) is not held.
- An organization's plugin (prepend or append) or a built-in that allows
  over a deny rule takes part in both runs, so its answer stands (a prepended
  one that loosens is what brings the second run about, so its hooks run
  twice on such a call). An ask
  that a person's plugin turns into an allow, with no deny rule behind it,
  stands: that is what such a plugin is for.
- `tool.check` pins the question (`tool`, `input`, `tool_use_id`), so no hook
  can have the rules evaluated on one command and another run; a rewrite
  belongs to `tool.call`, which runs before any of this.
- The person is told once for each name in a session, in the transcript
  and the debug log: `<plugin> tried to lift a deny rule in your settings
  from a <tool> call (<rule>); the deny rule holds over the plugins you
  install (allowModsToOverrideDenyRules)`. Plugins the engine ran as one
  batch are named together, as it names them (`audit+easy`). A plain `-p`
  run has it in the debug log alone; the call is still denied with the
  rule's own message.
- If the hook itself fails, its `.catch` answers from the one run it can
  read: a deny stands; a verdict no plugin of the person's loosened stands;
  one they loosened, or a run that rejected, is refused, since the deny
  rules were never consulted.

An organization that wants the plugins its people install to override deny
rules says so in managed settings, under this plugin's own options:

```json
{
  "pluginConfigs": {
    "cc-plugin-sec-default@builtin": {
      "options": { "allowModsToOverrideDenyRules": true }
    }
  }
}
```

Only the managed source is read (`$.settings.read({ source: "policy" })`),
so the same key in a person's, a project's or a local settings file, or in
`--settings`, is never consulted; only the literal `true` counts, and a
policy that cannot be read leaves deny rules holding.

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
