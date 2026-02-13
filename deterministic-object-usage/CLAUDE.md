# CLAUDE.md — deterministic-object-usage/

This file is a self-healing knowledge base for the `deterministic-object-usage/` directory. Claude should read this file at the start of every session that touches this directory, and update it when new insights are discovered.

---

## What This Directory Is

This directory contains **deterministic feature extractions** from changelogs. Each extraction follows a repeatable process:

```
CHANGELOG.md ──► Feature Filter ──► .insights.jsonl ──► .html
```

The process is defined in `000-claude-filter-changelog-feature-to-html-prompt.md` and produces two artifacts per feature: a structured JSONL (the source of truth) and a self-contained interactive HTML visualization.

## File Conventions

| Pattern | Purpose |
|---|---|
| `000-*.md` | Process definition (the reusable prompt) |
| `{NNN}-{feature}.insights.jsonl` | Structured extraction data (intermediate artifact, source of truth) |
| `{NNN}-{feature}.html` | Interactive HTML visualization (derived from JSONL) |
| `CLAUDE.md` | This file — self-healing knowledge base |
| `BRANCH_CREATE_TEMPLATE.md` | Checklist + context for starting a new extraction branch |
| `.github/PULL_REQUEST_TEMPLATE/deterministic-object-usage.md` | PR template with conventional commit checklist |

Numbers are zero-padded to 3 digits and assigned sequentially. The next available number is **002**.

## Current Extractions

| # | Feature | JSONL Stats | Status |
|---|---|---|---|
| 001 | Agent Teams | 63 lines, 21 objects, 24 releases, 4 eras, 13 interactions | Complete |

---

## Insights from Making This Process Deterministic

These are lessons learned from building the extraction pipeline. Claude should apply them to future extractions and update this section when new patterns emerge.

### 1. JSONL-first, HTML-second

The single most important architectural decision: the JSONL is the source of truth, not the HTML. When the HTML was written directly from changelog analysis, the intermediate reasoning was lost and the process couldn't be debugged or reproduced. Writing structured insights to JSONL first makes every classification decision auditable.

### 2. Append-only scanning produces natural chronological order

Scanning versions oldest-to-newest and appending lines as they're discovered means the JSONL file naturally represents the feature's evolution in reading order. The `era` lines act as section headers. This ordering should never be changed — it matches how humans think about feature evolution.

### 3. Object deduplication must happen at write time, not read time

If you wait to deduplicate objects when generating HTML, you'll get inconsistent `introduced_in` versions. The rule is: write an `object` line only on first discovery. All subsequent references to that object are captured inside `release` entries. This is a data integrity guarantee.

### 4. Keyword expansion is critical and iterative

Starting keywords rarely capture everything. The initial keyword set for Agent Teams missed `agent_transcript_path`, `skills frontmatter`, and several hook names. During scanning, when you find a matching entry, extract any new proper nouns (tool names, config keys, hook events) and add them to the keyword set. The `meta` line should record the final expanded set.

### 5. "Milestone" is a judgment call — codify the heuristic

A release is a milestone if it introduces a **new capability class** (not just an incremental improvement). Examples: first custom agents, first background agents, first agent teams. Bugfixes and parameter additions are never milestones. New agent types and new interaction patterns are always milestones.

### 6. Interaction diagrams capture what text cannot

The `interaction` lines in the JSONL encode directed graphs of how agents, tools, and hooks relate at a specific point in time. These are the most valuable part of the extraction because they answer "how do the pieces fit together?" — which changelog text alone cannot convey.

### 7. The HTML must be self-contained

No CDN links, no external CSS/JS, no fetch calls. The HTML must render fully offline. This is a hard constraint because these files may be viewed in air-gapped environments, archived, or embedded in documentation systems.

### 8. Categories drive both filtering and visual encoding

The five categories (`agent`, `tool`, `hook`, `param`, `event`) with their color coding create a consistent visual language. Every element in the HTML — sidebar dots, entry badges, diagram nodes, timeline markers — maps to these same five categories. Adding a sixth category would require updating all layers.

---

## How Claude Should Use This File

### On session start (reading this directory)

1. Read this CLAUDE.md first to understand conventions, current state, and accumulated insights
2. Check the "Current Extractions" table for what exists
3. Read `000-*.md` for the full process definition if doing an extraction

### When creating a new extraction

1. Read `BRANCH_CREATE_TEMPLATE.md` — fill in parameters, follow the phased task sequence
2. Increment the number (next: 002)
3. Follow the process in `000-claude-filter-changelog-feature-to-html-prompt.md` exactly
4. Write the `.insights.jsonl` FIRST, then generate `.html` from it
5. Update the "Current Extractions" table in this CLAUDE.md
6. If you discover a new insight about the process, add it to the "Insights" section above
7. Open PR using `.github/PULL_REQUEST_TEMPLATE/deterministic-object-usage.md` — the checklist mirrors the branch template

### When updating an existing extraction

1. Regenerate the `.insights.jsonl` from a fresh changelog fetch (the changelog may have new versions)
2. Regenerate the `.html` from the updated JSONL
3. Update stats in the "Current Extractions" table

### Self-healing behavior

This CLAUDE.md is a living document. Claude should:

