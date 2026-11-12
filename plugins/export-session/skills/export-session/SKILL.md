---
name: export-session
description: Export the current Claude Code session (or last N assistant responses) to a file. Supports md, json, txt, docx, and pdf formats. Use when the user says "export session", "save output", "export to markdown", "save as PDF", "export last response", "save summary to file", "export to Word", or "save this as docx". Arguments: [filename] [--format md|json|txt|docx|pdf] [--last N]
disable-model-invocation: true
allowed-tools: Bash, Write
argument-hint: [filename] [--format md|json|txt|docx|pdf] [--last N]
---

Export the current session transcript to a file in the requested format.

## Parse $ARGUMENTS

Extract these optional arguments in any order:
- `--format <fmt>` where fmt is one of: `md`, `json`, `txt`, `docx`, `pdf`. Default: `md`
- `--last <N>` where N is a positive integer. Default: export all assistant turns
- `[filename]` — any argument not starting with `--`. If omitted, auto-generate:
  `.claude/exports/YYYY-MM-DD-session.<fmt>`

## Find the current session JSONL

Run this to locate the most recently modified transcript for the current project:

```bash
find ~/.claude/projects -name "*.jsonl" -newer ~/.claude/projects -maxdepth 2 2>/dev/null \
  | xargs ls -t 2>/dev/null | head -1
```

If that returns nothing, fall back to:
```bash
ls -t ~/.claude/projects/**/*.jsonl 2>/dev/null | head -1
```

## Run the export script

Install dependencies if needed, then run the bundled script:

```bash
pip install python-docx fpdf2 --quiet --break-system-packages 2>/dev/null || true
python3 "${CLAUDE_SKILL_DIR}/scripts/export.py" \
  --input "<jsonl_path>" \
  --output "<output_path>" \
  --format <fmt> \
  --last <N or 0 for all>
```

Use `--last 0` when no `--last` argument was given (means export all).

## Create output directory

Before running the script, ensure the output directory exists:
```bash
mkdir -p "$(dirname '<output_path>')"
```

## Report result

When the script exits successfully, print exactly: