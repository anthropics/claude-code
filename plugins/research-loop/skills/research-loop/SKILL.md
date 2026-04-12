---
name: research-loop
description: Claude Code compatibility mirror for the Codex-native 10000 Mentors Research Workflow. Use only when running from Claude Code and the user wants the same source-gated research loop contract.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - WebSearch
model: inherit
argument-hint: "<repo-url> [--max-cycles N] [--target-journal NAME] [--no-push]"
---

# Research Loop Compatibility Skill

This is the Claude Code compatibility mirror. The primary skill lives at:

```text
.codex/skills/research-loop/
```

Use this mirror only when the runtime is Claude Code. Keep the same safety contract:

1. Treat the current target repo HEAD as primary truth.
2. Treat MemPalace, prior handoffs, and expert memory as secondary context.
3. Use native web search only for short, attributed fresh context when needed.
4. Do not require Ollama API keys or Ollama native web search.
5. Run one bounded micro-step per cycle.
6. Write source changes into the workflow run's `source_changes/` repo-root mirror.
7. Write the executor manifest with `python3 -m autonomous_research_workflow.cli write-executor-manifest`.
8. Do not mark empirical progress unless runnable code or checkable result artifacts were produced.
9. Stop only when Submission Advisor reports `score >= 100` and `level = submission_ready`, executor completed, and delivery completed.

## Phase Order

Run the 15-phase loop described in [phases](references/phases.md):

1. `source_intake`
2. `mempalace_context`
3. `council_knowledge`
4. `expert_forum_coverage`
5. `literature_refresh`
6. `knowledge_publish`
7. `advisor_design`
8. `execution_packet`
9. `executor_run`
10. `advisor_reflection`
11. `openspace_retrospective`
12. `next_cycle_handoff`
13. `star_office_status`
14. `overwatcher_check`
15. `github_publish`

## Native Executor

Phase 9 remains the key agent-native phase:

- Read the execution packet.
- Read the source clone.
- Generate the smallest useful runnable research asset.
- Write only to `source_changes/`.
- Run lightweight checks when possible.
- Write `executor_manifest.json`.

Use [executor-template](references/executor-template.md) as the output contract.

## Completion Gate

Only stop when all are true:

- Submission Advisor score is at least `100`.
- Submission Advisor level is `submission_ready`.
- Executor manifest status is `completed`.
- Delivery status is `published` or explicitly `local_only` for dry runs.
