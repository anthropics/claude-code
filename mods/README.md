# Mods

A mod is a Claude Code plugin whose behaviour lives in a hooks module: one
`register(on, options)` entry that hooks the engine's events as functions
`($, e, next)`. These four ship inside Claude Code; this folder is their
source, published as it is built into the binary.

| Mod | What it does | Seated |
| --- | --- | --- |
| [`sec-default`](sec-default) | Keeps an organization's classic hooks, prompt content, managed settings and tool policy out of reach of the plugins a person installs; adds no policy of its own. | Outermost, on a machine with managed settings or for a Team or Enterprise organization, unless managed `prependPlugins` says otherwise |
| [`diff`](diff) | `/diff`: the session's uncommitted changes in a pane beside the transcript, file by file with their hunks, refreshed as Claude edits files and runs commands. | Built in |
| [`telemetry`](telemetry) | Adds `$.telemetry` (`log`, `mark`) in the `engine.create` fold so a built-in plugin can record an event as a first-party analytics row, sent in batches; refuses installed plugins; sends nothing wherever Claude Code's analytics are off. | Built in |
| [`agents-md`](agents-md) | `AGENTS.md` as project instructions, by one option: loaded where the project has no `CLAUDE.md` of its own (`claude-md-or-agents-md`, the default) or beside it (`claude-md-and-agents-md`), placed and framed exactly as the engine places `CLAUDE.md`, nested ones on a `Read`; or the project's and the person's instruction files dropped and the organization's kept (`managed-only`); or `CLAUDE.md` alone, as the engine reads it (`claude-md`). | Built in |

Each folder is a complete plugin: `.claude-plugin/plugin.json`, a
`hooks/hooks.json` naming the module, and TypeScript under `hooks/` typed
against the declarations `/plugin-types` writes (`import type … from
'claude-code'`), kept here in `types/`. To read one running from source:

    claude --plugin-dir mods/diff

## Testing

A mod's tests are in its `tests/` folder, and run with

    claude plugin test mods/diff

A test gets the engine's own `$` and a plugin's `on`. Each call on `$` is one
the engine makes, through every hook of the mod loaded as it ships. The hooks
the test registers with `on` sit beneath the mod, where the rest of the world
would be, and nothing is beneath them: a call they leave unanswered throws,
naming its event.

A test file is named for what it covers under `hooks/` (`register.test.ts`
beside `hooks/register.ts`, `git.test.ts` beside `hooks/git/`), and holds its
imports, the tier the mod loads in, and one `describe` titled with that name;
what several tests share sits under `tests/fixtures/`, one export a file.

```ts
import { describe, expect, mock, test, tier } from 'claude-code/testing'

tier('builtin')

describe('register', () => {
  test('outside a git repository /diff says so, opens nothing', async ($, on) => {
    const opened: string[] = []
    mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('process.run', () => ({
      value: { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' },
    }))
    on('ui.open', ($, e, next) => {
      opened.push(e.id)
      return next(e)
    })

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const { text } = await $.command.run({
      command: 'diff',
      args: '',
      origin: { kind: 'composer' },
    })

    expect(text).toContain("isn't in a git repository")
    expect(opened).toEqual([])
  })
})
```

The kit's `mock` answers the world beneath the mod from memory, noun by noun,
each member a plain function over `on` registering hooks where the test calls
it: `mock.env(on, variables)` for `$.env`, `mock.store(on, entries)` for
`$.store`, and `mock.clock(on)` for `$.clock`, whose `advance(ms)` resolves
every wait the mod asked for (`$.clock.sleep`, `after`, `every`) as the clock
crosses it. To see what a dispatch does before it answers, start it
unawaited, `await clock.settle()`, then look: the clock stays where it was.
`$.ui.press({ plugin, key })` presses a `Button` the test rendered, as a
click in the terminal does.

`tsc -p mods/tsconfig.json` typechecks every mod's hooks and tests against
`types/` and each mod's own `types/` contract.

## Composing mods: noun contracts

A mod that adds a noun to `$` in the `engine.create` fold owns that noun's
types, and keeps them in one place: its `types/index.d.ts`, a declaration
file with no imports that exports the types the noun is made of, each named
for the noun, and declares the noun on `EngineInterface` in `claude-code`
(`telemetry/types/index.d.ts` exports `Telemetry`, `TelemetryLogEntry`,
`TelemetryMarkEntry` and the rest, and declares `$.telemetry`).

- The contract is the only declaration of the noun. The mod's own hooks
  import its types from the folder (`import type { Telemetry } from
  '../types'`), and the value its `engine.create` hook returns is checked
  against `EngineInterface['telemetry']`, so the implementation cannot drift
  from what callers read.
- A mod that calls another's noun reads the same file and never copies it:
  `mods/tsconfig.json` includes `*/types/**/*.d.ts`, so `$.telemetry.log(…)`
  in `diff` types against `telemetry`'s contract as it stands, and a helper
  that must name one of its types imports it from that folder by path.
- A test of a mod that calls another's noun seats a provider for it, an inline
  plugin whose `engine.create` hook adds the noun, and answers the calls the
  way it answers the engine's: `on('telemetry.log', ($, e) => ({ value:
  undefined }))` runs above the provider's own method, its `e` typed by the
  contract. With no provider loaded the `$` build refuses the hook, naming the
  noun nobody provides.

A plugin outside this repository that depends on a mod's noun points its
tsconfig `include` at that mod's `types/` folder for now; once the engine
writes the contracts of the plugins a session has installed, `/plugin-types`
will put them beside `claude-code.d.ts` and the include goes away.

Early access: hooks modules load only where function hooks are enabled, and
the API these mods are written against may change between releases without
notice. They are not listed in this repository's marketplace; the copies that
matter are the ones already in your Claude Code.
