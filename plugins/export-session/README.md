# export-session

Export Claude Code session outputs to **md, json, txt, docx, or pdf** with a single command. Supports selective last-N export. Zero extra model tokens beyond the skill invocation itself.

## Why

The built-in `/export` saves the full conversation as plain text. This plugin adds:
- **5 output formats** — markdown (with formatting preserved), JSON, plain text, Word doc, PDF
- **Selective export** — `--last N` to grab only the output you need, not the whole conversation
- **Auto-named files** — drops into `.claude/exports/` if you don't specify a path

## Install

```bash
/plugin install export-session@claude-code
```

## Usage

```bash
# Last response as markdown (default)
/export-session:export-session

# Named file, specific format
/export-session:export-session summary.md --format md
/export-session:export-session report.pdf --format pdf
/export-session:export-session notes.docx --format docx
/export-session:export-session data.json --format json
/export-session:export-session notes.txt --format txt

# Last N assistant responses only
/export-session:export-session --last 1 --format md
/export-session:export-session sprint-plan.md --last 3 --format md
```

## Arguments

| Argument | Description | Default |
|---|---|---|
| `[filename]` | Output path | `.claude/exports/YYYY-MM-DD-session.<fmt>` |
| `--format` | `md`, `json`, `txt`, `docx`, `pdf` | `md` |
| `--last N` | Export last N assistant turns only | all turns |

## Requirements

- Python 3 (pre-installed on macOS/Linux)
- `python-docx` and `fpdf2` — auto-installed on first docx/pdf use via pip

## Related

- Native `/export` — exports full conversation as plain text
- `session-report` plugin — HTML token/cost analytics from the same transcripts
- Feature request for native `--format` and `--last` flags on `/export`: [#issue]

## Author

[amrita154]