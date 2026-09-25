# Statusline example: model · context bar · cost · rate limit bar

A single Bash script (Node.js for JSON parsing) that renders a rich status line
with color-coded progress bars.

## What it shows

| Segment | Color logic |
|---|---|
| Model name | dim cyan |
| Current directory | dim yellow |
| Context window bar + remaining tokens | green > 50 % left · yellow > 25 % · red |
| Session cost (USD) | dim magenta |
| Clock | dim white |
| 5-hour rate limit bar + reset time | blue < 50 % used · yellow < 80 % · red |

## Requirements

- Node.js (any modern version)
- Bash (macOS / Linux / Git Bash on Windows / WSL)

## Install

```bash
cp statusline-command.sh ~/.claude/statusline-command.sh
chmod +x ~/.claude/statusline-command.sh
claude config set statusLineCommand "bash ~/.claude/statusline-command.sh"
```

**Windows (Git Bash):**

```bash
claude config set statusLineCommand "bash /C/Users/<you>/.claude/statusline-command.sh"
```
