# Claude Code home — {{USER_NAME}}

Top-level CLAUDE.md for your WSL homebase. This file is read by Claude
Code on every session and is the right place to put conventions, paths,
and constraints that apply to all your work in this environment.

## You

- **Name**: {{USER_NAME}}
- **Email**: {{USER_EMAIL}}
- **Git author**: always `{{USER_NAME}}`

## Environment

- This is the **WSL/Docker** flavor of Claude Code (forked from
  anthropics/claude-code, FNBA overlay).
- The container's home directory (`/home/{{USER}}`) is bind-mounted from
  your WSL home. Persistent state lives there:
  - `~/.claude/` — Claude config, commands, agents, memory, projects
  - `~/.gitconfig`, `~/.ssh/` — git + SSH identity
  - `~/github/…` — checked-out repos (suggested location)
- The container itself is disposable. Rebuilding it does not lose
  anything in your homebase.

## Per-repo runtimes

Language runtimes (Java, Maven, Node, pnpm, …) are **not installed in
this container**. Each FNBA repo runs as its own sibling container on
the WSL Docker host via its own `docker-compose.local.yml`. Use the
Docker CLI from inside this container — it talks to the host daemon via
the mounted `/var/run/docker.sock`.

## Working with FNBA repos

Clone into `~/github/fnba-software/` and follow each repo's own README
for `docker compose -f docker-compose.local.yml up`. The two
priority repos for this POC:

- `escrow-web-services` — Java 8 + Spring + JAX-RS WAR on Tomcat 9
- `fnba-escrow-webapp` — Nuxt 3 SPA on Node 22 (pnpm)

## MCP servers

The bootstrap wired up the community Atlassian remote MCP (OAuth). To
add more, edit `~/.claude/settings.json`.

## Memory

Auto-memory is enabled at `~/.claude/projects/-home-{{USER}}/memory/`.
Claude writes durable user/project/feedback notes there as the session
proceeds.

## Add your own conventions below

(This template is intentionally short — extend it with anything specific
to how you want Claude to behave in your environment.)
