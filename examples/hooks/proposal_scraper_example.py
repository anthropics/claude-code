#!/usr/bin/env python3
r"""
Claude Code Hook: Proposal Scraper
===================================
This hook runs as a Stop hook after each assistant turn.
It detects when the assistant has proposed options/alternatives for the user
to choose between, and appends them to a persistent PROPOSALS.md file so the
options survive session crashes, compaction, or context loss.

Motivation: LLMs are non-deterministic. When a session crashes mid-proposal
(API errors, network failures, context overflow), the assistant's options exist
only in the chat transcript. Regenerating them in a new session produces
different options — the original insights are lost. This hook persists proposals
the moment they are generated, so the file is the source of truth and the chat
is a view.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/proposal_scraper_example.py"
          }
        ]
      }
    ]
  }
}

Detection heuristics:
  - Strong signal (auto-trigger): explicit option labels like **Option A**, **C11-A**,
    or "Option A:" appearing outside of code spans.
  - Weak signal: two or more numbered bold items in combination with a proximity
    keyword (options, propose, alternative, pick one, which of, choose).
  - Matches inside backtick code spans are ignored so that documentation of the
    trigger patterns does not self-trigger.

The hook is fail-open: any error returns cleanly without blocking the turn.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

PROPOSALS_FILENAME = "PROPOSALS.md"

STRONG_PROPOSAL_PATTERNS = [
    re.compile(r"\*\*Option [A-Z]\*\*"),
    re.compile(r"\*\*C\d+-[A-Z]\*\*"),
    re.compile(r"\bOption [A-Z]:"),
]

NUMBERED_PATTERN = re.compile(r"^\s*\d\.\s+\*\*[^*]+\*\*", re.MULTILINE)

PROPOSAL_KEYWORDS = re.compile(
    r"\b(?:options?|propos(?:e|ed|al|als)|alternatives?|pick\s+(?:one|from)|"
    r"which\s+(?:of|one|do\s+you)|choose\s+(?:one|from|between))\b",
    re.I,
)

CODE_SPAN_PATTERN = re.compile(r"```.*?```|`[^`\n]+`", re.DOTALL)


def strip_code_spans(text: str) -> str:
    return CODE_SPAN_PATTERN.sub(" ", text)


def looks_like_proposal(text: str) -> bool:
    if not text:
        return False
    stripped = strip_code_spans(text)
    for pattern in STRONG_PROPOSAL_PATTERNS:
        if pattern.search(stripped):
            return True
    if len(NUMBERED_PATTERN.findall(stripped)) >= 2 and PROPOSAL_KEYWORDS.search(stripped):
        return True
    return False


def find_transcript_path(context: dict) -> Path | None:
    path = context.get("transcript_path") or context.get("transcriptPath")
    if path and Path(path).exists():
        return Path(path)
    return None


def extract_last_assistant_text(transcript_path: Path) -> str | None:
    last = None
    try:
        with open(transcript_path, encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                message = row.get("message", {})
                if message.get("role") != "assistant":
                    continue
                content = message.get("content")
                if isinstance(content, list):
                    chunks = [
                        c.get("text", "")
                        for c in content
                        if c.get("type") == "text"
                    ]
                    joined = "\n".join(c for c in chunks if c)
                    if joined.strip():
                        last = joined
                elif isinstance(content, str) and content.strip():
                    last = content
    except OSError:
        return None
    return last


def choose_output_file(context: dict) -> Path:
    """Prefer a project-local .claude/PROPOSALS.md; fall back to the current working directory."""
    cwd = Path(context.get("cwd") or os.getcwd())
    for candidate in [cwd] + list(cwd.parents):
        if (candidate / ".claude").is_dir():
            return candidate / ".claude" / PROPOSALS_FILENAME
    return cwd / PROPOSALS_FILENAME


def ensure_header(path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "# Proposals Ledger\n\n"
        "Canonical store for options/alternatives proposed for decision. "
        "Appended by the proposal-scraper Stop hook.\n\n---\n",
        encoding="utf-8",
    )


def append_proposal(path: Path, text: str, session_id: str) -> None:
    ensure_header(path)
    timestamp = datetime.now(timezone.utc).isoformat()
    entry = (
        f"\n## Proposal — {timestamp}\n"
        f"**Session**: `{session_id}`\n"
        f"**Status**: proposed\n\n"
        f"{text.strip()}\n\n---\n"
    )
    with open(path, "a", encoding="utf-8") as f:
        f.write(entry)


def main() -> None:
    try:
        context = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return

    transcript = find_transcript_path(context)
    if not transcript:
        return

    text = extract_last_assistant_text(transcript)
    if not looks_like_proposal(text):
        return

    session_id = context.get("session_id") or context.get("sessionId") or "unknown"
    output_path = choose_output_file(context)
    append_proposal(output_path, text, session_id)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Fail-open — never block the turn on a hook error.
        pass
