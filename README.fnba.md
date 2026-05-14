# Claude Code in WSL — FNBA fork

This branch (`fnba/main`) overlays the upstream `anthropics/claude-code`
devcontainer with the minimum needed to run it as a long-lived Docker
container driven from a WSL terminal at FNBA.

It is intentionally thin. Per-repo runtimes (Java, Maven, Node, pnpm, …)
are **not** in this image — each repo brings its own via its own
`docker-compose.local.yml` running as a sibling container on the WSL
Docker daemon.

## Prerequisites

- Windows + WSL2 with a Linux distro (Ubuntu, Debian, etc.)
- Docker Desktop installed with the WSL integration enabled for that distro
- This repo cloned **inside** the WSL distro (e.g. `~/github/hwieland-fnba/claude-code`)
- You are logged into the WSL distro as the user whose `~/` you want to be
  the container's homebase

## One-time setup

```bash
cd ~/github/hwieland-fnba/claude-code
git checkout fnba/main
./scripts/wsl-up.sh
```

`wsl-up.sh` will:

1. Write `.env` from your WSL `$USER`, `id -u`, `id -g`, `$HOME` (only if
   `.env` doesn't already exist — edit it by hand for overrides)
2. `docker compose up -d --build`
3. If `~/.claude/.fnba-bootstrap-done` is missing in your homebase,
   run the **first-time setup** (see next section) inside the container
4. `docker exec -it claude-<your-user> bash` to drop you into the container

## First-time setup (auto, one-shot)

The first time `wsl-up.sh` brings the container up against an empty
homebase, it runs `/opt/fnba-bootstrap/first-time-setup.sh` for you. That
script:

1. Asks you to confirm (`[Y/n]`).
2. Prompts for your name and email (defaults from `git config --global`
   if present).
3. Looks for an SSH key in `~/.ssh`. **SSH from homebase is the default
   git auth strategy.** If you have a key, the script seeds
   `~/.ssh/known_hosts` with GitHub and sets your `~/.gitconfig`
   identity. If not, it tells you to run `ssh-keygen` and continues.
4. Lays down a starter `.claude/` tree in your homebase:
   - `~/CLAUDE.md` — top-level project guide (name/email interpolated)
   - `~/.claude/commands/pde.md` — `/pde` slash command
   - `~/.claude/settings.json` — minimal settings + community Atlassian
     remote MCP server (OAuth — no token written to disk)
   - `~/.claude/projects/-home-<you>/memory/MEMORY.md` — empty
     auto-memory scaffold
5. Writes the sentinel `~/.claude/.fnba-bootstrap-done` so subsequent
   `wsl-up.sh` runs skip the setup.

Every write is idempotent — pre-existing files in your homebase are
**never** overwritten. To re-run setup after editing the bundle in the
fork, delete the sentinel: `rm ~/.claude/.fnba-bootstrap-done`.

### PAT fallback (not yet implemented)

If you ever want to skip SSH and use a GitHub PAT instead, the script
accepts `--use-pat`. The flag is wired in but the PAT flow itself is a
stub — track it as a future enhancement.

## What "homebase" means

Your WSL home directory (e.g. `/home/hwieland`) is bind-mounted to
`/home/<you>` inside the container. That means:

- `~/.claude` — Claude Code config, projects, agents, memory
- `~/.gitconfig`, `~/.ssh` — git + ssh identity
- `~/.bash_history` (or `~/.zsh_history`)
- Any repos you `git clone ~/github/...` from inside the container

…all live on the WSL host. The container itself is disposable —
`docker compose down && docker compose up -d --build` loses nothing.

## Firewall

Upstream ships `.devcontainer/init-firewall.sh`, a restrictive iptables
script that drops most outbound traffic. **In this fork it is not run**
because it would block FNBA internal hosts (Jira, internal artifact repo,
DSQL, …) and FNBA already enforces egress at the network level.

If you ever want it back, add a `postStart` step that runs
`sudo /usr/local/bin/init-firewall.sh` and extend its allow-list with the
FNBA hostnames you need.

## Working on FNBA repos

Inside the container, clone repos into your homebase:

```bash
mkdir -p ~/github/fnba-software && cd ~/github/fnba-software
git clone <bitbucket-or-github>/escrow-web-services.git
git clone <bitbucket-or-github>/fnba-escrow-webapp.git
```

Then run **each repo's own** stack as sibling containers. The Claude
container has Docker CLI + compose v2 and talks to the host daemon via
the mounted `/var/run/docker.sock`:

```bash
cd ~/github/fnba-software/escrow-web-services
cp .env-example .env   # fill in DSQL creds
docker compose -f docker-compose.local.yml up --build
```

Same pattern for `fnba-escrow-webapp`.

If both stacks need to talk to each other, attach them to a shared
external network (e.g. `fnba-dev`) in each `docker-compose.local.yml`.

## Relationship to the existing FNBA container

The existing `C:\dev\claude-docker\fnba-claude-docker-dist` Docker setup
is unchanged and still works. This fork is a parallel POC — eventually it
may replace that setup, but for now both coexist.

## Keeping in sync with upstream

```bash
git fetch upstream            # one-time: git remote add upstream https://github.com/anthropics/claude-code
git checkout main
git merge upstream/main
git checkout fnba/main
git rebase main
```

All FNBA changes live on `fnba/main` and in **append-only** Dockerfile
sections, so rebases stay clean.
