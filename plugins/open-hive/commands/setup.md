---
name: setup
description: Configure Open Hive for this developer — set backend URL, identity, and team
allowed-tools: ["Write", "Bash", "AskUserQuestion"]
---

Set up Open Hive for the current developer.

1. Ask the user for the Open Hive backend URL (e.g., https://hive.internal.company.com)
2. Auto-detect git email via `git config user.email`
3. Ask for display name (default to git name via `git config user.name`)
4. Optionally ask for team name
5. Write the config to `~/.open-hive.yaml`:

```yaml
backend_url: <url>
identity:
  email: <git-email>
  display_name: <name>
team: <team-or-empty>
notifications:
  inline: true
  webhook_url:
```

6. Test the connection by calling `<backend_url>/api/health`
7. Confirm setup is complete
