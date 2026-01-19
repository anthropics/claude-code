---
description: Configure voice-to-claude settings - model, hotkey, output mode
---

# voice-to-claude Configuration

Change voice-to-claude settings including the Whisper model, hotkey, and output mode.

## Instructions

When the user runs `/voice-to-claude:config`:

### Step 1: Show current configuration

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py config show
```

Display current settings:
```
Current Configuration
========================================
Model:    base
Hotkey:   Ctrl+Alt
Output:   keyboard
Sounds:   enabled
```

### Step 2: Ask what to change

Ask the user what they'd like to configure:

1. **Model** - Change Whisper model (affects quality/speed)
2. **Hotkey** - Change the recording hotkey
3. **Output** - Change how text is inserted (keyboard/clipboard)
4. **Sounds** - Enable/disable audio feedback

### Changing Model

Available models:
| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| tiny | ~75MB | ~0.5s | Basic |
| base | ~142MB | ~1s | Good (default) |
| medium | ~1.5GB | ~2s | Better |
| large-v3 | ~3GB | ~3s | Best |

To change model, first check if it's downloaded:
```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py config model <model_name>
```

If model isn't downloaded, download it:
```bash
cd ~/.local/share/voice-to-claude/whisper.cpp && ./models/download-ggml-model.sh <model_name>
```

Then set it:
```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py config model <model_name>
```

### Changing Hotkey

Available modifier keys: ctrl, alt, shift, cmd

Examples:
- `ctrl+alt` (default)
- `ctrl+shift`
- `cmd+shift`

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py config hotkey <keys>
```

### Changing Output Mode

- `keyboard` - Types text directly (default)
- `clipboard` - Copies to clipboard and pastes

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py config output <mode>
```

### Changing Sound Effects

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py config sounds <on|off>
```

### Step 3: Restart daemon

After changing settings, restart the daemon:

```bash
PYTHON_CMD=$([ -f "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" ] && echo "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python" || (command -v python3.11 >/dev/null && echo python3.11) || (command -v python3.10 >/dev/null && echo python3.10) || echo python3); $PYTHON_CMD ${CLAUDE_PLUGIN_ROOT}/scripts/exec.py daemon restart
```

Confirm:
```
Configuration updated. Daemon restarted.
New settings are now active.
```
