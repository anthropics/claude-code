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
| `prompt.section`, `prompt.context`, `prompt.attachment`, `skill.prompt`, `attribution.text` | Continue past the user tier: managed CLAUDE.md, rules and policy skills, and what the engine injects for the model beside them (a settings hook's note, the instruction files, a mode's reminder), are not a person's plugin's to reword at these events. A person's plugins keep `prompt.submit` and its additive context. |
| `session.append` | For a row the engine injects for the model (the `attachment` and `hook-context` doors: a reminder, a settings hook's context), for a compaction's rows (the `compaction` door: its summary and boundary), for a skill's body as a call of the Skill tool hands it over (the `tool-message` door, that tool's rows alone, since the row does not say whose skill it is) and for a note an organization's plugin appends, continue past the user tier: the row is kept as made, so what passed `prompt.attachment` whole is not blanked or reworded on its way into the conversation. For a skill the hold does that much and no more: it stops rewording of the row in transit. A person's `tool.call` hook can still answer for a Skill call or swap `input.skill`, as it can for any tool; `allowManagedModsOnly` closes that. Every other row (a prompt, a response, a tool result, another tool's message, a delivery, a command's row, a notice, a note of a person's plugin, and a note the engine itself makes, a Stop hook's feedback among them) passes as the chain leaves it. What is held of a hook is its verdict and the context it adds; the words a hook's block feeds back to the model are such an engine-made note. |
| `session.compact` | Continue past the user tier, whole: a conversation a person's plugin answers in place of a compaction is never installed, so the conversation a compaction leaves is the engine's or the organization's own making, and its summary is stored as made (the `session.append` row). A person's own compaction hook does not run where this plugin is seated; a plugin of theirs may still ask for a compaction, which the engine then makes. |
| `prompt.compose` | Continue past the user tier: the system prompt's list of sections is what the organization's tiers, the built-ins and the engine's own composition make it. A person's plugin neither drops, reorders nor rewrites a section, nor changes the facts the list is composed from, nor answers a list of its own in its place. The engine raises this event only when some loaded plugin hooks it, so where this plugin is seated every render of the system prompt runs the chain. |
| `settings.read` | Continue past the user tier: no user hook rewrites what any caller reads as settings, this plugin's own policy reads included. |
| `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn` | When the subject's pinned `e.provider.tier` is `prepend` or `append` (a policy-installed plugin, the managed folder, a policy MCP server), continue past the user tier; a subject provided by `user`, `builtin` or `core` passes. |
| `tool.register` | A caller in `prepend` or `append` continues past the user tier. A `user`-tier caller is refused by name while managed settings hold `allowedMcpServers` (set at all, empty included). With no allowlist, one is still refused whose tool, called `mcp__<plugin>__<tool>`, would read as a tool of a server the organization delivers: a `managedMcpServers` entry, or a server of the enterprise `managed-mcp.json`, which the policy read names under that key. So is one whose name reads as a plugin the organization seats itself (`prependPlugins`, `appendPlugins`, or an id managed `enabledPlugins` turns on, by `true` or by a version list, as the engine reads an entry), or as an MCP server such a plugin's own manifest declares, which the engine spells under the plugin's scope (`mcp__plugin_<plugin>_<server>__`). A `user`-tier plugin keeps its own name exactly when the id the engine recorded for it (`<name>@<marketplace>`: the settings key the loader resolved, never the plugin's manifest) is one managed `enabledPlugins` turn on, compared as the engine compares ids (NFC, then lower case). That is how an organization's own plugin registers its tools where the engine leaves it in the `user` tier: only a copy read in place from a local folder marketplace that managed settings name is vouched for, so a plugin from a remote marketplace (git, GitHub, npm) can never be vouched for in this release, and neither is one a version list turns on. For an organization that means such a plugin runs among a person's plugins in the chain, not ahead of them, and keeps its tools by this exemption alone. A plugin loaded with `--plugin-dir` is always `<name>@inline` and never matches; nor does a same-named plugin from another marketplace, one whose name only folds to the organization's, or an id policy lists only in `prependPlugins` or `appendPlugins`. A person who registers a marketplace of their own under the organization's marketplace name gets an equal id, and so the exemption: it gives that plugin what every plugin had before this hold existed, and `strictKnownMarketplaces` in managed settings closes it today by allowing no other marketplace source. The mod hears a plugin's id at its admission, so after a load that seats the mod afresh while other plugins stay seated (a load that folds again, as a policy change mid-session can cause) the organization's own plugin is refused its name until the session restarts. A plugin's own MCP servers are connected by the engine from its manifest, not registered through `tool.register`, so they are unaffected. An id's name is everything before its last at-sign, as the engine parts ids, so a scoped `@scope/name@npm` counts. A `managed-mcp.json` that is present and cannot be read whole names nobody: the policy read marks it (`managedMcpServersUnreadable`) and every such registration is refused while it stands, its servers never taken for none; the only other reader of the mark is `tool.list` (the next row), so a person's plugins still load and still set what is not pinned. A server the file names and the engine dropped with a warning is still named; a warning about a server that loads is no failure. Names are compared folded, as a model reads them (spelled as the engine spells a name inside a tool's name, every character outside letters, digits, `-` and `_` a `_` and nothing normalized; then lower case, every run of `-` and `_` one `_`; a seated plugin counts under its name composed and decomposed, since the engine spells its tools from its manifest's own form): a plugin named as the server in any case or with other separators, one whose name and tool together spell it, and one whose tool's own name folds to nothing, is refused. A server whose name folds to nothing (no letter or digit in it) cannot be told from any name, so while the policy names one every `user`-tier registration is refused. The engine pins the tool's name at this event (a hook beneath that hands on another name fails, and the chain goes on without it), so the name judged is the name registered. Otherwise it passes. |
| `tool.list` | The tools of the organization's managed MCP servers, of the plugins it seats itself and of the MCP servers those plugins' own manifests declare (told by the name whole, as the engine spells it inside a tool's name: `mcp__<server>__`, never by a fold, so another server whose name only begins like the organization's is not taken for it; a seated plugin and its own servers, under its scope `mcp__plugin_<plugin>_`, fold to fold as the registration check compares, so policy may list its id in another letter case, and another plugin whose name begins with the seated one's and a `-` or `_` reads the same) are listed as the organization's tiers listed them; every other tool as the user tier left it. Where the server file cannot be read, every `mcp__` tool counts as the organization's. With no policy to read, or a refusal from either listing, the organization's listing stands whole. |
| `tool.check` | A deny, an ask a settings rule, a classic hook, a setting's own check or an organization's ceiling on the tool stands behind, and an ask a host answers in the person's place, hold whole over the user tier: when a person's plugin rewrote the verdict it was handed without tightening it (a more permissive decision, or the same decision under another reason or with what it names changed), the dispatch is run again past the user tier, and unless the chain's answer is the stricter, that verdict, if it is a deny or names what stands behind it or the host it is put to, is the answer as the engine gave it. See [Deny rules hold](#deny-rules-hold). Every other verdict passes as the chain left it. |
| `ui.log` | A line a plugin in `prepend` or `append` logs, this one's included, continues past the user tier: no user hook rewrites or drops it, and none runs inside the hook that logged it. Every other line passes. |
| `env.get` | A read by a plugin in `prepend` or `append` continues past the user tier: no user hook answers what the organization's own plugin reads. Every other read passes. |
| `env.set` | A write by a plugin in `prepend` or `append` continues past the user tier, whatever the variable: no user hook rewrites or drops what the organization's own plugin sets. A variable managed settings set in `env` (its name in any case) is pinned, and so are `CLAUDE_CODE_PROCESS_WRAPPER` where they name a launcher with `processWrapper` and, always, the nine variables that move where policy and sign-in are read from or how policy's tiers compose (`CLAUDE_CODE_MANAGED_SETTINGS_PATH`, `CLAUDE_CODE_REMOTE_SETTINGS_PATH`, `CLAUDE_CODE_MOCK_REMOTE_SETTINGS`, `CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION`, `CLAUDE_CONFIG_DIR`, `CLAUDE_SECURESTORAGE_CONFIG_DIR`, `USE_LOCAL_OAUTH`, `USE_STAGING_OAUTH` and `CLAUDE_LOCAL_OAUTH_API_BASE`, which choose the server sign-in goes to; all nine on every build), and, on every build too, ten variables that can load code into a child the engine starts (`LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_AUDIT`, `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH`, `DYLD_FRAMEWORK_PATH`, `BASH_ENV`, `ENV`, `ZDOTDIR`, `NODE_OPTIONS`): setting or unsetting it, a `user`-tier caller is refused by name and a built-in's write continues past the user tier. Any other variable is a person's plugin's to set. With no policy to read, every variable counts as pinned. `allowModsToOverrideDenyRules` does not unpin. See [Pinned variables](#pinned-variables). |
| `plugin.register` | A hooks module in the `user` tier (one a person installed, named with `--plugin-dir`, or keeps in their mods folder) is refused while managed settings set this plugin's `allowManagedModsOnly` option; otherwise it passes. Modules in `prepend`, `append` and `builtin` are never asked about. |
| everything else | Passes: `prompt.submit`, `turn.*`, `tool.call`, `command.run`, `command.register`, `command.list`, `agent.register`, `config.*`, `prompt.fill`, `prompt.suggest`, `prompt.edit`, `prompt.read`, `session.*` but `session.append` and `session.compact`, `ui.*` but `ui.log`, `fs.*`, `http.fetch`, `process.run`, `store.*`, `clock.*`, `model.*`, `mcp.call`, `audio.*`, `agent.list`, `engine.create`. |

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
held deny rules, and over every other deny, an ask rule, a classic hook's
ask, a setting's own ask or an ask a host answers with it: the one option
covers all that holds there. Off unless it is the
literal `true`; an option that reads as unset leaves them holding. See
[Deny rules hold](#deny-rules-hold).

## What it hooks

`classic.*`, `prompt.section`, `prompt.context`, `prompt.attachment`,
`prompt.compose`, `skill.prompt`,
`attribution.text`, `session.append`, `session.compact`, `settings.read`, `tool.describe`, `command.describe`,
`agent.offer`, `agent.spawn`, `tool.register`, `tool.list`, `tool.check`,
`ui.log`, `env.get`, `env.set`, `plugin.register`.

Hooking `tool.check` has a cost: the engine raises that event only when some
loaded plugin hooks it, so where this plugin is seated every tool call now
runs the `tool.check` chain, where before only a session with such a plugin
did. So has hooking `ui.log`, `env.get` and `env.set`: each such call of any
plugin's now runs a chain, and an `env.set` from outside the organization's tiers waits on
the policy read.

## What it calls on `$`

`settings.read`, and `ui.log`: to the debug log, and for the one line a
person reads when something held over a plugin of theirs. It continues to
the `append` tier with `next.to`, which only a plugin in a managed tier may
do.

## Deny rules hold

On `tool.check` any hook may answer any verdict, so a plugin a person
installs to stop the permission prompts (`() => ({ decision: "allow" })`)
would also lift a deny rule, an ask rule or a `PreToolUse` hook's ask, a
managed one included, the read block's ask on a shell command, and the ask a
host was to answer. Where this plugin is seated it does not:

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
  the stricter, the user tier rewrote it. A deny is returned in place of the
  chain's answer whatever decided it; an ask, when it names what decided it,
  a settings rule (`rule`), a classic hook (`hook`), a setting whose own
  check asked (`setting`) or an organization's ask cap on the tool
  (`ceiling`), or names a host that answers it (`decider`). It is returned
  whole, so the reason this event answers, which a person reads in the
  prompt and the engine writes into a refusal, is the engine's, and what it
  names is still named. (The refusal then enters the conversation as a tool
  result, a row a person's plugin may still reword at `session.append`.) A
  stricter answer of theirs (a deny over an ask) stands.
- Any rule, any classic hook, any such setting and any such cap counts,
  whoever configured it: a verdict carries the rule as written, the hook's
  event, the setting's key and the cap, never where any was read from. A
  deny holds unnamed because
  it can stand in front of such an ask: lifted, the call would run with nobody
  asked. An ask that names none of them and that the person answers at a
  dialog (the mode's own, a check of the engine's own that no setting turns
  on) is not held.
- The setting the engine names today is the read block's
  (`permissions.blockReadsOutsideWorkingDirectories`), for the two asks the
  block keeps for the person: about a shell command that reads outside the
  working directories, and, while the block is on, about a command the model
  wants run outside the sandbox, which is what holds its reads in. The file
  tools refuse such a read outright, and a deny holds as it is.
- A host: where the permission callback of the program that runs the session
  answers its asks (an SDK host's `can_use_tool`, a permission prompt tool;
  a cloud session's host is one), the engine's own ask says so
  (`decider: "host"`), in every loop of the process, a subagent's included,
  and only where the host would be asked. Such an ask holds, the mode's own
  too: it goes on to whatever the mode puts between an ask and the host
  (auto mode's classifier) and then to the callback, as it would with no
  plugin loaded. An evaluation the engine has not classified is held.
- Where no host can be asked on an evaluation, it names none, and a
  person's plugin's allow answers as it does with no host. That is a closed
  list, pinned by a test: an in-process teammate's own function (under a
  headless leader its ask is cancelled or never answered); the comment
  auto-edit's own checks (one that is not an allow ends in a notice); the
  observer's gate (an ask there is a deny); a fork, subtask, workflow or
  forked command that has no session function of its own; and a skill's
  inline shell command where no hand-off exists, since an ask then fails
  the render. With a hand-off, in auto mode, that command's ask is left to
  the model's own call, which the host is asked about: it holds.
- An ask that is certain to be refused with nobody asked names no host, so
  a person's plugin's allow answers it as it does in a session no host
  runs: under `dontAsk`, in a loop no prompt can show in (a background
  agent's; in auto mode there, with no chain, the plugin's allow comes
  before the classifier, as it does on main), once a permission prompt
  tool's server has left the session. An ask only a dialog on this computer
  can show holds under a prompt tool and on a served call: the engine denies
  it there, and a plugin's allow does not turn that deny into an allow.
  What is not certain holds: every other mode, a
  Chrome tool's ask under `dontAsk` (a site grant sends it on), and, where
  the host is set to be asked again after every allow auto mode's
  classifier gives, a loop no prompt can show in.
- A call this computer runs for a cloud session names that session as its
  host: its ask goes there and holds. Serving marks nothing for this
  computer's own session: its calls name a host only if one answers them.
- The two hosts the engine knows to show the question to the person on a
  card (the IDE pane, the desktop app's Code tab) are that person's dialog
  and are not named. The session's start says which it is, once, for the
  hold and for the card alike; nothing written later changes it. Only the
  host's own request is such a card: a permission prompt tool's question
  holds in a pane too. The
  entrypoint is asserted by the start environment, not proven: whoever sets
  the environment a session is spawned with can claim a pane.
- An organization's plugin (prepend or append) or a built-in that allows
  over a deny rule takes part in both runs, so its answer stands (a prepended
  one that loosens is what brings the second run about, so its hooks run
  twice on such a call). The mode's own ask
  that a person's plugin turns into an allow, with nothing named behind it
  and the person the one who would have been asked, stands: that is what such
  a plugin is for.
- `tool.check` pins the question (`tool`, `input`, `tool_use_id`), so no hook
  can have the rules evaluated on one command and another run; a rewrite
  belongs to `tool.call`, which runs before any of this.
- The person is told once for each name and kind in a session, in the
  transcript and the debug log: `<plugin> tried to lift a deny rule in your
  settings from a <tool> call (<rule>); the deny rule holds over the plugins
  you install (allowModsToOverrideDenyRules)`, or `tried to reword` where
  the decision was kept and its words or its rule were not. The kinds are `a deny rule`,
  `an ask rule`, `a <event> hook's ask`, `a <key> setting's ask`, `a host's
  ask` and `a refusal` (a deny that names no rule); only the two rule kinds
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
  theirs included (`allowManagedHooksOnly` is the control for those). Nor an
  ask of the engine's own check that no setting turns on (a dangerous
  removal's): at a dialog the verdict does not tell it from the mode's own,
  so a person's plugin may still answer it there. Nor a session nobody
  answers asks for (a plain `-p` run, where an ask is refused): the mode's
  own ask is a person's plugin's to allow there. Nor a hosted session where
  this plugin is not seated: a person's plugin answers the mode's ask there
  as it does at a dialog. Nor an ask an organization's own plugin answers
  without passing on the engine's verdict: it names nothing unless that
  plugin names it.
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
That policy still holds what it holds; it grants nothing.

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
  organization's plugin, or one built into the CLI, writes still reaches the
  hook, also where it writes a variable a person's plugin wrote first; a
  value a later settings reload puts over the person's plugin's value stands
  too. A write counts as the organization's only when no person's plugin
  stands behind it. A write made while serving a person's plugin, or in a
  call a person's plugin raised, is a person's; so is an organization's
  write whose value a hook of a person's plugin changed before it was made.
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
  Cowork cloud session), a plugin that is not built in sets or unsets only a
  variable the filters on every settings `env` would let a person's own
  settings file set there, and any other write (the proxy and certificate
  variables among them) is held and answered `{ deny }`. A plugin the
  container's managed settings enable is held alike: the session may be able
  to write that file. So is a write, or an unset, of a name any settings tier
  above the person's sets there (the project's, the local, a `--settings`
  file's or the organization's own settings `env`), and a built-in's own
  write in three corners: the built-in serves a plugin that is not built in,
  it writes from a dispatch such a plugin raised, or it writes beneath a call
  some hook rewrote, since who rewrote it cannot be told. An organization
  pins the variables its hooks rely on by setting them in managed `env`. An
  organization's plugin's `$.env.get` is answered past the user tier's hooks,
  with the environment as written.

## Where it is seated

The CLI seats it first in the prepend tier wherever hooks modules load on a
machine with managed settings or a managed-mcp.json, or for a Team or
Enterprise organization,
unless managed settings define `prependPlugins`: then that list is the
whole prepend tier, and the organization names `sec-default@builtin` in it
at the position it wants, e.g. `"prependPlugins": ["acme-guard@acme-tools",
"sec-default@builtin"]`, or leaves it out. Once seated by the machine's
managed settings or by the plan, it stays seated until the session ends: a
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
as its environment can, so it may add a hold and never lift one. It
is a plugin folder like any
other, but its one move that matters, `next.to`, is refused outside a
managed tier, so loading it with `--plugin-dir` seats a plugin that can
only pass.
