---
description: Render a deterministic process as animated ASCII art or web SVG using beautiful-mermaid + Ghostty-style animation
argument-hint: <mermaid-file-or-process-doc> [--mode ascii-animate|ascii-static|web-svg] [--theme theme-name] [--fps 30]
allowed-tools: ["Read", "Write", "Bash", "Glob", "Grep", "Skill", "Task", "TodoWrite", "AskUserQuestion"]
---

# /visualize — Deterministic Visual Renderer

Render mermaid diagrams from deterministic process specifications as:
- **ASCII animation** (Ghostty-style 60fps terminal frames)
- **ASCII static** (single beautiful-mermaid ASCII render)
- **Web SVG** (Next.js + beautiful-mermaid with CSS/SMIL animation)

## Workflow

1. Load the Deterministic Visual skill
2. Read the input file (mermaid `.mmd` or process `.md` document)
3. If input is a process document, extract/generate mermaid diagrams from the process steps
4. Determine output mode from arguments (default: `ascii-animate`)
5. Select theme (default: `vercel-dark`)
6. Execute the rendering pipeline:
   - For `ascii-static`: Run `scripts/render.sh --mode ascii-static`
   - For `ascii-animate`: Run `scripts/render.sh --mode ascii-animate`
   - For `web-svg`: Run `scripts/render.sh --mode web-svg`
7. Display results or report errors

## Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--mode` | `ascii-animate` | Rendering mode |
| `--theme` | `vercel-dark` | beautiful-mermaid theme name |
| `--fps` | `30` | Animation frame rate (1-60) |
| `--strategy` | `progressive` | Animation strategy: progressive, typewriter, pulse, flow |
| `--width` | `120` | Terminal width for ASCII output |
| `--output` | stdout | Output file path (or stdout for terminal) |

## Examples

```
/visualize deterministic-object-usage/examples/changelog-flow.mmd
/visualize deterministic-object-usage/examples/agent-lifecycle.mmd --mode ascii-static --theme dracula
/visualize deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md --mode web-svg --port 3000
```
