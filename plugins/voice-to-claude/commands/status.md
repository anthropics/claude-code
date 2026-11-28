---
description: Check voice-to-claude daemon status and configuration
---

# voice-to-claude Status

Check the status of the voice dictation daemon and current configuration.

## Instructions

When the user runs `/voice-to-claude:status`:

### Step 1: Check setup status

```bash
test -f ~/.config/voice-to-claude/config.json && echo "CONFIG_EXISTS" || echo "NOT_SETUP"
```

If `NOT_SETUP`: Tell user to run `/voice-to-claude:setup` first.

### Step 2: Get full status

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon status --verbose
```

### Step 3: Display status

Format the output nicely:

```
voice-to-claude Status
========================================
Setup:    Complete
Daemon:   Running (PID: 12345)
Model:    base (~142MB, ~1s transcription)
Hotkey:   Ctrl+Alt (hold to record)
Output:   keyboard

Available Models:
  - tiny     (~75MB,  ~0.5s) - Quick notes
  - base     (~142MB, ~1s)   - General use [ACTIVE]
  - medium   (~1.5GB, ~2s)   - Better accuracy
  - large-v3 (~3GB,   ~3s)   - Best quality

Commands:
  /voice-to-claude:start  - Start daemon
  /voice-to-claude:stop   - Stop daemon
  /voice-to-claude:config - Change settings
```
