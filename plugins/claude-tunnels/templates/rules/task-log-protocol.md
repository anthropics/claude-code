# Task Log Protocol

`.tasks/` is a pure execution log directory. The orchestrator records results after each task.

## Log Structure

```
.tasks/{YYYY-MM-DD}/{project}/
└── {HHMM}_{task_label}.md
```

- Date folders for daily grouping
- Retention: Delete oldest when >30 date folders

## Log Format

```markdown
---
task_id: a3f1
project: my-project
channel: slack
requested: 2026-03-18T14:30:22
completed: 2026-03-18T14:35:47
status: success | partial_failure | failure
---

## Request
"original request"

## Execution Plan
- Phase 1: ws-a, ws-b (independent)
- Phase 2: ws-c (depends on previous)

## Results
### ws-a [pass]
- changed: file1.py, file2.py
- summary: Added health endpoint
```
