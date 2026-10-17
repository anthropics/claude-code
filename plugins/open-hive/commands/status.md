---
name: status
description: Show Open Hive status — active sessions, collisions, your current activity
allowed-tools: ["Bash"]
---

Show the current Open Hive status by querying the backend.

1. Read `~/.open-hive.yaml` to get the backend URL
2. Call `GET <backend_url>/api/sessions/active` to get all active sessions
3. Present a summary:
   - How many developers are active
   - What each is working on (intent + areas)
   - Any active collisions with severity
