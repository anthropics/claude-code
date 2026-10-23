# Voice-to-Claude

High-quality voice dictation for Claude Code using whisper.cpp with local on-device processing.

[![License](https://img.shields.io/github/license/enesbasbug/voice-to-claude)](LICENSE)
[![Stars](https://img.shields.io/github/stars/enesbasbug/voice-to-claude)](https://github.com/enesbasbug/voice-to-claude/stargazers)

## Install

**Quick Start (3 steps):**

1. **Add marketplace** (one-time setup):
   ```
   /plugin marketplace add enesbasbug/voice-to-claude
   ```

2. **Install plugin**:
   ```
   /plugin install voice-to-claude@voice-to-claude-marketplace
   ```

3. **Run setup** (downloads dependencies, builds whisper.cpp):
   ```
   /voice-to-claude:setup
   ```

**That's it!** Hold **Ctrl+Alt** (or **Ctrl+Option** on macOS) to record, release to transcribe.

> **Note**: 
> - First-time setup takes ~3-5 minutes (builds whisper.cpp)
> - Uses Metal GPU acceleration on macOS, CPU on Linux
> - Downloads the base Whisper model (~142MB)
> - Works with Python 3.10, 3.11, or 3.12 (auto-detected)
> - Creates a local virtual environment (`.venv`) in the plugin directory to isolate dependencies
> - No system-wide Python package installation required
> - Claude Code may ask for permission to run commands during setup (this is normal)

---

## What is Voice-to-Claude?

Voice-to-Claude gives you high-quality voice input directly into Claude Code using whisper.cpp with local on-device processing.

| What You Get | Why It Matters |
|--------------|----------------|
| **Local processing** | All audio processed on-device using whisper.cpp |
| **GPU acceleration** | Metal on macOS (Apple Silicon), CPU on Linux |
| **Multiple models** | Choose quality/speed tradeoff (tiny to large-v3) |
| **Push-to-talk** | Hold hotkey to record, release to transcribe |
| **Privacy first** | No audio or text sent to external services |
| **Cross-platform** | Works on macOS and Linux |

### How It Works

```
Hold Ctrl+Alt (Ctrl+Option on macOS) → start recording
        ↓
Audio captured from microphone
        ↓
Release Ctrl+Alt → stop recording
        ↓
whisper.cpp transcribes locally (~1s for base model)
        ↓
Text inserted into Claude Code input
```

**Key details:**
- Uses whisper.cpp (GGML) for high-quality transcription
- Metal acceleration for fast GPU inference on macOS, CPU on Linux
- Keyboard injection or clipboard fallback
- Native system sounds for audio feedback (macOS and Linux)

---

## Configuration

Customize your settings anytime:

```
/voice-to-claude:config
```

### Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `model` | `tiny`, `base`, `medium`, `large-v3` | `base` | Whisper model |
| `hotkey` | Key combo | `ctrl+alt` | Trigger recording (Ctrl+Option on macOS) |
| `output_mode` | `keyboard`, `clipboard` | `keyboard` | How text is inserted |
| `sound_effects` | `true`, `false` | `true` | Play audio feedback |

### Available Models

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| tiny | ~75MB | ~0.5s | Basic |
| base | ~142MB | ~1s | Good (default) |
| medium | ~1.5GB | ~2s | Better |
| large-v3 | ~3GB | ~3s | Best |

Settings stored in `~/.config/voice-to-claude/config.json`.

---

## Requirements

- **macOS** or **Linux**
- **Python 3.10+**
- **cmake** and build tools (for building whisper.cpp)
- **~200MB-3GB disk space** depending on model

### Prerequisites

**macOS:**
```bash
brew install cmake
xcode-select --install
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install cmake build-essential python3-dev portaudio19-dev xclip
```

**Linux (Fedora):**
```bash
sudo dnf install cmake gcc-c++ python3-devel portaudio-devel xclip
```

> **Note:** `portaudio19-dev` is required for microphone access via `sounddevice`.  
> `xclip` is needed for clipboard mode. You can also use `xsel` or `wl-copy` (Wayland).

---

## Commands

| Command | Description |
|---------|-------------|
| `/voice-to-claude:setup` | First-time setup: build whisper.cpp, download model |
| `/voice-to-claude:start` | Start the voice dictation daemon |
| `/voice-to-claude:stop` | Stop the daemon |
| `/voice-to-claude:status` | Show daemon status and configuration |
| `/voice-to-claude:config` | Change settings (model, hotkey, etc.) |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No audio input | **macOS:** Check System Settings > Privacy & Security > Microphone. **Linux:** Ensure `portaudio19-dev` is installed and microphone is accessible |
| Keyboard injection not working | **macOS:** Grant Accessibility permissions in System Settings > Privacy & Security > Accessibility. **Linux:** May need to run with `sudo` or add user to `input` group |
| Build failed | **macOS:** `brew install cmake && xcode-select --install`. **Linux:** `sudo apt install cmake build-essential` |
| Clipboard not working (Linux) | Install `xclip`, `xsel`, or `wl-copy` (Wayland) |
| Model not loading | Run `/voice-to-claude:setup` to download. Check disk space |
| Hotkey not triggering | Check for conflicts with other apps. Try `/voice-to-claude:config` to change hotkey |

### Logs

```bash
tail -50 ~/.config/voice-to-claude/daemon.log
```

---

## Privacy

**All processing is local:**
- Audio captured from your microphone is processed entirely on-device
- whisper.cpp runs locally — no cloud API calls
- Audio is never sent anywhere, never stored
- Transcribed text only goes to Claude Code input or clipboard

**No telemetry or analytics.**

---

## Development (for contributors)

If you're contributing to this repo, clone it and load the plugin locally:

```bash
git clone https://github.com/enesbasbug/voice-to-claude
cd voice-to-claude

# Test locally without marketplace install
claude --plugin-dir .
```

In Claude Code:

```
/voice-to-claude:setup
/voice-to-claude:start
```

Notes:
- The setup script creates a local `.venv` and installs dependencies there.
- If `python3` points to 3.9, you can run:
  `python3.11 ./scripts/setup.py`
- On macOS, you may need to grant Microphone and Accessibility permissions.

---

## License

MIT — see [LICENSE](LICENSE)

---

## Credits

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Fast C++ implementation of OpenAI's Whisper
- [OpenAI Whisper](https://github.com/openai/whisper) - Original speech recognition model
