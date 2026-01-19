---
description: Set up voice-to-claude - install dependencies, build whisper.cpp, download model
---

# voice-to-claude Setup

Run the setup script directly. Do not manually check prerequisites - the script handles everything automatically.

## Instructions

**IMPORTANT: Run the command below directly. Do NOT manually check Python version or install dependencies first - the setup script handles all of this automatically.**

```bash
python3.10 ${CLAUDE_PLUGIN_ROOT}/scripts/setup.py 2>/dev/null || python3.11 ${CLAUDE_PLUGIN_ROOT}/scripts/setup.py 2>/dev/null || python3.12 ${CLAUDE_PLUGIN_ROOT}/scripts/setup.py 2>/dev/null || python3 ${CLAUDE_PLUGIN_ROOT}/scripts/setup.py
```

The script will:
- Auto-detect Python 3.10+ (works with 3.10, 3.11, or 3.12)
- Create a local `.venv` in the plugin directory
- Install dependencies in the venv (isolated)
- Build whisper.cpp with Metal support (~3-5 min)
- Download the Whisper model (~142MB)
- Configure everything

**Important:** Do not manually check Python version or install dependencies - the script does this automatically.

### Step 2: Handle Common Errors

**"Microphone permission denied" (macOS):**
```
macOS requires Microphone permission for audio recording.

1. Open System Settings > Privacy & Security > Microphone
2. Find your terminal app (Terminal, iTerm, etc.) and enable it
3. Re-run: /voice-to-claude:setup
```

**"Accessibility permission needed" (macOS):**
```
macOS requires Accessibility permission for keyboard input.

1. Open System Settings > Privacy & Security > Accessibility
2. Find your terminal app and enable it
3. Re-run: /voice-to-claude:start
```

**cmake or build errors:**
```bash
# Ensure Xcode tools are installed
xcode-select --install

# Try rebuilding
cd ~/.local/share/voice-to-claude/whisper.cpp
rm -rf build
cmake -B build -DGGML_METAL=ON
cmake --build build -j
```

**PortAudio errors:**
```bash
brew install portaudio
```

### Success

When setup completes successfully, you'll see:
```
Setup Complete!
To start voice dictation:
  /voice-to-claude:start

Then hold Ctrl+Alt and speak!
```

Use `/voice-to-claude:start` to start the daemon.
