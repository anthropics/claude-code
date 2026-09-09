# Claude Code Hooks Examples

This directory contains example hook scripts for Claude Code. Hooks allow you to extend Claude Code's functionality with custom validation, automation, and accessibility features.

Learn more about hooks in the [official documentation](https://code.claude.com/docs/en/hooks).

## Available Examples

### 1. Bash Command Validator (`bash_command_validator_example.py`)

A PreToolUse hook that validates bash commands before execution. This example enforces tool recommendations like using `rg` (ripgrep) instead of `grep` for better performance.

**Hook Type:** PreToolUse  
**Use Cases:**
- Enforce coding standards
- Suggest better tools and approaches
- Block dangerous operations before execution
- Log or audit specific commands

**Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/examples/hooks/bash_command_validator_example.py"
          }
        ]
      }
    ]
  }
}
```

### 2. Text-to-Speech / Read Aloud (`tts_read_aloud_example.py`)

A Stop hook that reads assistant responses aloud using text-to-speech. Designed for accessibility and hands-free workflows.

**Hook Type:** Stop  
**Features:**
- Markdown-aware extraction (removes formatting noise like code blocks and links)
- Code-skip heuristic (skips responses that are mostly code)
- Truncate to first N sentences (avoids reading entire long responses)
- Multi-platform support (Piper for Linux/Windows, system `say` for macOS, PowerShell for Windows)
- Configurable voice selection

**Use Cases:**
- Screen reader accessibility
- Hands-free usage (voice feedback while your hands are busy)
- Language learning (hear correct pronunciation)
- Multitasking (listen while doing other tasks)

**Prerequisites:**
- **Linux/Windows (Piper):** Install [Piper TTS](https://github.com/rhasspy/piper)
- **macOS:** Uses built-in `say` command (no installation needed)
- **Linux audio:** ALSA utils (`apt-get install alsa-utils`)

**Configuration:**

For Piper (Linux/Windows):
```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "python3 /path/to/examples/hooks/tts_read_aloud_example.py",
        "config": {
          "ttsEngine": "piper",
          "pipeDir": "~/.local/share/piper",
          "voiceModel": "en_GB-alba-medium.onnx",
          "maxSentences": 3,
          "minTextLength": 10,
          "codeSkipThreshold": 0.3
        }
      }
    ]
  }
}
```

For macOS:
```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "python3 /path/to/examples/hooks/tts_read_aloud_example.py",
        "config": {
          "ttsEngine": "macos",
          "voice": "Alex"
        }
      }
    ]
  }
}
```

For Windows PowerShell:
```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "python3 path\\to\\examples\\hooks\\tts_read_aloud_example.py",
        "config": {
          "ttsEngine": "windows"
        }
      }
    ]
  }
}
```

**Piper Voice Models:**
Piper supports multiple voices with different accents:
- `en_GB-alba-medium.onnx` - Scottish English (recommended)
- `en_US-amy-medium.onnx` - American English
- `en_US-lessac-medium.onnx` - American English (neutral)
- `en_GB-jenny_dioco-medium.onnx` - British English

See [Piper voices](https://huggingface.co/rhasspy/piper-voices) for complete list.

## Creating Your Own Hooks

Hooks receive JSON input on stdin and can output messages to stderr.

**Hook Input Format:**
```json
{
  "transcript_path": "/path/to/transcript.jsonl",
  "tool_name": "Bash",
  "tool_input": { "command": "..." },
  "stop_hook_active": false,
  "config": { ... }
}
```

**Exit Codes:**
- `0` - Success
- `1` - Error (show stderr to user, don't block Claude)
- `2` - Validation failed (block tool call, show stderr to Claude)

**Writing to User:**
```python
print("User-facing message", file=sys.stderr)
```

## Testing Hooks

Test your hook locally before adding to settings:

```bash
echo '{"transcript_path": "/path/to/transcript.jsonl", "config": {...}}' | python3 your_hook.py
```

## Resources

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Piper TTS GitHub](https://github.com/rhasspy/piper)
- [ALSA Utils](https://www.alsa-project.org/wiki/Main_Page)
