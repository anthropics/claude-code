# Deterministic Process: Filter Changelog Feature to Interactive HTML Visual

> A reusable, deterministic prompt template for extracting any feature's lifecycle from a CHANGELOG.md and generating an interactive HTML timeline with object graphs.

## Process Overview

This document describes a repeatable 5-phase process for turning a changelog into a feature-specific interactive visual. It is designed to be deterministic: given the same inputs, it should produce structurally equivalent outputs regardless of which feature is being tracked.

---

## Phase 1: Input Specification

Define these variables before starting:

```
FEATURE_NAME        = "<human-readable feature name>"       # e.g., "Agent Memory"
FEATURE_KEYWORDS    = ["<keyword1>", "<keyword2>", ...]     # e.g., ["memory", "CLAUDE.md", "remember", "recall"]
CHANGELOG_URL       = "<raw URL to CHANGELOG.md>"           # e.g., "https://raw.githubusercontent.com/.../CHANGELOG.md"
OUTPUT_DIR          = "<directory for outputs>"              # e.g., "deterministic-object-usage/"
OUTPUT_FILE_PREFIX  = "<NNN>"                                # e.g., "005" (semver-aligned identifier)
INCLUDE_ADJACENT    = true/false                             # whether to include entries that are related but not directly about the feature
```

### Keyword Strategy

Choose keywords that capture:

1. **Primary terms**: The feature name itself (e.g., "memory", "agent memory")
2. **Object names**: Data structures or files involved (e.g., "CLAUDE.md", ".claude/rules/")
3. **Tool names**: CLI commands or tools (e.g., "/memory", "MemoryTool")
4. **Action verbs**: What the feature does (e.g., "remember", "recall", "record")
5. **Configuration keys**: Settings or params (e.g., "memory: user", "memory frontmatter")

Use regex-compatible patterns for grep:

```
SEARCH_PATTERN = "(?i)(keyword1|keyword2|keyword3|...)"
```

---

## Phase 2: Fetch and Filter Changelog

### Step 2.1: Download the changelog

```bash
curl -sL $CHANGELOG_URL -o /tmp/changelog.md
```

### Step 2.2: Grep for keyword matches with context

```bash
grep -n -i -E "$SEARCH_PATTERN" /tmp/changelog.md -C 2
```

### Step 2.3: Read the full changelog

Read the entire changelog to understand version structure. Key things to extract:
- **Version headers**: Lines matching `## X.Y.Z`
- **Feature entries**: Bullet points under each version
- **Semver ordering**: Establish chronological order

### Step 2.4: Manual review pass

For each grep match, determine:
- Is this **directly** about the feature? (include)
- Is this **adjacent** to the feature (e.g., a bugfix in a related subsystem)? (include if INCLUDE_ADJACENT=true)
- Is this a **false positive** from keyword collision? (exclude)

---

## Phase 3: Extract to Structured JSONL

For each relevant changelog entry, write a JSONL line with this schema:

```jsonschema
{
  "version":       "string  -- semver version (e.g., '2.1.33')",
  "semver":        "string  -- sortable semver key (e.g., '2.1.33' or '2.1.33b' for multiple entries per version)",
  "date_approx":   "string  -- approximate date range (e.g., 'early 2026')",
  "category":      "string  -- one of: feature_introduction, enhancement, bugfix, optimization, deprecation, change, migration, infrastructure, major_feature",
  "feature":       "string  -- short feature name for this specific entry",
  "description":   "string  -- the changelog entry text",
  "objects":       "array   -- named objects/entities involved (e.g., ['CLAUDE.md', 'Agent memory', '.claude/rules/'])",
  "params":        "array   -- parameters, flags, or configuration keys (e.g., ['memory: user', '--agent'])",
  "tools":         "array   -- tools, commands, or systems involved (e.g., ['/memory', 'Agent configuration'])",
  "interactions":  "array   -- interaction patterns as 'A -> B -> C' strings (e.g., ['User -> /memory -> edit files'])",
  "significance":  "string  -- one of: landmark_feature, major_feature, major_enhancement, enhancement, bugfix, optimization, deprecation, change, infrastructure",
  "notes":         "string  -- analysis notes explaining context, significance, and connections to other entries"
}
```

### Significance Levels

| Level | Meaning |
|-------|---------|
| `landmark_feature` | Defines the feature's identity; changes how users fundamentally interact with it |
| `major_feature` | Significant new capability within the feature |
| `major_enhancement` | Important improvement to existing capability |
| `enhancement` | Incremental improvement |
| `bugfix` | Fix for broken behavior |
| `optimization` | Performance or resource improvement |
| `deprecation` | Removal or deprecation of functionality |
| `change` | Behavioral change that isn't clearly an improvement or deprecation |
| `infrastructure` | Supporting infrastructure change |

### Object Extraction Rules

1. **Objects**: Named entities that exist as data structures, files, directories, or concepts
   - Examples: `CLAUDE.md`, `Agent memory`, `.claude/rules/`, `Memory location selector`
