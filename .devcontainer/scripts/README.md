# claudebox - Run Claude Code in Docker with auth proxy

Run Claude Code in Docker containers such that your API credentials stay on your host machine and are injected via proxy.

## Quick Start

```bash
# Add to PATH
export PATH="$PATH:/path/to/claude-code/.devcontainer/scripts"

# Run from your project directory
cd /path/to/your/project
claudebox

# With your CLAUDE.md
claudebox --mount-claude-md
```

Claude Code runs in a container with access to your current directory. API credentials stay on the host.

## How It Works

```
Host Machine                 Container                    Anthropic API
┌─────────────┐             ┌─────────────┐             ┌─────────────┐
│ Real Creds  │             │ Dummy Creds │             │             │
│ (Keychain)  │             │ (Dummy)     │             │             │
│             │             │             │             │             │
│  ┌───────┐  │             │  ┌───────┐  │             │             │
│  │ Proxy │◄─┼─────────────┼──┤Claude │  │             │             │
│  │       │  │ Intercept   │  │ Code  │  │             │             │
│  └───┬───┘  │ & Replace   │  └───────┘  │             │             │
│      │      │             │             │             │             │
│      └──────┼─────────────┼─────────────┼─────────────┤             │
│             │             │             │             │             │
└─────────────┘             └─────────────┘             └─────────────┘
```

### The Process

1. **Setup**: `claudebox` starts an authentication proxy on your host machine
2. **Container**: Docker container gets dummy credentials and proxy URL
3. **Interception**: When Claude Code makes API calls, they go to the proxy first
4. **Injection**: Proxy retrieves real credentials via `get-claude-credentials.sh` and replaces dummy access tokens in API requests
5. **Forwarding**: Proxy sends the request to Anthropic with real credentials
6. **Response**: API response flows back through proxy to Claude Code

### Components

- `claudebox` - Main script that manages Docker container and proxy
- `claude-auth-proxy.py` - Authentication proxy that injects real credentials
- `get-claude-credentials.sh` - Shared credential retrieval script (supports macOS Keychain, Linux config files)

## Prerequisites

- Docker Desktop running
- macOS (uses Keychain) or Linux (uses config files) with Claude Code credentials
- Python 3.6+

Your existing Claude Code setup should already have credentials configured. The container gets minimal config (just `hasCompletedOnboarding`) to skip setup screens.

## Options

```bash
claudebox --help

Options:
  --mount-claude-md Mount your real CLAUDE.md file (default: none)
  --help            Show help
```

## Security

**What goes into the container:**
- Dummy credentials (both access and refresh tokens replaced with dummy values)
- Minimal config (`hasCompletedOnboarding` only)
- Your current directory mounted as `/workspace`
- Your `CLAUDE.md` file if `--mount-claude-md` is used

**What stays on the host:**
- Real API credentials (retrieved from macOS Keychain or Linux config files)
- Your personal config and usage history
- File paths and user identifiers

**Limitations:**
- Windows credential retrieval not implemented
- Proxy traffic is unencrypted (localhost only)

## Troubleshooting

### Proxy fails to start
```bash
# Check if Docker is running
docker info

# Run with debug output to see all commands
bash -x claudebox
```

### No credentials found
```bash
# Verify keychain access
security find-generic-password -s "Claude Code-credentials" -a "$(whoami)" -w
```

