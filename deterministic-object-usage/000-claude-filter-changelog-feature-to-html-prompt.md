# Deterministic Changelog Feature Extraction to Interactive HTML

A reusable process for filtering any feature from a changelog and producing a visual, interactive HTML timeline. Designed to be executed by Claude Code (or any LLM agent with web-fetch and file-write capabilities).

---

## Process Overview

```
CHANGELOG.md ──► Feature Filter ──► Insights JSONL ──► Interactive HTML
                                        │
                                    (append-only,
                                     one line per
                                     insight found)
```

Given a **changelog URL** and a **feature name**, scan the changelog, append structured insights to a JSONL file as they are discovered, then generate a self-contained HTML visualization from that JSONL.

---

## Outputs

Each execution produces three files:

| File | Purpose |
|---|---|
| `{NNN}-{feature}.insights.jsonl` | Structured data extracted from the changelog (intermediate artifact) |
| `{NNN}-{feature}.html` | Self-contained interactive HTML visualization |
| `000-*.md` | This prompt file (created once, reused) |

The JSONL is the **source of truth** for the HTML. If the JSONL is regenerated, the HTML should be regenerated from it.

---

## Inputs

| Input | Description | Example |
|---|---|---|
| `CHANGELOG_URL` | Raw URL to the project's CHANGELOG.md | `https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md` |
| `FEATURE_NAME` | Human-readable feature name | `Agent Teams` |
| `FEATURE_KEYWORDS` | Exhaustive keyword list for filtering | `agent teams, multi-agent, subagent, Task tool, background agent, ...` |
| `OUTPUT_DIR` | Directory for output files | `deterministic-object-usage/` |
| `OUTPUT_NUMBER` | 3-digit file number for semver ordering | `001` |

---

## Step 1: Fetch and Parse the Changelog

### 1a. Fetch the raw changelog

```
Fetch CHANGELOG_URL and extract the full raw markdown content.
```

### 1b. Parse the version structure

Extract every version entry. Expected format:

```markdown
## <version>

### Added
- bullet point

### Changed
- bullet point

### Fixed
- bullet point
```

Record for each version:
- **Version number** (semver: `MAJOR.MINOR.PATCH`)
- **Categories** present (Added, Changed, Fixed, Removed)
- **All bullet points** under each category

### 1c. Build a complete version list

Create an ordered list of all versions from newest to oldest. This is the backbone of the timeline.

---

## Step 2: Filter and Write Insights to JSONL

This is the core extraction step. As you scan the changelog for matching entries, **append each insight as a single JSON line** to the JSONL output file. Do not buffer — write insights as they are discovered so that the file serves as a progressive log of the extraction.

### 2a. JSONL file naming convention

```
{OUTPUT_DIR}/{OUTPUT_NUMBER}-{kebab-case-feature-name}.insights.jsonl
```

Example: `deterministic-object-usage/001-claude-agent-teams.insights.jsonl`

### 2b. Define the keyword set

Start with `FEATURE_KEYWORDS` and expand it during analysis. The keyword set should include:

- **Primary terms**: The feature name and its direct synonyms
- **Object names**: Classes, tools, hooks, params, settings, CLI flags
- **Related features**: Features that directly interact with or depend on the target
- **Internal names**: Code names, config keys, environment variables

Write the keyword set as the first line of the JSONL (type `meta`).

### 2c. Insight line types

Every line in the JSONL file is a JSON object with a `type` field. The following types are defined:

#### Type: `meta`

Written first. Records the extraction parameters and keyword set.

```json
{
  "type": "meta",
  "feature": "Agent Teams",
  "changelog_url": "https://...",
  "keywords": ["agent teams", "multi-agent", "subagent", "Task tool", ...],
  "extracted_at": "2026-02-13T00:00:00Z",
  "total_versions_scanned": 244,
  "versions_matched": 20
}
```

#### Type: `era`

Written when a natural era boundary is identified during scanning.

```json
{
  "type": "era",
  "id": "foundations",
  "name": "Foundations",
  "version_range": "0.2.x",
  "description": "Primitive capabilities — Task tool gains basic write and bash powers"
}
```

#### Type: `release`

Written for each version that has at least one matching entry. Contains **all** matching entries for that version.

