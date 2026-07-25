## Container Environment

You are running inside a container.

- **Source directories**: Mounted read-write. You can read and edit files in the working directory.
- **`settings.json`**: Read-only bind mount overlaid by `settings.container.json`. `settings.local.json` is blocked to prevent permission escalation. To change container settings, edit `~/.claude/docker/settings.container.json` on the host.
- **Host binaries**: Claude, gh, and other tools are mounted read-only from the host.