- **Add insights** when a new pattern is discovered during extraction (e.g., "changelogs without dates require version-order inference")
- **Correct errors** if a previous insight is found to be wrong
- **Update the extraction table** after every new extraction or update
- **Record edge cases** encountered during scanning (e.g., "version 2.0.51 entries appear under both 2.0.28 and 2.0.51 — the changelog has duplicate entries")
- **Never delete insights** — mark them as superseded with a note if they become outdated

The goal is that any future Claude session can pick up this directory cold and immediately understand what's here, why, and how to extend it.

---

## Future Work: MLflow Tracing for Self-Learning

### Objective

Add MLflow 3.9+ Claude Tracing to this pipeline so that each extraction run is traced end-to-end. This enables the process to self-learn from its own execution traces — understanding which changelog patterns are hardest to classify, which keywords have the highest recall, and where human corrections are most frequently needed.

### Implementation Plan (Future PR)

A dedicated PR should add SDK and/or CLI-based MLflow tracing to the extraction process:

#### SDK Tracing (for programmatic extraction)

```python
import mlflow.anthropic
from claude_agent_sdk import ClaudeSDKClient

# Enable automatic tracing for all Claude Agent SDK calls
mlflow.anthropic.autolog()
mlflow.set_experiment("deterministic-object-usage")

async def extract_feature(changelog_url: str, feature: str, keywords: list[str]):
    async with ClaudeSDKClient() as client:
        await client.query(f"""
            Follow the process in 000-claude-filter-changelog-feature-to-html-prompt.md
            to extract the '{feature}' feature from {changelog_url}
            using keywords: {keywords}
        """)
        async for message in client.receive_response():
            # Each step (fetch, scan, classify, write JSONL, generate HTML)
            # is automatically traced as spans within the MLflow trace
            process_message(message)
```

#### CLI Tracing (for interactive extraction)

```bash
# Enable tracing in the project
mlflow autolog claude --enable \
  --experiment-name "deterministic-object-usage" \
  --tracking-uri "http://localhost:5000"

# Run extraction interactively — all Claude interactions are traced
claude "Extract the Hooks System feature following the process in 000-*.md"

# Check traces
mlflow autolog claude --status
```

#### Token Usage Analysis Per Extraction

Each extraction trace captures token usage per LLM call, enabling cost tracking:

```python
import mlflow

trace = mlflow.get_trace("<extraction-trace-id>")
total_usage = trace.info.token_usage
print(f"Extraction cost: {total_usage['input_tokens']} in / {total_usage['output_tokens']} out")

# Break down by step: changelog fetch analysis, JSONL writing, HTML generation
for span in trace.data.spans:
    if usage := span.get_attribute("mlflow.chat.tokenUsage"):
        print(f"  {span.name}: {usage['total_tokens']} tokens")
```

### PR Trace Analysis Requirement

**Every PR that touches this directory must include an MLflow trace analysis section in its description.** Once tracing is enabled, the PR body should contain:

```markdown
## MLflow Trace Analysis

- **Trace ID**: `<trace-id>`
- **Experiment**: `deterministic-object-usage`
- **Total tokens**: X,XXX (input: X,XXX / output: X,XXX)
- **Span breakdown**:
  | Step | Tokens | Duration |
  |---|---|---|
  | Changelog fetch & parse | X,XXX | Xs |
  | Keyword matching & JSONL write | X,XXX | Xs |
  | HTML generation | X,XXX | Xs |
- **Insights from trace**:
  - [What did the trace reveal about the extraction? Were there retries? Which steps were most expensive?]
- **Comparison to previous extractions**:
  - [Is token usage growing? Are certain features harder to extract?]
```

This creates a feedback loop: each PR's trace data feeds back into the knowledge base, making future extractions more efficient.

### What Self-Learning Looks Like

With MLflow traces accumulated over multiple extractions, Claude can:

1. **Identify expensive patterns**: "Extracting MCP Servers required 3x more tokens than Agent Teams because the changelog entries are spread across more versions"
2. **Optimize keyword sets**: "The keyword 'transport' matched 40 false positives — replacing with 'mcp transport' reduced scan time by 60%"
3. **Detect classification drift**: "The scorer marked 15% of 'milestone' classifications as incorrect — the heuristic needs tightening"
4. **Track cost per feature**: "Average extraction costs 8,000 tokens. Features with >50 matching versions cost 15,000+"

These insights should be appended to the "Insights" section of this CLAUDE.md as they are discovered, closing the self-healing loop.

### GenAI Evaluation for Extraction Quality

MLflow's GenAI evaluation framework can score extraction quality:

```python
import mlflow.anthropic
from mlflow.genai import evaluate, scorer

mlflow.anthropic.autolog()

# Evaluate: does the JSONL correctly classify changelog entries?
eval_data = pd.DataFrame([
    {"inputs": {"version": "2.1.32", "entry": "Added research preview agent teams..."},
     "expected": {"change_type": "added", "is_milestone": True, "category": "agent"}},
    # ...more ground-truth examples
])

evaluate(
    data=eval_data,
    predict_fn=classify_entry,  # wraps the extraction classification logic
    scorers=[accuracy_scorer, category_scorer]
)
```

This validates that the extraction process classifies entries correctly and surfaces regressions when the process prompt is updated.
