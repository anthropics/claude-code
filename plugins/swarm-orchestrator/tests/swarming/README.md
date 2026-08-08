# Swarm testing substrate

Ten toy swarm scenarios that exercise every primitive (DAG, heads, merging,
abort marker, multi-team) — plus a binding-agnostic runner. The substrate
ships verbatim in three locations so the same scenario JSON drives all
three swarm bindings:

| Binding                                   | Location                                                       |
| ----------------------------------------- | -------------------------------------------------------------- |
| Anthropic Teams (`claude-code` plugin)    | `~/dev/projects/claude-code/plugins/swarm-orchestrator/tests/swarming/` |
| Standalone CLI (`claude-swarm`)           | `~/dev/projects/claude-swarm/tests/scenarios/`                 |
| Internal swarm (this repo)                | `tests/swarming/`                                              |

The schema (`schema/scenario.schema.json`) is the contract; per-binding
runners read the same JSON.

## Running scenarios

```bash
# Internal binding (this repo)
python tests/swarming/run_scenario.py multi-file-rename
python tests/swarming/run_scenario.py --all

# Standalone CLI
claude-swarm scenario run multi-file-rename
claude-swarm scenario run --all

# Plugin (inside claude-code)
plugins/swarm-orchestrator/tests/swarming/run_scenario.sh multi-file-rename
```

All three call into `runner/harness.py`, which materializes fixtures into
a fresh tempdir, asks the binding's `ScenarioEngine` to do the work, then
hands the result + workspace to `runner/assertions.evaluate`. Every
scenario asserts the same way regardless of binding.

## The 10 scenarios

| # | Name                       | Primitives tested                                |
| - | -------------------------- | ------------------------------------------------ |
| 1 | multi-file-rename          | file-overlap-reject, atomic-merge                |
| 2 | spec-impl-pair             | DAG dependency                                   |
| 3 | scan-build-review          | heads architecture end-to-end                    |
| 4 | doc-writer-team            | parallel-safe dispatch                           |
| 5 | multi-language-port        | cross-teammate independence                      |
| 6 | audit-then-fix             | DAG + meta-supervisor task-file                  |
| 7 | conflict-resolution-drill  | merge pipeline rebase                            |
| 8 | abort-marker-test          | clean WIP commit on abort                        |
| 9 | respawn-on-crash           | meta-supervisor recovery                         |
| 10| multi-team-coordination    | two teams + cross-team SendMessage               |

## Reference engine vs real bindings

`runner/stub.py` ships an `InProcessScenarioEngine` — a deterministic,
LLM-free reference implementation. Today every binding falls back to it
so the substrate is independent of binding readiness.

When a real binding lands, replace the engine factory in its runner:

- `tests/swarming/run_scenario.py` -> `_make_engine()` checks for
  `claude_swarm.scenario_engine.StandaloneScenarioEngine`.
- `tests/scenarios/run_scenario.py` (claude-swarm) -> the package's
  `claude_swarm.scenarios.engine.StandaloneScenarioEngine` once the
  CLI is built out.
- `plugins/swarm-orchestrator/tests/swarming/run_scenario.sh` -> calls
  the plugin's TaskCreate/TaskUpdate via the in-binary swarm engine.

Until the real engines arrive, the reference engine + identical
scenario JSON give CI a green signal.

## Adding a new scenario

1. Pick a kebab-case name. Add `scenarios/<name>.json` (validated
   against `schema/scenario.schema.json`).
2. Drop fixtures under `fixtures/<name>/`. The runner copies them
   into a fresh tempdir before invoking the engine.
3. If the in-process reference handler doesn't already cover the
   scenario, register a handler in `runner/stub.py::_DISPATCH`.
4. Run `python run_scenario.py <name>` until it's green.
5. Mirror the new files into the other two binding locations.

## Determinism

- Fixtures are seed-controlled (`setup.seed`).
- File enumeration uses sorted iteration order.
- Time-dependent behaviour (`abort_after_seconds`,
  `introduce_conflict_after_seconds`) is tunable via `inject` so a
  flaky CI host can lengthen timeouts without rewriting the scenario.

## CI

Each binding wires its own job:

- `claude-swarm` library: GitHub Actions matrix `python-{3.11,3.12,3.13}`.
- `claude-code` plugin: runs alongside the project's existing plugin-tests job.
- Downstream consumers: drop into your `pytest` invocation; the substrate is
  self-contained.

Failing scenario = bisect bad commit.
