---
name: who
description: Show who is working on what right now across the organization
allowed-tools: ["Bash"]
---

Query Open Hive to show who is actively working and what they're doing.

1. Read `~/.open-hive.yaml` to get the backend URL
2. Call `GET <backend_url>/api/sessions/active` to get all active sessions
3. Present each active session:
   - Developer name
   - Repository
   - Intent (what they said they're working on)
   - Areas (directories they've touched)
   - Duration (time since session started)
4. Highlight any collisions between active sessions
