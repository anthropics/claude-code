# Deterministic Process: Filter a CHANGELOG.md Feature Into an Interactive HTML Visualization

## Purpose

This document describes a **repeatable, deterministic process** for extracting a single feature (or feature family) from a semver-organized `CHANGELOG.md`, and producing a self-contained interactive HTML file that visualizes its evolution across releases.

It is designed to be given to an LLM (or followed by a human) to produce consistent, comparable output for any feature.

---

## Inputs

| Input | Description | Example |
|-------|-------------|---------|
| `CHANGELOG_URL` | Raw URL to the changelog | `https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md` |
| `FEATURE_NAME` | Human-readable name of the feature family | `Agent Skills` |
| `FEATURE_KEYWORDS` | List of keywords/phrases to match entries | `["skill", "agent", "slash command", "hook", "plugin", "subagent", "frontmatter", "allowed-tools", "Task tool", ".claude/skills", ".claude/agents", ".claude/commands"]` |
| `OUTPUT_FILE` | Path for the HTML output | `deterministic-object-usage/002-claude-agent-skills.html` |
| `CATEGORIES` | Feature sub-categories for filtering/tagging | `[{"id": "skill", "label": "Skills", "color": "#58a6ff"}, {"id": "agent", "label": "Agents", "color": "#3fb950"}, ...]` |

---

## Step-by-Step Process

### Step 1: Fetch & Parse the Changelog

1. Fetch the full `CHANGELOG.md` from `CHANGELOG_URL`
2. Parse it into a structured list of releases:
   ```
   Release {
     version: string        // semver, e.g. "2.1.33"
     entries: string[]      // bullet-point items
   }
   ```
3. Releases are delimited by `## <version>` headings
4. Each bullet (`- ...`) under a heading is one entry

### Step 2: Filter Entries by Feature Keywords

For each release, for each entry:

1. Check if the entry text matches **any** keyword in `FEATURE_KEYWORDS` (case-insensitive)
2. If it matches, include it. If not, discard it
3. Discard releases that end up with zero matching entries

**Keyword matching rules:**
- Match as substrings (e.g., "skill" matches "Skills defined in...")
- Match code references (e.g., `.claude/skills` matches `` `.claude/skills/` ``)
- Match related tool/object names even if the feature name isn't explicit (e.g., "Task tool" relates to agents)

### Step 3: Classify Each Entry

For each matching entry, assign:

#### 3a. Categories (one or more from `CATEGORIES`)

Map each entry to the most relevant sub-category(ies). An entry can belong to multiple categories. Use keyword presence to decide:

| If entry mentions... | Category |
|---------------------|----------|
| skill, `.claude/skills`, SKILL.md | skill |
| agent, subagent, `.claude/agents`, Task tool | agent |
| slash command, `/commands`, SlashCommand | slash-cmd |
| hook, PreToolUse, PostToolUse, SessionStart, Stop | hook |
| plugin, marketplace, `.claude-plugin` | plugin |
| tool, MCP, permission, parameter | tool |

#### 3b. Change Type

Classify as one of:

| Type | When to use |
|------|-------------|
| `added` | New capability, new parameter, new object |
| `changed` | Behavior modification, rename, merge |
| `fixed` | Bug fix |
| `removed` | Deprecation, removal |

**Heuristic:** Match the first verb in the entry:
- "Added" / "Introduced" / "Released" / "New" -> `added`
- "Changed" / "Merged" / "Improved" / "Enabled" / "Updated" -> `changed`
- "Fixed" / "Resolved" -> `fixed`
- "Removed" / "Deprecated" / "Unshipped" -> `removed`

#### 3c. Objects & Parameters

Extract the **named objects** referenced in each entry:

- Object names: class names, tool names, setting keys, file paths, CLI flags
- Parameters: frontmatter fields, function params, config keys with their types
- Wrap in a structured format:
  ```
  objects: ["PermissionRequest", "SubagentStart", ".claude/agents/"]
  params: { "permissionMode": "string", "memory": "'user' | 'project' | 'local'" }
  ```

#### 3d. Milestone Detection

Mark a release as a **milestone** if it contains:
- The very first appearance of a major sub-feature (e.g., "Skills introduced")
- A major version bump (e.g., 2.0.0)
- A fundamental architectural change (e.g., "merged slash commands and skills")

