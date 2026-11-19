# sec-default

The security default for organizations. Function hooks give every plugin a
say on every event, in chain order, and the plugins a person installs sit
in the user tier, beneath the organization's prepend tier and above its
append tier. Some of what an organization sets today (its classic hooks,
its managed CLAUDE.md and rules, its settings, its MCP allowlist, the deny
rules and permission prompts in force on its machines) was never within a person's plugin's reach before
function hooks; seated outermost, this plugin keeps exactly those out of the
user tier's reach, and keeps a person's mod from carrying out the model's call
before the permission check allowed it. Everything else passes through untouched.

It has three moves and nothing else: continue past the user tier
(`next.to(e, "append")`), refuse a user-tier caller or module by name
(a `deny` when `next.origin.tier` is `user`, `{ refuse }` when a module's
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
| `prompt.section`, `prompt.context`, `prompt.attachment`, `skill.prompt`, `attribution.text` | Continue past the user tier: managed CLAUDE.md, rules and policy skills, and what the engine injects for the model beside them (a settings hook's note, the instruction files, a mode's reminder), are not a person's plugin's to reword at these events. A person's plugins keep `prompt.submit` and its additive context. This does not cover the variables that turn off CLAUDE.md loading: a person's plugin or settings can set `CLAUDE_CODE_DISABLE_CLAUDE_MDS`, `CLAUDE_CODE_SIMPLE` or `CLAUDE_CODE_SAFE_MODE`, and no CLAUDE.md loads, the managed one included. |
| `session.append` | For a row the engine injects for the model (the `attachment` and `hook-context` doors: a reminder, a settings hook's context), for a compaction's rows (the `compaction` door: its summary and boundary), for a skill's body as a call of the Skill tool hands it over (the `tool-message` door, that tool's rows alone, since the row does not say whose skill it is) and for a note an organization's plugin appends, continue past the user tier: the row is kept as made, so what passed `prompt.attachment` whole is not blanked or reworded on its way into the conversation. For a skill the hold does that much and no more: it stops rewording of the row in transit. A person's `tool.call` hook can still answer for a Skill call or swap `input.skill`, as it can for any tool; `allowManagedModsOnly` closes that. Every other row (a prompt, a response, a tool result, another tool's message, a delivery, a command's row, a notice, a note of a person's plugin, and a note the engine itself makes, a Stop hook's feedback among them) passes as the chain leaves it. What is held of a hook is its verdict and the context it adds; the words a hook's block feeds back to the model are such an engine-made note. |
| `session.compact` | Continue past the user tier, whole: a conversation a person's plugin answers in place of a compaction is never installed, so the conversation a compaction leaves is the engine's or the organization's own making, and its summary is stored as made (the `session.append` row). A person's own compaction hook does not run where this plugin is seated; a plugin of theirs may still ask for a compaction, which the engine then makes. |
| `prompt.compose` | Continue past the user tier: the system prompt's list of sections is what the organization's tiers, the built-ins and the engine's own composition make it. A person's plugin neither drops, reorders nor rewrites a section, nor changes the facts the list is composed from, nor answers a list of its own in its place. The engine raises this event only when some loaded plugin hooks it, so where this plugin is seated every render of the system prompt runs the chain. |
| `settings.read` | Continue past the user tier: no user hook rewrites what any caller reads as settings, this plugin's own policy reads included. |
| `telemetry.log` | A record bound for the collector (`to` is `collector`) continues past the user tier, whoever set the collector up: it reaches the exporter as the organization's tiers and the built-ins leave it. A person's hook on that stream does not run where this plugin is seated, and neither does the hook of an organization's plugin left in the `user` tier. |
| `session.identity` | A `user`-tier caller is refused (the call resolves with `deny`), and every other caller continues past the user tier: a person's plugin neither calls, sees nor answers the event. By design, where this plugin is not seated a person's hook sits above `privacy` and can see or answer a call no organization's mod made, and with `privacy` off too a person's plugin is answered. The address already reaches it at `prompt.context`. Under a pin, what it sees includes the organization's fields and the pinned `email`. |
| `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn`, `agent.report` | When the subject's pinned `e.provider.tier` is `prepend` or `append` (a policy-installed plugin, the managed folder, a policy MCP server), continue past the user tier; a subject provided by `user`, `builtin` or `core` passes. So a person's plugin neither rewrites nor consumes the report of an organization's agent, or of a fork of its skill or command. Left over: a fork of an organization's agent reads as `core`, so its report passes; and `provider` for a forked skill or command is that skill's or command's, so a person's own whose `agent:` names an organization's agent reads as `user` at `agent.report`, and this row does not continue past the user tier for it. |
| `tool.offer` | As the row above, and by name as `tool.list` tells an organization's tool: continue past the user tier too for a tool of a server that policy names or delivers (one on `allowedMcpServers` that a person configured among them), a tool of a plugin that policy seats or turns on (one the engine leaves in the `user` tier among them), and every `mcp__` tool where the server file cannot be read. With no policy to read, or if this hook fails before it passes the tool on, every tool continues past the user tier. So a person's plugin cannot keep from a model a tool it could not take off the pool. Any other tool passes. Left over: `provider` here is the tool's, so a person's plugin can still keep a built-in tool from the model inside an organization's agent. The policy is read through the memo, and a loop holds each answer for its life. |
| `tool.register` | A caller in `prepend` or `append` continues past the user tier. A `user`-tier caller is refused by name while managed settings hold `allowedMcpServers` (set at all, empty included). With no allowlist, one is still refused whose tool, called `mcp__<plugin>__<tool>`, would read as a tool of a server the organization delivers: a `managedMcpServers` entry, or a server of the enterprise `managed-mcp.json`, which the policy read names under that key. So is one whose name reads as a plugin the organization seats itself (`prependPlugins`, `appendPlugins`, or an id managed `enabledPlugins` turns on, by `true` or by a version list, as the engine reads an entry), or as an MCP server such a plugin's own manifest declares, which the engine spells under the plugin's scope (`mcp__plugin_<plugin>_<server>__`). A `user`-tier plugin keeps its own name exactly when the id the engine recorded for it (`<name>@<marketplace>`: the settings key the loader resolved, never the plugin's manifest) is one managed `enabledPlugins` turn on, compared as the engine compares ids (NFC, then lower case). That is how an organization's own plugin registers its tools where the engine leaves it in the `user` tier: a copy from a remote marketplace (git, GitHub, npm) is there in a session where its copy does not prove against its install record and no list names it, or where managed settings don't declare that marketplace, and so is one a version list turns on. For an organization that means such a plugin runs among a person's plugins in the chain, not ahead of them, and keeps its tools by this exemption alone. A plugin loaded with `--plugin-dir` is always `<name>@inline` and never matches; nor does a same-named plugin from another marketplace, one whose name only folds to the organization's, or an id policy lists only in `prependPlugins` or `appendPlugins`. A person who registers a marketplace of their own under the organization's marketplace name gets an equal id, and so the exemption: it gives that plugin what every plugin had before this hold existed, and `strictKnownMarketplaces` in managed settings closes it today by allowing no other marketplace source. The mod hears a plugin's id at its admission, so after a load that seats the mod afresh while other plugins stay seated (a load that folds again, as a policy change mid-session can cause) the organization's own plugin is refused its name until the session restarts. A plugin's own MCP servers are connected by the engine from its manifest, not registered through `tool.register`, so they are unaffected. An id's name is everything before its last at-sign. A `managed-mcp.json` that is present and cannot be read whole names nobody: the policy read marks it (`managedMcpServersUnreadable`) and every such registration is refused while it stands, its servers never taken for none; the only other readers of the mark are `tool.list` (the next row) and `tool.offer`, so a person's plugins still load and still set what is not pinned. A server the file names and the engine dropped with a warning is still named; a warning about a server that loads is no failure. Names are compared folded, as a model reads them (spelled as the engine spells a name inside a tool's name, every character outside letters, digits, `-` and `_` a `_` and nothing normalized; then lower case, every run of `-` and `_` one `_`; a seated plugin counts under its name composed and decomposed, since the engine spells its tools from its manifest's own form): a plugin named as the server in any case or with other separators, one whose name and tool together spell it, and one whose tool's own name folds to nothing, is refused. A server whose name folds to nothing (no letter or digit in it) cannot be told from any name, so while the policy names one every `user`-tier registration is refused. The engine pins the tool's name at this event (a hook beneath that hands on another name fails, and the chain goes on without it), so the name judged is the name registered. Otherwise it passes. |
| `tool.list` | What the hooks answer is the session's tool pool, for the model and for every agent. The tools of the organization's managed MCP servers, of the plugins it seats itself and of the MCP servers those plugins' own manifests declare (told by the name whole, as the engine spells it inside a tool's name: `mcp__<server>__`, never by a fold, so another server whose name only begins like the organization's is not taken for it; a seated plugin and its own servers, under its scope `mcp__plugin_<plugin>_`, fold to fold as the registration check compares, so policy may list its id in another letter case, and another plugin whose name begins with the seated one's and a `-` or `_` reads the same) are listed as the organization's tiers listed them, so a person's plugin cannot remove one or reword it. So is a tool a hook of the organization's tiers added, and a tool such a hook removed stays removed, whatever a person's plugin lists and whichever order the hooks ran in. Every other tool is as the user tier left it, a person's rewording of a built-in included, unless an organization's `prepend`-tier plugin hooks `tool.list`: what that plugin added can't be told from what the engine built, so every listed name then keeps the organization's entry. A plugin the organization seats ahead of this mod runs outside it, so this holds no tool that plugin adds. A tool a `user`-tier hook adds is dropped from the answer where the `tool.register` row refuses that hook's plugin a tool: while managed settings hold `allowedMcpServers`, or when its whole name, compared fold to fold as the registration check compares, reads as a tool of a server or a plugin the organization delivers. So is one with no `mcp__` that reads as such a tool with its words joined (`McpCorpExport`), and one whose name differs only in case or in how its words are joined from a name the organization's tiers list. An `mcp__` name is never read that way, so `mcp__corp_tools__x` is not taken for a tool of `corp` by that comparison. A plugin the organization vouches for by its `enabledPlugins` id gets no exception here, since the answer does not say which hook added an entry. Where the server file cannot be read, every `mcp__` tool counts as the organization's and no addition stands. With no policy to read, a refusal from any listing, or a listing with an entry that has no name, the organization's listing stands whole, and a `permissions.deny` of managed settings that is a whole tool or names a server comes off the answer, a name a hook added that reads as it included, in every case but `allowModsToOverrideDenyRules`. The hook matches by name and reads no tool's schema, and it catches its own errors: whatever fails after it has the organization's listing, that listing stands. Only with that listing unread does it refuse, and the engine then keeps the answer that stood. The engine's raise reads the policy afresh; a plugin's `$.tool.list()` reads it through the memo. The guard holds on the listing alone: a person's `tool.call` hook still runs above an organization's on a tool that organization added. A person's hook that crashes the worker or overruns its budget is skipped and this mod still answers: it runs outside the worker, and what runs beneath it has budgets of its own. Such a hook can delay that answer. A turn waits 10 seconds for a raise and then goes on with the answer that stood, so before the first answer lands, an organization's removals through this mod do not stand on that turn. A person's plugin can cause this delay at each raise. If this mod's own hook runs out of time, the engine answers without it for that turn and asks again at the next. A managed deny rule holds either way: the engine applies it. |
| `tool.check` | A person's plugin only tightens. A deny and an ask, whoever answers it, hold whole over the user tier: when a person's plugin rewrote the verdict it was handed without tightening it (a more permissive decision, or the same decision under another reason or with what it names changed), the dispatch is run again past the user tier, and unless the chain's answer is the stricter, that verdict is the answer as the engine gave it. See [Deny rules hold](#deny-rules-hold). The call of a settings `mcp_tool` hook that is or may be the organization's (`next.origin.hookOwner`) goes past the user tier, in the `.catch` too, since a refused hook is skipped. Every other verdict passes as the chain left it. |
| `tool.judge` | A person's plugin only tightens, but for its allow of a call it made itself. See [At the classifier](#at-the-classifier). |
| `tool.call`, `tool.run`, `prompt.submit` | The model's calls pass, and are remembered until they are allowed or the person's next prompt. A `user`-tier `$.tool.call` or `$.mcp.call` that repeats one, or writes or names a settings file, is refused. See [The model's call waits for its check](#the-models-call-waits-for-its-check). |
| `agent.call` | Passes, and is remembered under the plugin that made it, ahead of the hooks beneath. |
| `fs.write`, `process.run`, `process.spawn` | A `user`-tier caller is refused where the effect repeats a remembered call, or writes or names a settings file. Every other passes. |
| `fs.stat` | This plugin's own look at where a path leads continues past the user tier. Every other passes. |
| `ui.log` | A line a plugin in `prepend` or `append` logs, this one's included, continues past the user tier: no user hook rewrites or drops it, and none runs inside the hook that logged it. Every other line passes. |
| `env.get` | A read by a plugin in `prepend` or `append` continues past the user tier: no user hook answers what the organization's own plugin reads. Every other read passes. |
| `env.set` | A write by a plugin in `prepend` or `append` continues past the user tier, whatever the variable: no user hook rewrites or drops what the organization's own plugin sets. A variable managed settings set in `env` (its name in any case) is pinned, and so are `CLAUDE_CODE_PROCESS_WRAPPER` where they name a launcher with `processWrapper` and, always, the nine variables that move where policy and sign-in are read from or how policy's tiers compose (`CLAUDE_CODE_MANAGED_SETTINGS_PATH`, `CLAUDE_CODE_REMOTE_SETTINGS_PATH`, `CLAUDE_CODE_MOCK_REMOTE_SETTINGS`, `CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION`, `CLAUDE_CONFIG_DIR`, `CLAUDE_SECURESTORAGE_CONFIG_DIR`, `USE_LOCAL_OAUTH`, `USE_STAGING_OAUTH` and `CLAUDE_LOCAL_OAUTH_API_BASE`, which choose the server sign-in goes to; all nine on every build), and, on every build too, ten variables that can load code into a child the engine starts (`LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_AUDIT`, `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH`, `DYLD_FRAMEWORK_PATH`, `BASH_ENV`, `ENV`, `ZDOTDIR`, `NODE_OPTIONS`): setting or unsetting it, a `user`-tier caller is refused by name and a built-in's write continues past the user tier. Any other variable is a person's plugin's to set. With no policy to read, every variable counts as pinned. `allowModsToOverrideDenyRules` does not unpin. See [Pinned variables](#pinned-variables). |
| `vcs.detect` | Ask past the user tier first: a working copy the organization's tiers, the built-ins or the engine name stands, and only a folder they find in none goes on to a person's plugins. So a person's plugin drops no Git status block, and a system beside or inside Git needs an organization's plugin. A person's claim on the folder a session starts in does drop the shell tools' commit and pull-request steps for the whole session, a later `cd` into Git included; Git's safety cautions stay in every folder. |
| `vcs.diff` | Ask past the user tier first: what the organization's tiers or the built-ins answer stands, their own `unknown` too, and only a diff none of them answered goes on to a person's plugins. |
| `wasm.compile` | A compile by a plugin in `prepend` or `append` continues past the user tier: no user hook reads or replaces the WebAssembly the organization's own plugin runs. Every other compile passes. |
| `plugin.register` | A hooks module in the `user` tier (one a person installed, named with `--plugin-dir`, or keeps in their mods folder) stays out while managed settings set this plugin's `allowManagedModsOnly` option: the plugin continues past the user tier with `provides.modules` emptied, or, in a dev-mods folder, is refused whole. While they set its `forceHotReloadPrompt` option, a plugin in a session's dev-mods folder is asked about, with a hooks module or without one, unless a person already said yes to that folder here. Otherwise a plugin whose id managed settings turn on in `enabledPlugins` or list in `prependPlugins` or `appendPlugins`, or one the event marks `requiredByOrganization`, continues past the user tier, so a person's mod can't refuse or narrow it and the organization's prepended and appended mods still judge it. Every other plugin passes. The limits: a namesake under the organization's id only escapes the person's own judges (the `user` tier's, where an organization's unlisted mod whose copy does not prove sits too), and `allowManagedModsOnly` still keeps out its module (the host's mark stays on the folder the host named, and an unmarked copy of that name doesn't load); a synced plugin (`@synced`) claude.ai marks Required, a host-delivered copy (`@inline`) its host doesn't mark and a dependency that policy doesn't name aren't covered, as the event carries no mark for them; a person's `plugin.register` hook gets the engine's "was skipped" line when an organization's plugin is judged (for one judged with its module at a load, the debug log alone has it). Plugins in `prepend`, `append` and `builtin` are never asked about, a marked one with no hooks module that is shown to be outside every dev-mods folder among them. A refusal refuses the whole plugin. |
| everything else | Passes: `turn.*`, `command.run`, `command.register`, `command.list`, `agent.register`, `config.*`, `prompt.fill`, `prompt.suggest`, `prompt.edit`, `prompt.read`, `session.*` but `session.append`, `session.compact` and `session.identity`, `ui.*` but `ui.log`, `fs.*` but `fs.write` and `fs.stat`, `http.fetch`, `store.*`, `clock.*`, `model.*`, `mcp.call`, `audio.*`, `agent.list`, `engine.create`. |

## Options an administrator sets

Four, in managed settings, under this plugin's own `pluginConfigs` entry,
keyed by the id the CLI builds the plugin in under (the plugin reads only this
spelling; from a host's `--managed-settings` the CLI also takes a restriction
under the earlier id, `sec-default@builtin`):

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
stays out whenever it loads or reloads (one already running when the option
is set keeps running until then). A plugin with no hooks module passes, and so
does a module that scans empty: neither has a hook or a `$`, the only way a
module touches anything. A plugin whose module does not load passes the same way:
the module does not run, and its other parts do. The debug log has one line that
names the option: `mods are
limited to your organization's by policy (allowManagedModsOnly); <plugin>
was not loaded`. On screen, where the session hot-reloads the mod's folder or the
mod was running, and in `/plugin`, the CLI's own line names this plugin:
`hooks module left out by cc-plugin-sec-default`. A plain `-p` run has both in the
debug log alone; the mod is still not loaded. Settings hooks, status lines and `/goal` are not touched by it.

- The decision reads the tier the CLI pins on the module and nothing the
  module says of itself: a person's copy carrying an organization mod's name
  is still in the `user` tier and stays out.
- Only the module stays out: no hook, tool or command of it joins. The plugin
  continues past the user tier with `provides.modules` emptied, so its other parts
  load unless the organization's prepended or appended mods refuse or narrow it; a
  person's mods are not asked. An organization's plugin that no list seats is in
  the `user` tier too: it loses its module and keeps its command hooks. The module's
  top-level code still runs once, in the closed context every hooks module is
  evaluated in, with no call on `$` served.
- A plugin in a dev-mods folder is refused whole, with the option's line as the
  reason: no command hook, MCP or LSP server, skill, command, agent, output style,
  theme, monitor, setting or `bin/` of it takes effect either. A monitor armed
  before a later refusal runs on.
- Only managed settings are read (`$.settings.read({ source: "policy" })`):
  the same entry in a person's, a project's or a `--settings` file neither
  turns it on nor off. A host that starts Claude Code with `--managed-settings`
  can turn it on there and cannot turn it off. An administrator's own value under
  the current id, `false` included, stands over the host's, and the host's whole document is left
  out where an administrator's managed settings apply and do not set
  `parentSettingsBehavior` to `"merge"`. On unless absent or `false`, so a mistyped `"true"` or
  `1` still locks. A value the settings schema rejects (`null`, an object),
  here or in any other `pluginConfigs` entry, makes the CLI ignore the whole
  `pluginConfigs` key with a settings warning, and the option reads as unset.
  From a host, the option is still read where the rejected value is another one.
- It fails closed: when the read of managed settings is refused (a hook beneath
  denies it) or this plugin's hook fails, its `.catch` keeps the module out
  the same way, with the same line, and names the failure in the debug log; so a policy
  that cannot be read keeps every person's mod out at load. A plugin that uses
  nothing still passes, unless it sits in a dev-mods folder. Where this plugin
  is not seated there is no such rule, and mods load as they do without it.
- Where managed settings define `prependPlugins`, that list must name this
  plugin (next section) for the option to apply.
- `claude plugin test` is not covered: it runs a mod's tests in an engine of
  their own and loads nothing into a session.

`forceHotReloadPrompt`: an organization that keeps mods also keeps a question
before the mods Claude writes turn on. In bypass, and in auto while its classifier
runs, those mods load with nobody asked, so on a managed machine code the model
wrote would run unasked. While the option is on, this plugin asks about a session's
dev-mods folder (`dev-mods/<session id>` under the config home) as a plugin in it
loads, with a hooks module or without one, whether or not its module loads, in any
mode:

- It reads no mode. In default, acceptEdits and plan, two questions are expected:
  the engine's about the folder, then this one, which names the organization. In
  bypass, and in auto while its classifier runs, this is the only question.
- `Turn them on` loads the folder's mods in that session. `Not now` refuses them,
  with `you answered Not now (forceHotReloadPrompt); <plugin> was not loaded`. The
  answer stands for the process, so a reload on each edit does not ask again.
- A yes is kept in this plugin's `$.store` under the folder, so a resume, which
  keeps the session's id, asks nothing. A fork has an id of its own, and with it a
  folder no yes covers. Only a yes is kept. If the write fails, the yes still stands
  for the process; if the read fails, this plugin asks.
- A yes covers later edits and later mods in the folder: what Claude writes there
  afterwards loads without another question.
- With nobody to answer (`claude -p`, no session bound yet, the question rejected
  or dismissed), the mod is refused with `nobody answered the question about it
  (forceHotReloadPrompt); <plugin> was not loaded`, and nothing is kept. So is it
  when this plugin's hook fails, through its `.catch`. A start's first load can
  come before a session is bound: the engine judges such a plugin again once one
  is, and then the person is asked.
- It is read as `allowManagedModsOnly` is: only managed settings, on unless absent
  or `false`. Set or cleared mid-session, it takes effect at the next load that
  judges the plugin. With the option unset, nothing changes.

Known limits:

- The question goes through `$.ui.ask`, so a person's own mod already loaded, or a
  host, can answer it. The yes sits in this plugin's `$.store`, a file under the
  plugins directory that anything running as the person can write, Claude's Bash
  and Write tools in those modes included.
- It covers mods, not what Claude can run through Bash in those modes.
- It covers the session's dev-mods folder, known by its path. A mod Claude writes
  into a `--plugin-dir` or other hot-reload folder, or into the installed-plugins
  store with a registry entry, gets no question from it.
- If the hook stalls on anything but the person's answer, such as a `$.store.get`
  that never settles, the engine cuts it at the site's limit and its `.catch` refuses
  the mod. After a yes, the `.catch` loads it instead if that run's policy read passed
  it or it uses nothing. The `.catch` waits on nothing and runs on the engine's own
  thread, so its grace does not run out.
- If this plugin's own module fails to load, it judges nothing, and mods load unasked.

`allowModsToOverrideDenyRules`: the plugins a person installs may answer
over a settings deny rule on `tool.check`, as they could before this plugin
held deny rules, and over every other deny and every ask with it: the one option
covers all that holds there. Off unless it is the
literal `true`; an option that reads as unset leaves them holding. See
[Deny rules hold](#deny-rules-hold). That section is about a
person's hooks answering `tool.check` or `tool.judge`: a mod's own `$.tool.call` or `$.mcp.call`
is outside it, and `allowManagedModsOnly` is the control over it. The option also lifts all of
[The model's call waits for its check](#the-models-call-waits-for-its-check).

`allowModsToWriteUserSettings`: any mod a person has, one the model wrote into dev-mods
included, may write their user settings file (`settings.json` or `cowork_settings.json` in the
config folder as first read, or the file it links to) by `$.fs.write` or its own Write or Edit,
so it can set `autoMode`, `permissions`, `hooks` and `env` there and remove the person's own deny
rules, also where the host sets `CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG`. It is read as
`allowModsToOverrideDenyRules` is, and lifts nothing else: project and local files, a
process, command or script that names a settings file, and a write while the model's call
on one is not allowed are as without it. Managed values still win, and `allowManagedPermissionRulesOnly`,
`allowManagedHooksOnly` and `forceHotReloadPrompt` are the controls beside it.
Known limits, as the hold is best effort and covers no direct write of a managed file either: a user file that links to a project, local or managed file opens that file, and a `HOME` set before the first read (by a settings `env`, or by a mod ahead of a reload of this plugin) moves the folder.

## What it hooks

`classic.*`, `prompt.section`, `prompt.context`, `prompt.attachment`,
`prompt.compose`, `skill.prompt`,
`attribution.text`, `session.append`, `session.compact`, `settings.read`, `telemetry.log`, `session.identity`, `tool.describe`, `tool.offer`, `command.describe`,
`agent.offer`, `agent.spawn`, `agent.report`, `agent.call`, `tool.register`, `tool.list`, `tool.call`, `tool.run`, `tool.check`, `tool.judge`,
`prompt.submit`, `fs.write`, `fs.stat`, `process.run`, `process.spawn`,
`ui.log`, `env.get`, `env.set`, `vcs.detect`, `vcs.diff`, `wasm.compile`, `plugin.register`.

Hooking `tool.check` has a cost: the engine raises that event only when some
loaded plugin hooks it, so where this plugin is seated every tool call now
runs the `tool.check` chain, where before only a session with such a plugin
did. So has hooking `ui.log`, `env.get`, `env.set`, `session.identity` and `wasm.compile`: each such call of any
plugin's now runs a chain, an `env.set` from outside the organization's tiers waits on
the policy read, as does each `tool.offer` that runs a chain, and a `wasm.compile` carries its bytes as base64.
So has hooking `telemetry.log`: a session raises its event records through the chain even with no collector set up.
Where the copy built into Claude Code is the only plugin that
hooks `env.get`, `command.describe`, `tool.describe`, `tool.offer`, `agent.offer`,
`agent.report`, `attribution.text`, `prompt.section` or `vcs.detect`, a `$.env.get` call and the engine's own
raises of the other eight run no chain: this plugin would only pass the event
on, so the answer is the engine's own. Behind a rollout flag, the same goes for
a `tool.check` on which only that copy's hook could run, if the check succeeds
and no `user`-tier module is loaded.
If it fails, the chain runs and this plugin's `.catch` sees the failure, unless
this copy has been unloaded or replaced meanwhile: then the failure escapes.
`tool.judge` is not raised at all where only that copy's hook could run.
That copy's hooks on `tool.call`, `tool.run`, `agent.call`, `prompt.submit`, `fs.write`, `fs.stat`,
`process.run` and `process.spawn` read as absent until a `user`-tier module loads.
From then on each of those events runs its chain.

## What it calls on `$`

`settings.read`, `ui.log`: to the debug log, and for the one line a person reads
when something held over a plugin of theirs, and `ui.ask` and `store.get` and
`store.set`, for `forceHotReloadPrompt`, and `tool.check`, `fs.stat` and
`env.get`, to tell whether a mod repeats a call or writes a settings file. It continues to
the `append` tier with `next.to`, which only a plugin in a managed tier may
do.

An organization's plugin seated above it in `prepend` can reopen an event
with `next.to(e, "user")`: this mod is then a peer below that hook, and is
skipped. One seated below it reopens nothing, its floor at `append` winning.

A reopen is as wide as the opener's hooks that spell `next.to(e, "user")`, by
pattern: the host reads their matcher and door over the dispatch as raised. A
condition inside a hook is not checked, so a mod that shares the hooks worker
can cause the reopen there whether or not the hook took the branch. Where a
member above rewrites the argument into such a matcher, the call fails in the
opener's hook, and the hop and its rewrite go on with the guard in place. A
RegExp is not read past 65,536 characters, and the reopen is refused there.

## Deny rules hold

On `tool.check` any hook may answer any verdict. Where this plugin is seated,
a plugin a person installs never loosens one, on any surface, and may still
tighten one:

- The hook first runs the chain as it is. If no link that may hold a
  person's plugin rewrote the verdict handed up to it (a more permissive
  decision, or the same decision under another reason, rule or hook; a
  tightening is no rewrite), the answer passes: nothing of the person's
  changed anything, and a plugin that only listens, or only tightens, adds no
  run of its own.
  This is read off `next.trace`, whose tiers the engine pins: a link that never
  called `next` is measured against a deny, and since the engine lists
  neighbouring plugins that share a worker as one batch under its first
  member's tier, a `prepend` entry beneath this plugin counts as well as a
  `user` one. Whether a person's plugin did the rewriting is never settled
  here, only by the next step.
- Otherwise it runs the dispatch once more with the user tier left out
  (`next.to(e, "append")`). That verdict never passed through a person's
  plugin, so neither the decision nor the rule it names can have been
  rewritten or erased, and a plugin that answered without calling `next`
  changes nothing: the rules are evaluated in this run. The two runs differ
  by the user tier alone, so where they differ and the chain's answer is not
  the stricter, the user tier rewrote it. A deny or an ask is returned in
  place of the chain's answer whatever decided it. It is returned
  whole, so the reason this event answers, which a person reads in the
  prompt and the engine writes into a refusal, is the engine's, and what it
  names is still named. (The refusal then enters the conversation as a tool
  result, a row a person's plugin may still reword at `session.append`.) A
  stricter answer of theirs (a deny over an ask) stands.
- An ask holds whoever answers it: a terminal's dialog, the IDE pane, the
  desktop app's card, a host, or nobody. It goes on as it would with no plugin
  loaded: to auto mode's classifier, then to whoever answers. With nobody, a
  plain `-p` run, `dontAsk` and a loop no prompt can show in refuse it, and a
  teammate under a headless leader waits on its leader: the engine's own wait.
- A plugin: an ask a hook makes names the plugin (`plugin`, the engine's
  word, never the hook's), and no classifier's allow settles it. The run past
  the user tier holds no person's plugin, so a plugin named there is a
  built-in or an organization's: that ask holds, and a person's plugin neither
  allows it nor rewords it. A person's own plugin may ask too, over an allow
  or an ask that names nothing (the mode's own, a check of the engine's own
  that no setting turns on): there its ask stands, because it is stricter.
  Over an ask that names a settings rule (`rule`), a classic hook (`hook`), a
  setting whose own check asked (`setting`), an organization's ask cap on the
  tool (`ceiling`) or a plugin, whoever configured it, and over one a host
  answers (`e.approver` is `host`), it is held, with the notice. As for any hook's
  ask, a rule for the whole tool is not kept; a narrower rule the person saves
  is theirs and settles nothing while the hook asks.
- The setting the engine names today is the read block's
  (`permissions.blockReadsOutsideWorkingDirectories`), for the two asks the
  block keeps for the person: about a shell command that reads outside the
  working directories, and, while the block is on, about a command the model
  wants run outside the sandbox, which is what holds its reads in. The file
  tools refuse such a read outright, and a deny holds as it is.
- An organization's plugin (prepend or append) or a built-in that allows
  over a deny rule takes part in both runs, so its answer stands (a prepended
  one that loosens is what brings the second run about, so its hooks run
  twice on such a call).
- `tool.check` pins the question (`tool`, `input`, `tool_use_id`), so no hook
  can have the rules evaluated on one command and another run; a rewrite
  belongs to `tool.call`, which runs before any of this.
- The person is told once for each name and kind in a session, in the
  transcript and the debug log: `<plugin> tried to lift a deny rule in your
  settings from a <tool> call (<rule>); the deny rule holds over the plugins
  you install (allowModsToOverrideDenyRules)`, or `tried to reword` where
  the decision was kept and its words or its rule were not. The kinds are `a deny rule`,
  `an ask rule`, `a <event> hook's ask`, `a <key> setting's ask`, `a
  <plugin>'s ask`, `an ask cap`, `a permission prompt` (an ask that names nothing) and `a refusal` (a deny that names no rule); only the two rule kinds
  carry `in your settings` and a rule. Plugins the
  engine ran as one
  batch are named together, as it names them (`audit+easy`). A plain `-p`
  run has it in the debug log alone; the call is still denied, or asked
  about, with its own message. The line goes past the user tier (the `ui.log`
  row): a hook of theirs that heard it would run inside this plugin's own
  `tool.check` hook, and the engine leaves a hook out of whatever is raised
  from inside it.
- What this does not reach: a held ask is still an ask, so whatever answers
  asks for the person answers it, a classic `PermissionRequest` hook of
  theirs included (`allowManagedHooksOnly` is the control for those). Nor a
  session where this plugin is not seated.
- It does not reach a person's classic `PreToolUse` hook that allows
  either: the engine then raises no ask at all, `tool.check` never runs, and
  the host is not asked. That is the same with no plugin loaded.
- If the hook itself fails, its `.catch` answers from the one run it can
  read: a verdict no plugin of the person's rewrote stands, one they
  tightened included; one they rewrote, or a run that rejected, is refused
  in this plugin's own words, since the rules and hooks were never consulted.

An organization that wants the plugins its people install to override deny
rules, and all else that holds with them, says so in managed settings, under
this plugin's own options:

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
policy that cannot be read leaves them all holding. So does a policy no
administrator composed: where the only policy is a document the person can
write themselves (the Windows `HKCU` hive), or a remote policy the server
has not yet confirmed this session, the option is not taken from it.
That policy still holds what it holds; it grants nothing. A Cowork cloud
session sets the option aside in the settings its organization serves.

## At the classifier

`tool.judge` fires where auto mode is about to ask its classifier, so an allow
there could get what `tool.check` held. Under the same option, by the same two runs:

- A person's plugin's allow never takes the classifier's place. The event does not
  say what stands behind the ask that brought the call there (a server's ask rule,
  a classic hook's ask), so this holds at a dialog too.
- A deny holds over their ask, and a built-in's or an organization's verdict
  over their rewording. Where the classifier gave no verdict their ask stands,
  unless a host answers it or a ceiling caps the tool. Their deny stands.
- Their allow of their own `$.agent.call` passes, with no second run, unless the call
  repeats one of the model's or another plugin's that was not allowed, or writes or names a settings file. The engine
  names a plugin in `next.origin` only on such a call: unrewritten, and not one
  auto mode always judges. An organization's `append` hook on this event does
  not hold over it; its `tool.check` and `tool.call` hooks do, and
  `allowManagedModsOnly` is the control over such a mod.
- A held block goes on as the classifier's own, so what can follow a block
  with no plugin loaded can follow it here, and their ask is not kept for it.

## The model's call waits for its check

A mod's own effects open no dialog and ask no classifier. So a person's mod may not
use one to carry out a call the model sent until that call is allowed. Best effort:
`allowManagedModsOnly` is the control over a mod that means harm.

- **Remembered**: each input the model sends, in any loop, for the newest 256 calls, from
  the moment it is whole. The engine tells the copy built into it by a `tool.call` that runs
  nothing: beneath `turn.step`, so ahead of `session.append` and in a fork too, and as a
  replayed call starts. Where a person's mod hooks `turn.step`, a call's input pieces
  reach it together, once told, with empty pieces until then, and a batch call's do not reach it. It is forgotten at `tool.run`, ahead of the hooks
  beneath, and so is an earlier one like it. One that was refused, answered by a hook,
  dropped or rewritten away stays until the person's next prompt, and so does one
  routed to another machine. A prompt queued while a call is under way clears neither
  it nor what was rewritten away from it. A write is matched by its file: one
  whose content was edited is forgotten once a write to that file is allowed. A plugin's
  `$.agent.call` is remembered the same way from `agent.call`, and is matched against
  every person's mod but the plugin that made it; each maker's newest 256 are kept.
  Its allow clears and excuses that plugin's own calls alone, and one made under a
  tool's alias stays until the person's next prompt.
- **Matched**: a `$.tool.call` or `$.mcp.call` of the same tool on the same arguments; a
  `$.tool.call` of a tool that runs a command or a script (Bash, PowerShell, Monitor,
  REPL, the desktop's workspace shell) whose input holds a remembered command or text whole; a write to the file of a
  remembered Write, Edit or NotebookEdit; a process whose argv is the command or ends in
  it, or that hands a remembered command or text whole, in argv or stdin, to a shell, an
  interpreter or a wrapper on one short list (`hooks/early-run/process-repeats.ts`). What follows a
  script's file there is that script's data, so a gate that reads the command passes
  (a path that starts `/dev/` or ends in `stdin` or `fd/<number>`, dots and doubled slashes taken out, is no script's file,
  and neither is what follows an interpreter named by an argv item that holds a line break),
  and so does the text of an allowed call under way (of a tool that runs no code,
  for the same argument only). Letter case folds in a text that is run; what an allow clears is exact.
- **Decided** by `$.tool.check` past the user tier, on the rules alone, as Bash where an
  `mcp__` tool's text goes to a shell. An allow passes. Anything else is refused in one
  line that names `tool.run`, where a mod serves a call that was allowed. A repeated
  `$.agent.call` is not refused: it is checked as the model's call is.
- **Scripts**: a REPL script the model sent stays remembered until the person's next
  prompt, allowed or not, and a match is refused with no rule asked: an allow rests on
  the session checking the calls the script makes. A mod passes it on with `next`.
- **Settings files**: a person's mod writes none (a person's, a project's, the local
  one) by `$.fs.write` or its own Write or Edit, and runs no process or command or
  script call that names one, but for an allowed command under way, and for the user
  file under `allowModsToWriteUserSettings`. It reads settings
  with `$.settings.read`.

A failure refuses only what matched. With no match no policy is read.

Known limits: a command that is encoded, split, written to a file first or handed over
in the environment, a script that disguises the command, wrappers off the list,
other quoting or an added argument, other MCP tools that run code, a host's declared ones among them,
a settings file's path built in pieces, links and other aliases of a path, calls older than the
newest 256, what an input holds past its first 10,000 values, a reload of this plugin, which forgets what it
remembered, the model's text and thinking, which are not calls, a server tool's input, an input that is not JSON, a call with no input before its block ends,
a restored or handed-over row before its replay starts, a remote session's rows, a script's preview while it
streams, the reply under way when a person's first mod loads, `tool.offer` at a call, prompt rewrites, a person's hook that rewrites an effect beneath this
plugin, a plugin's command hooks and MCP servers, and `$.http.fetch`. The rules asked
are the session's, not a subagent's own.

## Pinned variables

`$.env.set` writes the session's own environment. A variable managed
settings set in `env` is the organization's to decide, so this plugin
refuses a person's plugin that sets or unsets one (the `env.set` row). It
refuses the same of the launcher's variable where policy names a launcher,
and, on every build and whatever managed settings hold, of the nine
variables that move where policy and sign-in are read from: a write of one
would point a later load or launch at another policy. An
organization's own plugin's reads, writes and log lines continue past the
user tier's hooks (the `env.get`, `env.set` and `ui.log` rows).

It refuses the same of ten variables that can load code into a child the
engine starts, a managed hook's command among them: the loader's
(`LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_AUDIT`, `DYLD_INSERT_LIBRARIES`,
`DYLD_LIBRARY_PATH`, `DYLD_FRAMEWORK_PATH`), a shell's start file
(`BASH_ENV`, `ENV`, `ZDOTDIR`) and the runtime's options (`NODE_OPTIONS`).
Each reaches some children, not all: `BASH_ENV` a bash that is not
interactive, `ENV` an interactive shell in sh mode, `NODE_OPTIONS` a Node
child, and macOS drops the `DYLD_` names for protected binaries.
That pin is a list, not a boundary. A person's plugin can start a process
as the person by other roads, and other variables steer a child too
(`PATH`, the home variables, a credential file's path). The pin keeps the
organization's hook commands and tools from being re-pointed by accident
or by a careless plugin, not by a hostile one.

- At a load, from the first admission until the set serves, an op a plugin
  makes (one it left running between the load's steps too) is raised through
  the plugins admitted so far, this one first: a pinned variable is
  refused to a person's `plugin.register` hook then as at any later time.
- What this does not reach: a variable that managed `env` does not set and
  that is not among those names is a person's plugin's to write, and the
  children the engine starts afterwards (Bash, an MCP server, `$.process.run`,
  a person's own hook) start from the environment as written.
- A hook the organization defines is the exception: one in managed settings,
  one of a plugin managed settings install, and the managed status line and
  file suggestion commands. A plugin counts as one managed settings install
  only when it is read in place from a folder those settings name; a plugin
  they merely enable by id, loaded from a copy on the person's machine (a
  marketplace download, or the person's own folder under that id), is not
  treated as the organization's, for its hooks or for its writes. The
  organization's hook's command starts from the environment, and is
  wrapped in the `CLAUDE_CODE_SHELL_PREFIX`, as they stood before any write a
  person's plugin made with `$.env.set` in this process: a variable such a
  plugin set or deleted reads as it did before, absent if it was absent. A
  managed HTTP hook's header variables are read the same way, and so is the
  time allowed to the hooks that run as a session ends. What an
  organization's plugin writes still reaches the hook, also where it writes
  a variable a person's plugin wrote first; a value a later settings reload
  puts over the person's plugin's value stands too. A plugin built into the
  CLI counts here as a person's does, this one in its seat apart. A write
  counts as the organization's only when no person's plugin stands behind
  it. A write made while serving a person's plugin, or in a call a person's
  plugin raised, is a person's; so is an organization's write whose value a
  hook changed before it was made.
- A person still decides the environment Claude Code starts in (`PATH`,
  `LD_PRELOAD`, `CLAUDE_CODE_SHELL_PREFIX` are theirs to set before launch,
  and in their own settings files), and a managed hook starts from that
  environment like every other child. The same holds for the proxy and
  certificate, credential, provider and home variables (`HTTPS_PROXY`,
  `NODE_EXTRA_CA_CERTS`, `ANTHROPIC_API_KEY`, `HOME` and their like): they are
  not pinned, because a person sets the same ones in their own settings and
  shell, so a pin on `env.set` would not close that road. Where that road is
  closed, the engine closes it for a plugin too, with or without this
  plugin seated: in a session that asks its organization for its settings (a
  Cowork cloud session), a plugin, built in or not, sets or unsets only a
  variable the filters on every settings `env` would let a person's own
  settings file set there, and any other write (the proxy and certificate
  variables among them) is held and answered `{ deny }`. A plugin the
  container's managed settings enable is held alike: the session may be able
  to write that file. So is a write, or an unset, of a name any settings tier
  above the person's sets there (the project's, the local, a `--settings`
  file's or the organization's own settings `env`). An organization
  pins the variables its hooks rely on by setting them in managed `env`. An
  organization's plugin's `$.env.get` is answered past the user tier's hooks,
  with the environment as written.

## Where it is seated

The CLI seats it first in the prepend tier wherever hooks modules load on a
machine with managed settings or a managed-mcp.json, for a Team or
Enterprise organization, or wherever the HIPAA mod is on (right behind it),
unless managed settings define `prependPlugins`: then that list is the
whole prepend tier, and the organization names `sec-default@builtin` in it
at the position it wants, e.g. `"prependPlugins": ["acme-guard@acme-tools",
"sec-default@builtin"]`, or leaves it out. Once seated by the machine's
managed settings, the plan or that mod, it stays seated until the session ends: a
plan that reads differently at a later reload (a token variable a plugin
set, an `apiKeyHelper` that appeared in a person's settings, another
sign-in) does not unseat it. How a person signs in before a launch is
theirs, so a seat that rests on the plan alone follows the sign-in at the
next launch; managed settings on the machine are what hold it there. The
organization's own `prependPlugins` list still decides at every reload,
with one exception: a Cowork cloud session that asks its organization for
its managed settings seats it by default, and there a `prependPlugins` list
that leaves it out does not unseat it. The only such list a session there
can hold is a file's in its container, which the session can write as well
as its environment can, so it may add a hold and never lift one. That
default ends once Anthropic's settings route has answered that nothing is
set, the server has named a Free, Pro or Max plan for the launch's login and
that login's organization is the one the host launched the session for, and
the host's plan variable agrees or is absent: it is then known that nothing seats it, as in the
terminal, and a policy served later brings it back. It
is a plugin folder like any
other, but its one move that matters, `next.to`, is refused outside a
managed tier, so loading it with `--plugin-dir` seats a plugin that can
only pass.
