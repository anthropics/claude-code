---
name: setup-remote-project
description: "Deploy a listener on a remote machine (SSH/kubectl) so the Orchestrator can use that machine's project as a workspace. Run with /setup-remote-project. Use for requests like 'connect remote project', 'setup remote project', 'connect SSH project'."
---

# Setup Remote Project

Deploys a listener on a remote machine (SSH) or Kubernetes Pod so the Orchestrator can use the remote environment's project as a workspace.

## How It Works

1. Deploy a lightweight HTTP listener (`listener.py`) on the remote machine
2. The listener receives tasks from the Orchestrator over HTTP
3. The listener runs `claude-agent-sdk query(cwd=workspace/)` locally
4. Results are returned as JSON

## Flow

### Step 1: Connection Method

Ask the user:
- SSH: host, user, (optional) SSH key path
- kubectl: pod name, namespace, (optional) kubeconfig path, (optional) container name

### Step 2: Collect Environment Variables

Ask the user for ALL of the following — do not assume defaults without confirming:

```
1. LISTENER_CWD  : Absolute path to the workspace on the remote host (required)
                   Example: /home/user/my-project/backend

2. LISTENER_PORT : Port for the listener to bind on (default: 9100)
                   Confirm this port is open and not already in use on the remote host.

3. LISTENER_TOKEN: Bearer token for auth (recommended — leave empty to disable auth)
                   If set, the orchestrator will send this token in every request.
                   Generate a strong random value, e.g.: openssl rand -hex 32

4. PYTHON_CMD    : Python command on the remote host (default: python3)
                   Verify with: ssh USER@HOST "command -v python3 && python3 --version"

5. PIP_CMD       : pip command on the remote host (default: pip3)
                   Verify with: ssh USER@HOST "pip3 --version"
```

Show a confirmation summary before proceeding:
```
Remote environment:
  LISTENER_CWD  : <value>
  LISTENER_PORT : <value>
  LISTENER_TOKEN: <set / not set>
  PYTHON_CMD    : <value>
  PIP_CMD       : <value>

Proceed? (yes / update values)
```

### Step 3: Verify Remote Prerequisites

Before deploying, verify on the remote host:

```bash
# Check Python version (must be 3.10+)
ssh USER@HOST "$PYTHON_CMD --version"

# Check claude CLI is in PATH
ssh USER@HOST "command -v claude && claude --version"

# Check port availability
ssh USER@HOST "ss -tlnp | grep :$LISTENER_PORT || echo 'port is free'"
```

If any check fails, stop and tell the user what needs to be fixed before continuing.

### Step 4: Deploy Listener

#### Via SSH
```bash
# The deploy script handles:
# 1. Copy listener.py to remote host
# 2. Install dependencies
# 3. Start listener with nohup
# 4. Verify health check

python3 -c "
from orchestrator.remote.deploy import deploy_via_ssh
deploy_via_ssh(
    host='HOST',
    remote_cwd='LISTENER_CWD',
    port=LISTENER_PORT,
    user='USER',
    key_file='KEY_FILE',
)
"
```

#### Via kubectl
```bash
python3 -c "
from orchestrator.remote.deploy import deploy_via_kubectl
deploy_via_kubectl(
    pod='POD_NAME',
    namespace='NAMESPACE',
    remote_cwd='LISTENER_CWD',
    port=LISTENER_PORT,
    kubeconfig='KUBECONFIG_PATH',
)
"
```

### Step 5: Register in Config

Add to `orchestrator.yaml`:
```yaml
remote_workspaces:
  - name: project/workspace
    host: remote-host-or-pod-ip
    port: LISTENER_PORT
    token: "LISTENER_TOKEN"   # empty string if not set
```

### Step 6: Test

```bash
curl -H "Authorization: Bearer LISTENER_TOKEN" http://HOST:LISTENER_PORT/health
```

Expected response: `{"status": "ok", "cwd": "LISTENER_CWD", "port": LISTENER_PORT}`

If the health check fails, show the error and help diagnose (firewall, port, process not running, etc.).

## Prerequisites on Remote Host

- Python 3.10+
- `claude-agent-sdk` installed (`$PIP_CMD install claude-agent-sdk`)
- `aiohttp` installed (`$PIP_CMD install aiohttp`)
- Claude Code CLI available in PATH
- `LISTENER_PORT` open and accessible from the orchestrator host

## Rules

- ALWAYS ask for and confirm all environment variables in Step 2 before deploying.
- ALWAYS run prerequisite checks in Step 3 before deploying.
- If SSH key auth fails, suggest password auth or key setup.
- Always test the health check after deployment.
- If LISTENER_TOKEN is set, always include the Authorization header in curl tests.
