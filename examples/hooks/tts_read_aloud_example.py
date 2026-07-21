#!/usr/bin/env python3
"""
Claude Code Hook: Text-to-Speech (Read Aloud)
==============================================
This hook runs as a Stop hook and reads the last assistant message aloud using
text-to-speech. It's designed for accessibility and hands-free use cases.

PREREQUISITES:
  - Piper (offline TTS engine): https://github.com/rhasspy/piper
    Install: pipx install piper-tts (or download pre-built binary)
  - ALSA utilities (Linux): apt-get install alsa-utils
  - macOS: Uses system 'say' command (no installation needed)
  - Windows: Uses PowerShell 'Add-Type -AssemblyName System.Speech'

FEATURES:
  - Markdown-aware extraction (strips code, links, formatting noise)
  - Code-skip heuristic (skips responses that are mostly code)
  - Truncate to first N sentences (don't read entire responses)
  - Configurable voice selection

CONFIGURATION:
Add to your ~/.claude/settings.json:

{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "python3 /path/to/examples/hooks/tts_read_aloud_example.py",
        "config": {
          "ttsEngine": "piper",  # or "macos" or "windows"
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

REFERENCE:
  https://github.com/anthropics/claude-code/issues/79542
  https://github.com/rhasspy/piper
"""

import json
import re
import subprocess
import os
import sys
import time
import platform
from pathlib import Path


def strip_markdown(text: str) -> str:
    """Remove markdown formatting from text for cleaner TTS output."""
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`\n]+`', '', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_\n]+)_{1,3}', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{2,}', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def first_n_sentences(text: str, n: int) -> str:
    """Extract first N sentences from text."""
    if n <= 0:
        return ""
    parts = re.split(r'(?<=[.!?])\s+', text)
    return ' '.join(parts[:n])


def read_transcript(transcript_path: str) -> str | None:
    """Extract the last assistant message from the transcript."""
    try:
        with open(transcript_path, encoding='utf-8') as f:
            lines = [line.strip() for line in f if line.strip()]
    except Exception as e:
        print(f"Error reading transcript: {e}", file=sys.stderr)
        return None

    last_text = None
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        if entry.get('type') != 'assistant':
            continue

        content = entry.get('message', {}).get('content', [])
        text = ""

        if isinstance(content, list):
            parts = [
                b.get('text', '')
                for b in content
                if isinstance(b, dict) and b.get('type') == 'text'
            ]
            text = ' '.join(parts)
        elif isinstance(content, str):
            text = content

        if text.strip():
            last_text = text
            break

    return last_text


def speak_piper(text: str, config: dict) -> None:
    """Speak text using Piper (offline TTS)."""
    piper_dir = Path(config.get('pipeDir', '~/.local/share/piper')).expanduser()
    piper_bin = piper_dir / 'piper'
    voice_model = piper_dir / 'voices' / config.get('voiceModel', 'en_GB-alba-medium.onnx')

    if not piper_bin.exists():
        print(f"Error: Piper not found at {piper_bin}", file=sys.stderr)
        print("Install: https://github.com/rhasspy/piper", file=sys.stderr)
        sys.exit(1)

    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = str(piper_dir)

    try:
        popen_kwargs = {
            'stdin': subprocess.PIPE,
            'stdout': subprocess.PIPE,
            'stderr': subprocess.DEVNULL,
            'env': env,
        }
        if platform.system() != 'Windows':
            popen_kwargs['start_new_session'] = True

        piper_proc = subprocess.Popen(
            [
                str(piper_bin),
                '--model', str(voice_model),
                '--output-raw',
                '--length_scale', '1.0',
                '--noise_scale', '0.667',
                '--noise_w', '0.8',
                '--sentence_silence', '0.2',
            ],
            **popen_kwargs
        )

        _ = subprocess.Popen(
            ['aplay', '-r', '22050', '-f', 'S16_LE', '-t', 'raw', '-q'],
            stdin=piper_proc.stdout,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        piper_proc.stdout.close()
        piper_proc.stdin.write(text.encode('utf-8'))
        piper_proc.stdin.close()

        sys.exit(0)

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def speak_macos(text: str, config: dict) -> None:
    """Speak text using macOS system 'say' command."""
    try:
        voice = config.get('voice', 'Alex')
        subprocess.run(
            ['say', '-v', voice, text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        sys.exit(0)
    except FileNotFoundError:
        print("Error: 'say' command not found on macOS", file=sys.stderr)
        sys.exit(1)


def speak_windows(text: str, config: dict) -> None:
    """Speak text using Windows PowerShell."""
    ps_script = f"""
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.Speak('{text.replace("'", "''")}')
"""
    try:
        subprocess.Popen(
            ['powershell', '-Command', ps_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        sys.exit(0)
    except FileNotFoundError:
        print("Error: PowerShell not found on Windows", file=sys.stderr)
        sys.exit(1)


def main():
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    if data.get('stop_hook_active'):
        sys.exit(0)

    config = data.get('config', {})
    transcript_path = data.get('transcript_path', '')

    if not transcript_path or not Path(transcript_path).exists():
        sys.exit(0)

    time.sleep(0.3)

    last_text = read_transcript(transcript_path)
    if not last_text:
        sys.exit(0)

    spoken = strip_markdown(last_text)
    if not spoken:
        sys.exit(0)

    min_length = int(config.get('minTextLength', 10))
    if len(spoken) < min_length:
        sys.exit(0)

    code_threshold = float(config.get('codeSkipThreshold', 0.3))
    if len(spoken) < len(last_text) * code_threshold:
        sys.exit(0)

    max_sentences = int(config.get('maxSentences', 3))
    spoken = first_n_sentences(spoken, max_sentences)
    if not spoken:
        sys.exit(0)

    tts_engine = config.get('ttsEngine', 'piper').lower()

    if tts_engine == 'piper':
        speak_piper(spoken, config)
    elif tts_engine == 'macos':
        speak_macos(spoken, config)
    elif tts_engine == 'windows':
        speak_windows(spoken, config)
    else:
        print(f"Error: Unknown TTS engine '{tts_engine}'", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
