# telemetry

Plugin analytics as a plugin: its hooks on `telemetry.log` and
`telemetry.mark` are what those two events do, built over the nouns its
`engine.create` step is handed, and a gate above them serves the plugins
built into Claude Code alone: a call from a plugin a person installed or an
administrator listed is refused with a reason (the host stamps every call
with the plugin that raised it, `next.origin`, and the gate reads its tier).
On an engine that has no `$.telemetry` of its own the same step adds the
noun, so the calls exist there too. An entry names where it goes with `to`:
`anthropic`, the default, is this mod's; one for `collector`, the telemetry
collector an operator configured, is passed on beneath untouched, and `to`
is never part of a row.
`$.telemetry.log({ event, props })` queues one event as one first-party
row, `tengu_plugin_<event>`; `$.telemetry.mark({ feature, kind, reason?,
props? })` marks one use of a feature as the CLI's own feature events do,
`tengu_feature_<kind>` with a `feature_name` and the mark's properties
beside it. Both resolve once the row is queued. Rows go out in batches: one
POST to the event-logging ingest with the session's own credential
(`$.session.authorize()`, resolved for each batch) a few seconds after the
first row was queued, at once when a hundred wait, and when the session
ends; a batch the ingest refuses with a server error, a timeout or a rate
limit is tried once more. A session with no first-party credential, or an
ingest that still refuses, drops the batch; each outcome is one line in the
debug log.

Each row carries what the CLI's own rows carry, gathered through `$` once
a session: an event id, the install's device id and the signed-in account's
ids from the CLI's global config, the session's id, model, client type,
entrypoint and interactivity, and an `env` block (platform and
architecture from one `uname` probe, terminal, shell, package managers and
runtimes, CI and GitHub Actions, the remote container, the deployment, the
Linux distribution and kernel, WSL, the working directory's version
control, and the engine's version, base version and build time from
`$.session.version()`, left empty on an engine that does not answer it),
with the repository's remote hash beside the row's properties. What the
engine alone knows (its runtime's version, the process's memory, the
request's betas, the subscription tier, the calling agent) is not on `$`,
and those columns stay empty.

It sends nothing wherever the CLI's own analytics are off: under
`DISABLE_TELEMETRY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` or
`DO_NOT_TRACK`, in a test run, on any third-party provider (Bedrock,
Vertex, Foundry and kin) the host does not manage, on a cloud gateway
(the environment's switch or the managed policy's login pins), and on a
deployment with its own OAuth URL. Each is read through `$.env` and
`$.settings` before every batch, so a session that has since moved to a
third-party provider or a gateway sends nothing more; when the switches
cannot be read, nothing is sent either. The row's `user_type` is `ant`
when `USER_TYPE` says so, else `external`.

Nothing free-form reaches a row. An event name and every property key is a
snake_case token; a value is a finite number, a boolean, or a Choice (a
string named together with the list it is chosen from), under `log` and
`mark` alike; `mark` takes `ok`, `sad` or `bad`, with a `reason` required on
the last two and refused on the first. An entry that breaks a rule is
refused before anything is queued. Of the environment, a variable whose
value is a secret, or names a person or a host, is read for whether it is
set and nothing more; a shell is its basename from a closed list.

`hooks/register.ts` is the module; `types/index.d.ts` is the noun's contract,
the one declaration of `$.telemetry` that this mod's hooks, a mod calling the
noun and a test answering it all read.

## What it hooks

`telemetry.*`, the gate: a caller in the built-in tier (or the engine) goes
on, any other is refused, and a gate that throws refuses too.
`telemetry.log` and `telemetry.mark`, beneath the gate: the entry is checked
and its row queued, the hook answering `{ value }`, or `{ deny }` with the
reason for an entry that breaks a rule, so the caller's promise rejects
naming it. `engine.create`: the sender is built over `await next(e)`, and
the step hands up `{ ...{ telemetry }, ...beneath }`: what is beneath is
spread last, so its own `telemetry` stands where it has one and this mod's
is added where it has none; nothing beneath is replaced.
`session.start`, to learn whether a person is at the prompt; `session.end`,
to send what still waits.

## What it calls on `$`

`session.authorize`, `session.id`, `session.model`, `session.surfaces`,
`session.cwd`, `session.repo`, `settings.read`, `env.get` (the switches and
the describing variables, by literal name), `fs.read`, `fs.list`,
`fs.exists`, `process.run` (one `sh -c` of `uname` and `command -v`),
`clock.after`, `clock.sleep`, `http.fetch` and `ui.log` (to the debug log),
each on the interface the fold handed it.

## Where it runs, whom it serves

This plugin is seated by the CLI itself, on every build whose own analytics
are on, and nowhere else; it serves the plugins bundled with the CLI and
refuses every other caller. It is not meant to be installed or loaded with
`--plugin-dir`; the folder has a manifest so it reads like every other
plugin, not so it can stand alone. A built-in that calls `$.telemetry`
where this one is absent finds no such noun, or, on an engine with the noun
of its own, one whose calls queue nothing; either way that is "no analytics
here".
