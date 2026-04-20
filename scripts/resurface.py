#!/usr/bin/env python3
"""SessionStart hook: surface working notes from the cognitive vault.

Reads vault notes, finds those tagged #status/working or high-link-density
notes not touched in 30+ days, and returns up to 3 as additionalContext
for the session start.

No external dependencies — uses only Python stdlib.
"""

import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path


def find_vault_root():
    """Find the vault directory relative to the script or working directory."""
    # Try sibling to script's parent (scripts/ and vault/ are siblings at repo root)
    script_dir = Path(__file__).resolve().parent
    vault_from_script = script_dir.parent / "vault"
    if (vault_from_script / "_meta" / "conventions.md").exists():
        return vault_from_script

    # Try working directory
    cwd = Path.cwd()
    vault_from_cwd = cwd / "vault"
    if (vault_from_cwd / "_meta" / "conventions.md").exists():
        return vault_from_cwd

    return None


def parse_frontmatter(filepath):
    """Parse YAML frontmatter from a markdown file. Returns dict or None."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except (OSError, UnicodeDecodeError):
        return None

    if not lines or lines[0].strip() != "---":
        return None

    frontmatter = {}
    body_lines = []
    in_frontmatter = True
    found_end = False

    for i, line in enumerate(lines[1:], start=1):
        if in_frontmatter:
            if line.strip() == "---":
                in_frontmatter = False
                found_end = True
                continue
            if ":" in line:
                key, _, value = line.partition(":")
                frontmatter[key.strip()] = value.strip()
        else:
            stripped = line.strip()
            # Skip empty lines, code fences, and top-level headings
            if not stripped or stripped.startswith("```") or stripped == "---":
                continue
            # Include headers and content lines
            if stripped.startswith("# ") and not stripped.startswith("## "):
                continue  # Skip H1 (title, already in filename)
            body_lines.append(stripped)
            if len(body_lines) >= 5:
                break

    if not found_end:
        return None

    frontmatter["_body_preview"] = "\n".join(body_lines[:5])
    frontmatter["_path"] = str(filepath)
    return frontmatter


def score_note(fm, now):
    """Score a note for resurfacing priority. Higher = more relevant."""
    score = 0
    status = fm.get("status", "")
    note_type = fm.get("type", "")

    # Skip meta notes
    if note_type == "meta":
        return -1

    # Working notes are highest priority
    if status == "working":
        score += 10

    # Unverified assumptions are worth surfacing
    if status == "unverified":
        score += 5

    # Link density — count actual [[wikilinks]] in file content
    try:
        with open(fm["_path"], "r", encoding="utf-8") as f:
            content = f.read()
        links_out = len(re.findall(r"\[\[", content))
        score += min(links_out, 5)
    except (OSError, KeyError):
        pass

    # Staleness: notes not touched in 30+ days get a boost for resurfacing
    last_touched = fm.get("last_touched", "")
    try:
        touched_date = datetime.strptime(last_touched, "%Y-%m-%d")
        days_stale = (now - touched_date).days
        if days_stale > 30:
            score += 3
        if days_stale > 60:
            score += 2
    except (ValueError, TypeError):
        pass

    return score


def main():
    # Read stdin (hook input) — we don't need it but must consume it
    try:
        json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        pass

    vault_root = find_vault_root()
    if vault_root is None:
        print(json.dumps({}))
        sys.exit(0)

    now = datetime.now()
    notes = []

    # Walk vault for markdown files
    for md_file in vault_root.rglob("*.md"):
        # Skip _meta, scripts, and hidden files
        rel = md_file.relative_to(vault_root)
        parts = rel.parts
        if any(p.startswith(".") for p in parts):
            continue
        if parts[0] in ("scripts", "_meta"):
            continue

        fm = parse_frontmatter(md_file)
        if fm is None:
            continue

        score = score_note(fm, now)
        if score > 0:
            notes.append((score, fm))

    # Sort by score descending, take top 3
    notes.sort(key=lambda x: x[0], reverse=True)
    selected = notes[:3]

    if not selected:
        print(json.dumps({}))
        sys.exit(0)

    # Build context string
    lines = ["## Vault Context — Working Notes\n"]
    lines.append(
        "You have active notes in the cognitive vault. "
        "These were surfaced based on status and relevance.\n"
    )

    for _, fm in selected:
        rel_path = os.path.relpath(fm["_path"], vault_root.parent)
        status = fm.get("status", "unknown")
        note_type = fm.get("type", "unknown")
        preview = fm.get("_body_preview", "").strip()

        lines.append(f"### {rel_path}")
        lines.append(f"**Type:** {note_type} | **Status:** {status}\n")
        if preview:
            lines.append(f"{preview}\n")

    lines.append("---")
    lines.append(
        "**Available vault skills:** "
        "`/vault-capture`, `/vault-maintain`, `/vault-reflect`, `/vault-falsify`"
    )

    context = "\n".join(lines)

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }

    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never crash — SessionStart hooks must not block session start
        print(json.dumps({}))
        sys.exit(0)
