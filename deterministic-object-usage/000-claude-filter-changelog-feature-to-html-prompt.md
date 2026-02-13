# Deterministic Changelog Feature Extraction to Interactive HTML

A reusable process for filtering any feature from a changelog and producing a visual, interactive HTML timeline. Designed to be executed by Claude Code (or any LLM agent with web-fetch and file-write capabilities).

---

## Process Overview

```
CHANGELOG.md ──► Feature Filter ──► Structured Data ──► Interactive HTML
```

Given a **changelog URL** and a **feature name**, produce a single self-contained HTML file that visualizes that feature's evolution across semver releases.

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

## Step 2: Filter for the Target Feature

### 2a. Define the keyword set

Start with `FEATURE_KEYWORDS` and expand it during analysis. The keyword set should include:

- **Primary terms**: The feature name and its direct synonyms
- **Object names**: Classes, tools, hooks, params, settings, CLI flags
- **Related features**: Features that directly interact with or depend on the target
- **Internal names**: Code names, config keys, environment variables

### 2b. Scan every version's entries

For each version, check every bullet point against the keyword set. A version is **included** if at least one bullet point matches.

### 2c. Classify each matching entry

For each matching bullet point, classify it along these dimensions:

| Dimension | Values |
|---|---|
| **Change type** | `added`, `changed`, `fixed`, `removed` |
| **Object category** | `agent`, `tool`, `hook`, `param`, `event` |
| **Specific objects** | List of named objects (e.g., `TaskOutputTool`, `SubagentStop`) |
| **Is milestone?** | `true` if it introduces a major new capability |
| **Is breaking?** | `true` if it changes/removes existing behavior |

### 2d. Extract objects and build an Object Registry

From all matching entries, build a deduplicated registry:

```
Object Registry:
  Agent Types:     [Explore Agent (2.0.17), Plan Agent (2.0.28), ...]
  Core Tools:      [Task Tool (0.2.74), TaskOutputTool (2.0.74), ...]
  Hooks & Events:  [SessionStart (1.0.62), SubagentStart (2.0.43), ...]
  Config Params:   [disallowedTools (2.0.30), permissionMode (2.0.43), ...]
```

Each object records:
- **Name**
- **Category** (agent, tool, hook, param, event)
- **Introduced in version** (first appearance)
- **Modified in versions** (subsequent changes)
- **Removed in version** (if applicable)

---

## Step 3: Identify Eras and Interaction Patterns

### 3a. Group versions into eras

Look for natural groupings based on semver major.minor boundaries and thematic shifts:

```
Era 1: "Foundations"     (0.x)     - Primitive capabilities
Era 2: "Custom Agents"   (1.0.x)   - User-defined agents
Era 3: "Agent SDK"       (2.0.x)   - SDK, orchestration, hooks
Era 4: "Orchestration"   (2.1.x)   - Teams, task management
```

### 3b. Map interaction patterns per release

For milestone releases, document the interaction pattern between objects:

```
Main Agent ──► Task Tool ──► Custom Agent ──► [Read, Write, Bash]
                                  │
                                  ▼
                           SubagentStop Hook
```

These become the "interaction diagrams" in the HTML.

---

## Step 4: Generate the HTML

### 4a. File naming convention

```
{OUTPUT_DIR}/{OUTPUT_NUMBER}-{kebab-case-feature-name}.html
```

Example: `deterministic-object-usage/001-claude-agent-teams.html`

### 4b. HTML structure

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
  <!--    3a. Sidebar: Object Registry (clickable, highlights timeline) -->
  <!--    3b. Timeline: era dividers + release cards (expandable) -->
  <!-- 4. Architecture summary section -->
  <!-- 5. Footer with source attribution -->
  <script>/* All JS inline */</script>
</body>
</html>
```

### 4c. Required interactive features

| Feature | Description |
|---|---|
| **Filter buttons** | Filter releases by category: Agents, Tools, Hooks, Params, Milestones, Breaking |
| **Expandable cards** | Click a release header to expand/collapse its details |
| **Object registry sidebar** | Lists all objects with their introduction version; click to scroll to relevant release |
| **Interaction diagrams** | Visual flow diagrams for milestone releases showing object relationships |
| **Object badges** | Colored badges on each entry linking it to the object registry |
| **Auto-open milestone** | The most significant release auto-opens on page load |

### 4d. Visual design principles

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

### 4e. Semver-aware ordering

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

Before finalizing the HTML output, verify:

- [ ] Every version with a matching entry is included
- [ ] No non-matching versions are included
- [ ] Object Registry is complete and deduplicated
- [ ] Every entry has correct change-type classification
- [ ] Milestone releases have interaction diagrams
- [ ] Filter buttons work for all categories
- [ ] Sidebar click-to-scroll works
- [ ] HTML is fully self-contained (no external resources)
- [ ] File naming follows the convention
- [ ] Source changelog URL is attributed in the footer
