# State Schema

Each run writes a durable local state tree and publishes sanitized artifacts to the target repo under `.autonomous-research-workflow/`.

Important paths:

```text
<run-dir>/
  events.jsonl
  manifest.json
  payload/.autonomous-research-workflow/
    cycles/<cycle_id>/cycle_manifest.json
    execution/<cycle_id>/execution_packet.json
    execution/<cycle_id>/executor_manifest.json
    knowledge/<cycle_id>/knowledge_base.json
    memory/<cycle_id>/mempalace_context.json
    reflections/<cycle_id>/advisor_reflection.json
    retrospectives/<cycle_id>/openspace_retrospective.json
    handoffs/<cycle_id>/next_cycle_handoff.json
    office_status/<cycle_id>/star_office_status.json
    overwatcher/<cycle_id>/overwatcher_status.json
  source/<cycle_id>/<repo>/
  source_changes/
```

`source_changes/` mirrors the target repository root and is copied into the source clone during publish.
