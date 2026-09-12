"""Binding-agnostic scenario runner.

This package is the canonical home for the swarm-testing-substrate. It is
mirrored verbatim into:

  - ~/dev/projects/claude-swarm/tests/scenarios/  (standalone library)
  - ~/dev/projects/claude-code/plugins/swarm-orchestrator/tests/swarming/  (plugin)

The runner module is imported by all three bindings via the
``claude_swarm.scenarios.stub`` interface defined in :mod:`.stub`. Each
binding ships a concrete ``ScenarioEngine`` adapter; the scenarios + the
assertion harness stay identical.
"""