```json
{
  "type": "release",
  "version": "2.1.32",
  "era": "orchestration",
  "title": "Agent Teams (Research Preview)",
  "is_milestone": true,
  "is_breaking": false,
  "categories": ["agent", "param", "milestone"],
  "object_ids": ["agent-teams", "agent-teams-env"],
  "entries": [
    {
      "text": "Added research preview agent teams feature for multi-agent collaboration (requires setting CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)",
      "change_type": "added",
      "object_category": "agent",
      "objects": [
        {"id": "agent-teams", "name": "Agent Teams", "category": "agent"},
        {"id": "agent-teams-env", "name": "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "category": "param"}
      ]
    }
  ]
}
```

#### Type: `object`

Written for each unique object discovered. Deduplicated by `id` — only the first occurrence creates the line. Objects referenced in subsequent releases are tracked via the `release` lines.

```json
{
  "type": "object",
  "id": "agent-teams",
  "name": "Agent Teams",
  "category": "agent",
  "introduced_in": "2.1.32",
  "description": "Multi-agent collaboration feature (research preview)"
}
```

Valid categories: `agent`, `tool`, `hook`, `param`, `event`

#### Type: `interaction`

Written for milestone releases that introduce new agent-to-agent or agent-to-tool interaction patterns.

```json
{
  "type": "interaction",
  "version": "2.1.32",
  "title": "Agent Teams architecture",
  "flows": [
    {"from": "Orchestrator", "to": "Teammate A", "from_type": "agent", "to_type": "agent", "label": "spawns"},
    {"from": "Orchestrator", "to": "Teammate B", "from_type": "agent", "to_type": "agent", "label": "spawns"},
    {"from": "Teammate A", "to": "Teammate B", "from_type": "agent", "to_type": "agent", "label": "coordinate", "bidirectional": true}
  ],
  "commentary": "The culmination of the multi-agent journey. Multiple agents work together as a team with inter-agent communication."
}
```

### 2d. Scan order and append protocol

1. Write the `meta` line first (with `versions_matched: 0` initially — update it at the end or accept it as approximate)
2. Scan versions in **chronological order** (oldest to newest)
3. When you cross an era boundary, write an `era` line
4. For each matching version:
   a. Write an `object` line for any **newly discovered** object (first time seeing this `id`)
   b. Write the `release` line with all matching entries
   c. If the release is a milestone, write an `interaction` line
5. Each line is self-contained — the JSONL can be processed line-by-line in a streaming fashion

### 2e. Classification rules for entries

For each matching bullet point, classify it along these dimensions:

| Dimension | Values |
|---|---|
| **change_type** | `added`, `changed`, `fixed`, `removed` |
| **object_category** | `agent`, `tool`, `hook`, `param`, `event` |
| **objects** | List of named objects with `id`, `name`, `category` |
| **is_milestone** | `true` if it introduces a major new capability |
| **is_breaking** | `true` if it changes/removes existing behavior |

---

## Step 3: Identify Eras and Interaction Patterns

This step happens **during** the JSONL writing (Step 2), not after. As you scan chronologically:

### 3a. Group versions into eras

Look for natural groupings based on semver major.minor boundaries and thematic shifts:

```
Era 1: "Foundations"     (0.x)     - Primitive capabilities
Era 2: "Custom Agents"   (1.0.x)   - User-defined agents
Era 3: "Agent SDK"       (2.0.x)   - SDK, orchestration, hooks
Era 4: "Orchestration"   (2.1.x)   - Teams, task management
```

### 3b. Map interaction patterns per release

For milestone releases, document the interaction pattern between objects as `interaction` lines:

```
Main Agent ──► Task Tool ──► Custom Agent ──► [Read, Write, Bash]
                                  │
                                  ▼
                           SubagentStop Hook
```

These become the "interaction diagrams" in the HTML.

---

## Step 4: Generate the HTML from the JSONL

The HTML generation step reads the JSONL and produces the visual. The JSONL is the **single source of truth** — the HTML should be fully derivable from it.

### 4a. File naming convention

```
{OUTPUT_DIR}/{OUTPUT_NUMBER}-{kebab-case-feature-name}.html
```

Example: `deterministic-object-usage/001-claude-agent-teams.html`

### 4b. Reading the JSONL

Parse the JSONL line-by-line. Build in-memory structures:

```
meta         → Header content, stats
era[]        → Timeline section dividers
object[]     → Sidebar registry (grouped by category)
release[]    → Timeline cards (ordered chronologically)
interaction[] → Diagrams embedded inside milestone release cards
```

### 4c. HTML structure

The HTML file must be **self-contained** (no external dependencies). Structure:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Inline CSS only, no CDN links -->
  <style>/* All styles inline */</style>
