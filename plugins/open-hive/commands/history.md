---
name: history
description: Show recent Open Hive activity for a file, directory, or repo
allowed-tools: ["Bash"]
---

Query Open Hive for recent activity history.

If the user specifies a file or directory, filter to that path.
Otherwise, show recent activity for the current repo.

1. Read `~/.open-hive.yaml` to get the backend URL
2. Call `GET <backend_url>/api/history?limit=20`
3. Present recent signals grouped by developer:
   - What they worked on
   - Which files they modified
   - When (relative time)
