# Running Claude Code in a Container

Run Claude Code inside a Podman or Docker container for isolation instead of the built-in sandbox.

## Why a container?

Claude Code's built-in sandbox restricts which commands can run. A container flips this model: Claude gets broad permissions *inside* the container, while the container limits access to the host. This gives Claude freedom to work productively while keeping your system safe.

The guard hook works standalone (no container needed) and catches destructive git commands even with `--dangerously-skip-permissions`.

## Quick start — guard hook only

The guard hook intercepts destructive git commands (force push, hard reset, branch -D, rm -rf) and prompts for confirmation. It works with or without a container.

1. Copy [`guard-destructive-git`](./guard-destructive-git) to `~/.claude/bin/` and make it executable:
   ```bash
   mkdir -p ~/.claude/bin
   cp guard-destructive-git ~/.claude/bin/
   chmod +x ~/.claude/bin/guard-destructive-git
   ```

2. Add the hook to your `~/.claude/settings.json` (or `settings.local.json`):
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "$HOME/.claude/bin/guard-destructive-git"
             }
           ]
         }
       ]
     }
   }
   ```

3. Verify it works:
   ```bash
   echo '{"tool_input":{"command":"git push --force origin main"}}' | ~/.claude/bin/guard-destructive-git
   # Expected: JSON with "permissionDecision": "ask"
   ```

## Full container setup

### Prerequisites

- Podman (recommended) or Docker
- `claude` CLI installed on the host
- `gh` CLI (optional, for GitHub integration)

### Steps

1. Copy and customize the files from this directory:
   ```bash
   mkdir -p ~/.claude/docker
   cp Dockerfile              ~/.claude/docker/
   cp settings.container.json ~/.claude/docker/
   cp container-rules.md      ~/.claude/docker/
   cp claude-wrapper.sh       ~/.claude/bin/claude
   chmod +x ~/.claude/bin/claude
   ```

2. Add `~/.claude/bin` to the front of your PATH (in `.bashrc`/`.zshrc`):
   ```bash
   export PATH="$HOME/.claude/bin:$PATH"
   ```

3. Set up secrets — the wrapper reads from a file (default: `/tmp/claude-secrets.env`):
   ```bash
   cat > /tmp/claude-secrets.env << 'EOF'
   ANTHROPIC_API_KEY=sk-ant-...
   GITHUB_TOKEN=ghp_...
   EOF
   ```
   Or set `CLAUDE_SECRETS_FILE` to point elsewhere.

4. Build and run:
   ```bash
   CLAUDE_DOCKER_REBUILD=1 claude  # first run builds the image
   claude                          # subsequent runs reuse it
   ```

## Security model

The container replaces Claude Code's built-in sandbox. Podman rootless provides the isolation boundary.

### What the container prevents

| Threat | How |
|--------|-----|
| **Settings escalation** | `settings.json` overlaid read-only from `settings.container.json`. `settings.local.json` blocked via `/dev/null:ro` — Claude cannot grant itself additional permissions. |
| **Host binary tampering** | Claude, gh, git config, and SSH keys are mounted read-only. |
| **Privilege escalation** | `--cap-drop=ALL`, `--security-opt=no-new-privileges`, Podman rootless user namespace. |
| **Destructive git commands** | Guard hook intercepts force push, hard reset, branch -D, rm -rf, and PR merges — prompts for confirmation. |

### What the container does NOT prevent

| Risk | Mitigation |
|------|------------|
| **Network access** | Full outbound (needed for git push, API calls). Restrict with `CLAUDE_DOCKER_EXTRA="--network=none"`. |
| **SSH agent access** | Socket mounted for git auth. Scoped by your SSH agent's own approval mechanism. |
| **Repo writes** | Claude can modify files in mounted directories — that's the point. Guard hook catches destructive git ops. |
| **Secrets in env vars** | API keys are visible inside the container. Use short-lived tokens where possible. |

## Customization

| Env var | Purpose |
|---------|---------|
| `CLAUDE_DOCKER_IMAGE` | Image name (default: `claude-code`) |
| `CLAUDE_DOCKER_EXTRA` | Extra podman/docker args (e.g. `-v /extra:/extra:ro`) |
| `CLAUDE_DOCKER_REBUILD` | Set to `1` to force image rebuild |
| `CLAUDE_SECRETS_FILE` | Path to secrets env file (default: `/tmp/claude-secrets.env`) |

### Tool manager integration

If you use mise, asdf, nix, or another tool manager, you can inject host toolchains into the container instead of installing them in the image. Run your tool manager's env export on the host and pass the results as `-e` flags:

```bash
# Example for mise — add to the wrapper script before the `exec` line:
while IFS= read -r line; do
  line="${line#export }"
  key="${line%%=*}"; value="${line#*=}"; value="${value#\'}"; value="${value%\'}"
  EXTRA_ENV+=(-e "$key=$value")
done < <(mise env 2>/dev/null | grep "^export " || true)
```

Then mount the toolchain directories read-only (e.g. `~/.local/share/mise/installs`).

### Docker (non-Podman) notes

The wrapper defaults to Podman. For Docker:
- Replace `--userns=keep-id` with `--user "$(id -u):$(id -g)"`
- The `--passwd-entry` flag is Podman-specific — use a bind-mounted `/etc/passwd` entry instead, or remove it if home directory resolution isn't needed