</head>
<body>
  <!-- 1. Hero header with feature name and source link -->
  <!-- 2. Filter controls (sticky bar) -->
  <!-- 3. Main grid: sidebar + timeline -->
  <!--    3a. Sidebar: Object Registry (from `object` lines, grouped by category) -->
  <!--    3b. Timeline: era dividers (from `era` lines) + release cards (from `release` lines) -->
  <!--    3c. Interaction diagrams (from `interaction` lines, nested inside milestone cards) -->
  <!-- 4. Architecture summary section (derived from latest `object` lines) -->
  <!-- 5. Footer with source attribution and JSONL file reference -->
  <script>/* All JS inline */</script>
</body>
</html>
```

### 4d. Required interactive features

| Feature | Description |
|---|---|
| **Filter buttons** | Filter releases by category: Agents, Tools, Hooks, Params, Milestones, Breaking |
| **Expandable cards** | Click a release header to expand/collapse its details |
| **Object registry sidebar** | Lists all objects with their introduction version; click to scroll to relevant release |
| **Interaction diagrams** | Visual flow diagrams for milestone releases showing object relationships |
| **Object badges** | Colored badges on each entry linking it to the object registry |
| **Auto-open milestone** | The most significant release auto-opens on page load |

### 4e. Visual design principles

- Dark theme (reduces eye strain for developers)
- Monospace font stack
- Color-coded categories:
  - Blue (`#58a6ff`) = Agents
  - Green (`#3fb950`) = Tools
  - Orange (`#d29922`) = Hooks
  - Purple (`#bc8cff`) = Params/Config
  - Pink (`#f778ba`) = Events
- Timeline line on the left with era markers
- Cards animate in on scroll

### 4f. Semver-aware ordering

Releases appear in **chronological order** (oldest at top, newest at bottom), grouped by era. This matches the natural reading direction of "how did this feature evolve over time?"

---

## Step 5: Create the Prompt File (This File)

The prompt file itself follows a naming convention:

```
{OUTPUT_DIR}/000-{kebab-case-description}.md
```

It must be generic enough to reuse for any feature from any changelog.

---

## Reuse Template

To run this process for a different feature, fill in:

```markdown
## Execution Parameters

- CHANGELOG_URL: [url]
- FEATURE_NAME: [name]
- FEATURE_KEYWORDS: [comma-separated list]
- OUTPUT_DIR: deterministic-object-usage/
- OUTPUT_NUMBER: [next available number, e.g., 002]
```

### Example: Extracting "Hooks System" feature

```markdown
## Execution Parameters

- CHANGELOG_URL: https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md
- FEATURE_NAME: Hooks System
- FEATURE_KEYWORDS: hooks, PreToolUse, PostToolUse, SessionStart, Stop, SubagentStart, SubagentStop, PermissionRequest, TeammateIdle, TaskCompleted, hook events, hook matcher
- OUTPUT_DIR: deterministic-object-usage/
- OUTPUT_NUMBER: 002
```

### Example: Extracting "MCP Servers" feature

```markdown
## Execution Parameters

- CHANGELOG_URL: https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md
- FEATURE_NAME: MCP Servers
- FEATURE_KEYWORDS: MCP, Model Context Protocol, mcp server, mcpServers, mcp tool, mcp resource, mcp prompt, mcp transport, stdio, sse
- OUTPUT_DIR: deterministic-object-usage/
- OUTPUT_NUMBER: 003
```

---

## Quality Checklist

Before finalizing, verify:

**JSONL:**
- [ ] `meta` line is the first line with correct parameters
- [ ] `era` lines appear before releases in that era
- [ ] `object` lines appear before the first `release` referencing them
- [ ] Every `release` line has at least one entry
- [ ] `interaction` lines exist for every milestone release
- [ ] Each line is valid JSON (parseable independently)
- [ ] No duplicate `object` lines (deduplicated by `id`)
- [ ] File can be streamed line-by-line without needing the whole file in memory

**HTML (derived from JSONL):**
- [ ] Every `release` from the JSONL is rendered as a timeline card
- [ ] Every `object` from the JSONL appears in the sidebar registry
- [ ] Every `era` from the JSONL appears as a divider in the timeline
- [ ] Every `interaction` from the JSONL is rendered inside its milestone card
- [ ] Filter buttons work for all categories
- [ ] Sidebar click-to-scroll works
- [ ] HTML is fully self-contained (no external resources)
- [ ] File naming follows the convention
- [ ] Footer references both the source changelog URL and the JSONL file
