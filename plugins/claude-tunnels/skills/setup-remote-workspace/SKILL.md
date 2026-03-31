---
name: setup-remote-workspace
description: "Connect a specific workspace on a remote machine to the Orchestrator. Similar to setup-remote-project but scoped to a single workspace. Run with /setup-remote-workspace. Use for requests like 'connect remote workspace', 'setup remote workspace'."
---

# Setup Remote Workspace

Connects a single specific workspace on a remote machine to the Orchestrator.

## Difference from /setup-remote-project

- `/setup-remote-project`: connects an entire project remotely (including all its workspaces)
- `/setup-remote-workspace`: connects only one specific workspace remotely

## Flow

### Step 1: Identify Target

Ask the user:
```
1. Which project does this workspace belong to?
2. Workspace name (as it will appear in execution plans)
3. Connection method: ssh / kubectl
```

### Step 2: Connection Details

Same as /setup-remote-project:
- SSH: host, user, key path
- kubectl: pod, namespace, kubeconfig, container

### Step 3: Collect Environment Variables

Ask the user for ALL of the following — do not assume defaults without confirming:

```
1. LISTENER_CWD  : Absolute path to the workspace on the remote host (required)
                   Example: /home/user/my-project/backend

2. LISTENER_PORT : Port for the listener to bind on (default: 9100)
                   If multiple workspaces run on the same host, each needs a different port.
                   Confirm this port is open and not already in use.

3. LISTENER_TOKEN: Bearer token for auth (recommended — leave empty to disable auth)
                   Generate a strong random value, e.g.: openssl rand -hex 32

4. PYTHON_CMD    : Python command on the remote host (default: python3)
                   Verify with: ssh USER@HOST "command -v python3 && python3 --version"

5. PIP_CMD       : pip command on the remote host (default: pip3)
                   Verify with: ssh USER@HOST "pip3 --version"
```

Show a confirmation summary before proceeding:
```
Remote workspace environment:
  Project       : <project>
  Workspace     : <workspace>
  LISTENER_CWD  : <value>
  LISTENER_PORT : <value>
  LISTENER_TOKEN: <set / not set>
  PYTHON_CMD    : <value>
  PIP_CMD       : <value>

Proceed? (yes / update values)
```

### Step 4: Verify Remote Prerequisites

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

### Step 5: Deploy & Register

1. Deploy listener.py to remote host
2. Add entry to `orchestrator.yaml` remote_workspaces:
```yaml
remote_workspaces:
  - name: project/workspace
    host: remote-host-or-pod-ip
    port: LISTENER_PORT
    token: "LISTENER_TOKEN"   # empty string if not set
```
3. Test health check:
```bash
curl -H "Authorization: Bearer LISTENER_TOKEN" http://HOST:LISTENER_PORT/health
```

If the health check fails, show the error and help diagnose before finishing.

### Step 6: Verify Integration

The workspace should now be callable by the orchestrator. When the PO includes this workspace in an execution plan, the executor will call the remote listener instead of local `query(cwd=)`.

## Rules

- ALWAYS ask for and confirm all environment variables in Step 3 before deploying.
- ALWAYS run prerequisite checks in Step 4 before deploying.
- One listener per workspace — each on a different port if on the same host.
- Remote workspace must have CLAUDE.md for the PO to understand it.
- Ensure the remote listener stays running (consider systemd/supervisord).
- If LISTENER_TOKEN is set, always include the Authorization header in curl tests.