Add a `labels` array: `["introduced"]`, `["major"]`, or `["breaking"]`.

### Step 4: Build the Data Structure

Produce a JSON array (embedded in the HTML `<script>`) with this shape:

```javascript
const RELEASES = [
  {
    version: "2.0.20",
    milestone: true,           // optional
    labels: ["introduced"],    // optional
    changes: [
      {
        cats: ["skill"],                    // category IDs
        type: "added",                      // added | changed | fixed | removed
        desc: "HTML-safe description...",   // original text with <code> wrapping for refs
        objects: ["Skill", ".claude/skills/", "SKILL.md"],   // named objects
        params: { "allowed-tools": "string[]" }              // optional params
      }
    ]
  }
];
```

### Step 5: Generate the HTML

The HTML file must be **self-contained** (no external dependencies) and include:

#### 5a. Header Section
- Feature name as title
- Subtitle describing the visualization
- Link back to the source CHANGELOG

#### 5b. Stats Bar
- Count of releases with changes
- Total individual changes tracked
- Count per top-level category

#### 5c. Filter Controls
- "All" button (default active)
- One button per category from `CATEGORIES`
- Sticky positioned at top on scroll

#### 5d. Search
- Text input that filters entries by description text, category, and object names

#### 5e. Architecture / Object Diagram
- SVG diagram showing the current-state relationships between feature objects
- Boxes for each major object type (color-coded by category)
- Arrows showing interactions (e.g., "Skills can define hooks", "Plugins provide commands + agents")
- Shared fields/frontmatter listed at the bottom

#### 5f. Timeline
- Vertical timeline with a colored gradient line
- Each release is a collapsible card:
  - Dot on the timeline (larger + glowing for milestones)
  - Version number (monospace)
  - Labels (if any)
  - Chevron to expand/collapse
  - Body: list of change cards with:
    - Category tags (color-coded pills)
    - Change type tag
    - Description (HTML, with `<code>` for references)
    - Expandable "Objects & Params" panel

#### 5g. Styling
- Dark theme (GitHub-dark inspired)
- CSS custom properties for all colors
- Responsive for mobile
- No external fonts or CDNs

#### 5h. Interactivity (vanilla JS)
- Filter buttons toggle categories
- Search filters in real-time
- Click release header to expand/collapse
- Stats update dynamically based on active filter/search
- Expand "Objects & Params" details panel

---

## Naming Convention

Output files follow this pattern:

```
deterministic-object-usage/
  000-claude-filter-changelog-feature-to-html-prompt.md   # This file (the process)
  001-<feature-slug>.html                                  # Reserved for index/overview
  002-<feature-slug>.html                                  # First feature visualization
  003-<feature-slug>.html                                  # Second feature, etc.
```

The `NNN` prefix is a sequence number. The slug is a kebab-case feature name.

---

## Example Prompt for LLM Execution

```
Fetch the changelog at:
  https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md

Filter it for the feature: "MCP Servers"

Use these keywords:
  ["MCP", "mcp", ".mcp.json", "MCP server", "SSE", "streamable HTTP", "OAuth", "MCP tool"]

Categories:
  [
    {"id": "mcp-core", "label": "MCP Core", "color": "#58a6ff"},
    {"id": "mcp-transport", "label": "Transport", "color": "#3fb950"},
    {"id": "mcp-auth", "label": "Auth/OAuth", "color": "#d2a8ff"},
    {"id": "mcp-config", "label": "Configuration", "color": "#f0883e"}
  ]

Output to: deterministic-object-usage/003-claude-mcp-servers.html

Follow the process defined in:
  deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md
```

---

## Quality Checklist

Before considering the output complete, verify:

- [ ] Every matching changelog entry is included (no false negatives from the keyword filter)
- [ ] No unrelated entries are included (no false positives)
- [ ] Every entry has at least one category and one change type
- [ ] Milestone releases are correctly identified
- [ ] The architecture diagram reflects the **current** state (latest release), not historical
- [ ] The HTML is self-contained and opens correctly in a browser
- [ ] Filter buttons and search work correctly
- [ ] Stats update when filters change
- [ ] The file is under 200KB (keep it lean)
- [ ] Code references use `<code>` tags, not raw backticks
