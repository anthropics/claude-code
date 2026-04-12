# Agent-Native Executor Output Template

The executor must produce a bounded, runnable micro-step.

## Required Files

- At least one runnable Python file unless the micro-step is explicitly a config/test-only edit.
- `requirements.txt` only when new dependencies are required.
- Optional `docs/agentic_research/<cycle_id>/...` notes for protocol context.
- `executor_manifest.json` written via the CLI helper.

## Manifest Shape

```json
{
  "cycle_id": "20260411_120451",
  "generated_at": "2026-04-11T12:04:51Z",
  "status": "completed",
  "mode": "agent_native_executor",
  "source": "agent_native_exec",
  "selected_micro_step": {"title": "..."},
  "summary": "What changed and why this is the next smallest useful step.",
  "limitations": ["What this step still does not prove."],
  "next_probe": "The next smallest follow-up probe.",
  "generated_files": [
    {
      "destination": "source_repo",
      "repo_path": "scripts/run_pilot.py",
      "local_path": "/absolute/path/under/source_changes/scripts/run_pilot.py",
      "purpose": "Minimal executable experiment script"
    }
  ],
  "claim_rule": "No empirical claim is supported unless tied to generated runnable evidence."
}
```

## Rules

1. Keep one micro-step per cycle.
2. Read the target repo before writing.
3. Write into the `source_changes/` repo-root mirror, not directly into the source clone.
4. Prefer deterministic offline checks over secret-dependent API calls.
5. Do not require `OLLAMA_API_KEY`.
6. If a model call is optional, make it explicit and document the fallback.
