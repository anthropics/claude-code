---
description: Stop the voice dictation daemon
---

# Stop voice-to-claude Daemon

Stop the speech-to-text daemon.

## Instructions

When the user runs `/voice-to-claude:stop`:

### Step 1: Check daemon status

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon status
```

### Step 2: Stop if running

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon stop
```

### Step 3: Confirm stopped

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon status
```

Show confirmation:
```
voice-to-claude daemon stopped.

To restart: /voice-to-claude:start
```
