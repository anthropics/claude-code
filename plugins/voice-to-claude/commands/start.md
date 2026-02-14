---
description: Start the voice dictation daemon
---

# Start voice-to-claude Daemon

Start the speech-to-text daemon for voice dictation.

## Instructions

When the user runs `/voice-to-claude:start`:

### Step 1: Check if setup is complete

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); test -f ~/.config/voice-to-claude/config.json && $PYTHON_CMD -c "import json; c=json.load(open('$HOME/.config/voice-to-claude/config.json')); exit(0 if c.get('setup_complete') else 1)" 2>/dev/null && echo "SETUP_OK" || echo "SETUP_NEEDED"
```

- If output is `SETUP_NEEDED`: Tell user to run `/voice-to-claude:setup` first.
- If output is `SETUP_OK`: Proceed to Step 2.

### Step 2: Check daemon status

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon status
```

### Step 3: Start if not running

If daemon is not running:

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon start --background
```

### Step 4: Confirm and show usage

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon status
```

Show usage reminder:
```
voice-to-claude daemon started.

Usage:
  Hotkey: Ctrl+Alt (hold to record, release to transcribe)

  1. Hold Ctrl+Alt - Recording starts
  2. Speak clearly
  3. Release - Text appears in input

Tips:
  - Speak in complete sentences for best accuracy
  - Use /voice-to-claude:config to change model or hotkey
  - Use /voice-to-claude:stop to stop the daemon
```