2. **Params**: Configuration values, CLI flags, environment variables, frontmatter fields
   - Examples: `memory: user`, `--agent`, `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`
3. **Tools**: Commands, tools, or systems that perform actions
   - Examples: `/memory`, `CLAUDE.md loader`, `Agent configuration`
4. **Interactions**: Directed flows showing how objects/tools connect
   - Use `->` arrow notation: `User -> /memory -> edit files`
   - Show the flow from trigger to outcome

### Output File

Save to: `$OUTPUT_DIR/${OUTPUT_FILE_PREFIX}-${FEATURE_NAME_SLUG}-changelog-insights.jsonl`

---

## Phase 4: Generate Interactive HTML

### Step 4.1: Define Eras

Group entries into chronological eras based on the feature's evolution:

```
Era pattern:
  Title: "Era N: <phase name> (<version range>)"
  Description: "<1-line summary of what changed in this phase>"
```

Typical era progression for any feature:
1. **Introduction**: First appearance, basic functionality
2. **Expansion**: New capabilities, composability
3. **Infrastructure**: Settings, config, migration work
4. **Maturation**: Full-featured, agent/tool integration
5. **Autonomy**: Automatic behavior, reduced manual intervention

### Step 4.2: HTML Structure

The HTML file must contain these sections:

1. **Header**: Feature name, source metadata, version range
2. **Stats Bar**: Total entries, landmarks, unique objects, versions touched
3. **Navigation**: Filter buttons by significance level + view toggle (Timeline/Graph)
4. **Timeline View**: Chronological entries with era markers, node coloring by significance
5. **Detail Panel**: Click-to-expand showing objects, params, tools, interactions, notes
6. **Object Graph View**: SVG visualization of object relationships

### Step 4.3: Color Coding

| Significance | Node Color | CSS Variable |
|---|---|---|
| landmark | pink | `--pink: #f778ba` |
| major | blue | `--accent: #58a6ff` |
| enhancement | green | `--green: #3fb950` |
| bugfix | orange | `--orange: #d29922` |
| deprecation | red | `--red: #f85149` |
| optimization | cyan | `--cyan: #39d2c0` |
| infrastructure | gray | `--text-muted: #8b949e` |

### Step 4.4: Object Graph Construction

1. Collect all objects + tools from entries
2. Count frequency of each (for node sizing)
3. Categorize each as: core, tool, param, scope, ui
4. Build edges between objects that co-occur in the same entry
5. Layout using category-based clustering
6. Render as SVG with labeled nodes

### Output File

Save to: `$OUTPUT_DIR/${OUTPUT_FILE_PREFIX}-${FEATURE_NAME_SLUG}.html`

---

## Phase 5: Validation Checklist

Before considering the output complete, verify:

- [ ] Every version in the JSONL file corresponds to a real version in the changelog
- [ ] Entries are in chronological (semver) order
- [ ] Each entry has all required fields populated
- [ ] Significance levels are consistently applied
- [ ] The HTML loads without errors in a browser
- [ ] All filter buttons work correctly
- [ ] The detail panel populates when clicking entries
- [ ] The object graph renders without overlapping labels
- [ ] Eras align with the actual chronological progression
- [ ] The JSONL file and HTML data are consistent

---

## Example: Running This Process for a New Feature

To track the "Hooks" feature instead of "Agent Memory":

```
FEATURE_NAME        = "Hooks"
FEATURE_KEYWORDS    = ["hook", "hooks", "PreToolUse", "PostToolUse", "SessionStart", "SessionEnd", "Stop hook", "PermissionRequest"]
CHANGELOG_URL       = "https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md"
OUTPUT_DIR          = "deterministic-object-usage/"
OUTPUT_FILE_PREFIX  = "006"
INCLUDE_ADJACENT    = true
```

Then follow Phases 2-5 with these inputs. The JSONL schema, HTML structure, and validation checklist remain identical.

---

## File Naming Convention

```
deterministic-object-usage/
  000-claude-filter-changelog-feature-to-html-prompt.md   # This file (process template)
  005-claude-agent-memory.html                             # Interactive visual
  005-claude-agent-memory-changelog-insights.jsonl         # Structured data
  006-claude-hooks.html                                    # (future example)
  006-claude-hooks-changelog-insights.jsonl                # (future example)
```

The numeric prefix should align with the feature's semver significance or be assigned sequentially. The same prefix is used for both the `.html` and `.jsonl` files of a given feature.

---

## Determinism Notes

This process is designed to be deterministic in structure but allows for analytical judgment in:

1. **Keyword selection**: Requires domain knowledge of the feature
2. **False positive filtering**: Requires reading context around grep matches
3. **Era boundary placement**: Requires understanding the feature's narrative arc
4. **Significance classification**: Requires judgment about impact
5. **Interaction flow notation**: Requires understanding system architecture

These are the five points where human (or AI) judgment is applied. Everything else follows mechanically from the inputs and schema.
