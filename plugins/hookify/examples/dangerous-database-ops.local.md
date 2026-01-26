---
name: block-dangerous-database-ops
enabled: true
event: bash
pattern: migrate:fresh|db:wipe|db:reset|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*;|DELETE\s+FROM\s+\w+\s*$
action: block
---

**Destructive database operation detected!**

This command could permanently delete data from your database. Please:

- Verify you are NOT running against production data
- Ensure you have recent backups before proceeding
- Consider using safer alternatives:
  - Use `migrate` instead of `migrate:fresh` when possible
  - Use `DELETE FROM ... WHERE` with specific conditions
  - Test on a development database first

To proceed with this command, you must explicitly confirm by running it manually in your terminal.
