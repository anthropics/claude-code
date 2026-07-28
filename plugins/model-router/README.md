# model-router

Automatically recommends the optimal Claude model for every prompt — so you're always informed before Claude responds.

## What it does

Every time you submit a prompt, this plugin classifies it using `claude-haiku-4-5` and surfaces a recommendation:

```
╔═ Model Router ══════════════════════════════════════╗
║  Recommended:  Opus 4.6                             ║
║  Task:         architecture  Complexity: high       ║
║  Confidence:   92%                                  ║
║                                                     ║
║  Requires expert-level reasoning across multiple    ║
║  competing constraints.                             ║
║                                                     ║
║  ⚡ Switch with /model to use Opus 4.6              ║
╚═════════════════════════════════════════════════════╝
```

The classification runs before Claude processes your prompt, giving you a chance to switch models with `/model` if needed.

## Why this exists

Claude Code locks you into a single model for the entire session. You pick Sonnet or Opus at the start, then use it for everything — whether you're asking a simple question or designing a full system architecture.

This plugin adds model-awareness. It classifies each prompt and tells you when a different model would serve you better.

## How it works

```
Your prompt
    │
    ▼
Haiku classifier  (~100ms, ~$0.0001 per call)
  ├── What kind of task is this?   (coding, architecture, Q&A...)
  ├── How complex is it?           (low / medium / high)
  └── How confident is the router? (0.0 – 1.0)
    │
    ▼
Recommendation banner shown before Claude responds
  └── You switch with /model if needed
```

The classifier always uses Haiku — it's fast and cheap enough that the overhead is negligible.

## Routing logic

| Model | When | Examples |
|---|---|---|
| `claude-haiku-4-5` | Low complexity | Q&A, classification, extraction, summarization, yes/no |
| `claude-sonnet-4-6` | Medium (default) | Code generation, debugging, analysis, writing |
| `claude-opus-4-6` | High complexity | System architecture, ambiguous multi-constraint problems |

## Requirements

- `ANTHROPIC_API_KEY` set in your environment
- Python 3.8+
- `anthropic` Python package: `pip install anthropic`

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "model-router@claude-code-marketplace": true
  }
}
```

Or install via the `/plugin` command in Claude Code.

## Configuration

**Disable for a session** without uninstalling:

```bash
export MODEL_ROUTER_DISABLED=1
claude
```

## Note on mid-session model switching

Claude Code's model is session-scoped — it cannot be changed programmatically mid-session. This plugin is advisory: it tells you which model would be better and you switch with `/model`. This is a Claude Code limitation.

If you're building a custom agent loop, the companion [model-router-mcp](https://github.com/ewanlimr25/model-router-mcp) server provides a `get_routing_decision` tool that returns structured JSON so your code can route API calls automatically — no user intervention needed.

## Improving accuracy

The routing logic lives in `CLASSIFIER_SYSTEM_PROMPT` inside `model_router_hook.py`. The rules are plain English — if you see misroutes for your domain, fork the plugin and add domain-specific signals:

```
Route to claude-opus-4-6 when the prompt involves:
- ...existing rules...
- Database migrations with schema changes (always complex in our stack)
```
