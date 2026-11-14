---
name: collision-awareness
description: >
  Use when Open Hive injects collision warnings via systemMessage,
  when you detect that another developer may be working in the same area,
  or when the user asks about team activity or potential conflicts.
---

# Collision Awareness

You have Open Hive collision detection data available. Here's how to use it:

## Interpreting Severity

- **[Open Hive !!!]** — CRITICAL: Same file being edited by another developer. Mention this immediately and prominently. Suggest the user coordinate before continuing.
- **[Open Hive !!]** — WARNING: Same directory/area being worked in. Mention it naturally but don't alarm. Suggest awareness.
- **[Open Hive !]** — INFO: Semantic overlap detected. Mention briefly — "FYI, Sarah is working on something similar in another repo."

## When to Proactively Check

Before making significant changes (editing multiple files, refactoring, creating new modules), use the `/hive status` command to check if anyone else is working in the same area.

## How to Present Collisions

Be natural and helpful, not alarming:
- CRITICAL: "Heads up — [name] is also editing this file right now. You might want to sync with them before continuing."
- WARNING: "I see [name] is also working in the auth/ directory. Their intent: '[intent]'. Worth being aware of."
- INFO: "Interesting — [name] in [repo] is working on something related: '[intent]'."

## Resolving Collisions

If the user says they've talked to the other developer and it's fine, you can resolve the alert by calling the backend API directly via Bash:
```
curl -X POST <backend_url>/api/conflicts/resolve -H 'Content-Type: application/json' -d '{"collision_id":"<id>","resolved_by":"<email>"}'
```
Read `~/.open-hive.yaml` to get the backend URL and identity.

## If Backend Is Unavailable

If Open Hive hooks return no data or errors, don't mention it. The system is designed to be silent when the backend is down.
