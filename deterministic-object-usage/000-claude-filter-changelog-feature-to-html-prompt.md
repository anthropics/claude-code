# Deterministic Process: Filter a CHANGELOG Feature into an Interactive HTML Visualization

> A reusable prompt template for extracting any single feature's evolution from a semver-organized CHANGELOG.md and producing an interactive, visual HTML page — grouped by release.

---

## When to Use This

- You have a project with a `CHANGELOG.md` organized by semantic versioning (`## X.Y.Z`)
- You want to trace **one feature** (e.g., "subagents", "hooks", "MCP", "plugins") across all releases
- You want the output to be a self-contained `.html` file with filtering, diagrams, and a timeline

---

## Inputs (fill in before running)

| Variable | Description | Example |
|---|---|---|
| `CHANGELOG_URL` | Raw URL or local path to the changelog | `https://raw.githubusercontent.com/org/repo/main/CHANGELOG.md` |
| `FEATURE_NAME` | The feature to filter for | `subagents` |
| `FEATURE_KEYWORDS` | Search terms that identify related entries | `subagent, sub-agent, Task tool, agent, --agents, AgentOutput, TaskOutput, Explore subagent, Plan subagent, Agent Teams, teammate` |
| `OUTPUT_FILE` | Output HTML file path using NNN prefix convention | `deterministic-object-usage/005-claude-subagents.html` |
| `CODEBASE_PATH` | Path to the repo source code (for object discovery) | `/home/user/claude-code` |

---

## Step-by-Step Process

### Step 1 — Fetch and Parse the Changelog

**Action:** Read the full CHANGELOG.md file.

**Parse into structured data:**
```
For each "## X.Y.Z" heading:
  → Extract version number (semver)
  → Collect all bullet points under it
  → Classify each bullet as: Added (+), Fixed (~), Changed (*), Breaking (!)
```

**Output:** A list of `{ version, items: [{ type, text }] }` objects.

### Step 2 — Filter for the Target Feature

**Action:** For each changelog entry, check if the text matches any `FEATURE_KEYWORDS`.

**Matching rules (apply in order):**
1. **Exact substring match** — e.g., entry contains "subagent" literally
2. **Related object match** — e.g., entry mentions `Task tool`, `TaskStop`, `TaskUpdate`, `TaskOutput` which are subagent objects
3. **Contextual match** — e.g., entry mentions `--agents flag`, `agent frontmatter`, `agent_id` in hook context
4. **Exclude false positives** — e.g., "user agent string" is not about subagents; "agent" in a CSS context is not relevant

**Output:** A filtered list retaining only entries that relate to the feature. Keep the version and change-type metadata.

### Step 3 — Explore the Codebase for Object Model

**Action:** Search the source code at `CODEBASE_PATH` to understand:

1. **What objects/types does the feature define?**
   - Tool parameter schemas (input fields, types, required vs optional)
   - Configuration file formats (frontmatter fields, settings.json keys)
   - Hook event payloads (input/output shapes)

2. **What are the interaction patterns?**
   - Parent → child relationships (e.g., main agent spawns subagent)
   - Communication patterns (sync return, background notification, resume)
   - Permission and tool inheritance rules

3. **What models/enums are available?**
   - Model options (e.g., `inherit | sonnet | opus | haiku`)
   - Agent types (e.g., `Explore | Plan | Bash | general-purpose | custom`)
   - Tool names (e.g., `Read | Write | Bash | Grep | Glob | ...`)

**Output:** Structured object model documentation for use in the diagrams.

### Step 4 — Define Eras

**Action:** Group the filtered versions into logical eras based on the feature's evolution milestones.

**How to identify era boundaries:**
- Look for **introduction** releases (first time the feature appears)
- Look for **major expansions** (e.g., custom agents, plugin system, agent teams)
- Look for **architectural shifts** (e.g., new tool names, new SDK, new hook system)

**Naming convention:**
```
Era 1: "Foundation"    — Feature first appears, minimal capabilities
Era 2: "Customization" — Users can configure/extend the feature
Era 3: "Enhancement"   — Major new capabilities added
Era 4: "Maturity"      — Collaboration features, enterprise support, stability fixes
```

**Output:** An era map: `{ eraName, versionRange, color, cssClass }`.

### Step 5 — Build the HTML Visualization

**Action:** Generate a single self-contained HTML file with these sections:

#### 5a. Header / Hero
- Feature name, one-line description
- Source attribution (link to CHANGELOG.md)

#### 5b. Filter Controls (sticky bar)
- Era filter buttons (one per era + "All")
- Change-type filter buttons (Added, Fixed, Changed)
- JavaScript to show/hide timeline entries based on active filters

#### 5c. Summary Statistics
- Total releases with changes
- Number of distinct objects/types
- Count of each change type
- Number of eras

#### 5d. Architecture Diagram (SVG)
- Current-state system diagram showing:
  - Core objects and their relationships (boxes with labeled connections)
  - Tool/parameter schemas (listed inside boxes)
  - Communication flow (arrows with labels)
- Use inline SVG (no external dependencies)

#### 5e. Object Model Cards
- One card per major object type (e.g., "Task Tool Parameters", "Agent Frontmatter", "Hook Events")
- Each card shows: field name, type, required/optional, version introduced
- Use `<table>` layout inside cards with colored tags for metadata

#### 5f. Interaction Diagram (SVG)
- Sequence diagram showing the lifecycle of a feature usage
  - Lifelines for actors (e.g., User, Main Agent, Subagent, Child Agent)
  - Arrows for messages/calls
  - Boxes for processing phases
  - Annotations for hook events

#### 5g. Timeline (the main section)
- Vertical timeline with left-side dots color-coded by era
- Each entry shows: version number, era badge, list of changes
- Changes are categorized with icons: `+` Added, `~` Fixed, `*` Changed
- `<code>` tags for identifiers, `<strong>` for major features
- Major milestones get larger dots (`.major` class)

#### 5h. Scroll-to-top Button
- Fixed position, appears after scrolling 400px

### Step 6 — Styling Rules

Apply these CSS constraints for consistency:

```
Colors: Use a dark theme with GitHub-dark-inspired palette
  --bg: #0d1117        (page background)
  --surface: #161b22   (card backgrounds)
  --border: #30363d    (borders)
  --text: #c9d1d9      (body text)
  --accent: #58a6ff    (primary accent / links)
  --green: #3fb950     (added items)
  --orange: #d29922    (changed items)
  --red: #f85149       (fixed items)
  --purple: #bc8cff    (era 4 / advanced features)

Font: Monospace only (SF Mono, Cascadia Code, Fira Code)
Layout: Max-width 1200px, centered, responsive grid
Diagrams: Inline SVG, no external images or JS libraries
Zero external dependencies: Everything in one .html file
```

### Step 7 — Validate the Output

**Checklist:**
- [ ] HTML passes W3C validation (no unclosed tags)
- [ ] All changelog entries for the feature are present (cross-check against grep)
- [ ] Versions are in descending order (newest first at top of timeline)
- [ ] Filter buttons correctly show/hide entries
- [ ] SVG diagrams render correctly at different viewport widths
- [ ] File is self-contained (opens in any browser without a server)
- [ ] File size is under 200KB (no bloat)

---

## File Naming Convention

Use a numeric prefix for ordering within the `deterministic-object-usage/` directory:

```
000-*  — Meta / process documentation (this file)
001-*  — First feature visualization
005-*  — Fifth feature visualization
010-*  — Tenth feature visualization
```

The number should loosely correspond to the feature's importance or the order it was analyzed.

---

## Example Prompt (copy-paste ready)

```
Fetch the CHANGELOG.md from [URL]. Filter it for all entries related to
"[FEATURE_NAME]" using these keywords: [KEYWORD_LIST].

Also explore the codebase at [PATH] to understand the feature's object model
(parameters, types, configurations, interactions).

Create a self-contained interactive HTML visualization at
"deterministic-object-usage/NNN-[feature-name].html" that includes:

1. Architecture diagram (SVG) showing current-state objects and relationships
2. Object model cards with parameter tables
3. Interaction/sequence diagram (SVG)
4. Release-by-release timeline filtered from the changelog
5. Era filter buttons and change-type filters (Added/Fixed/Changed)
6. Summary statistics cards

Use a dark monospace theme, inline SVG, zero external dependencies.
Group releases into logical eras based on feature evolution milestones.
```

---

## Adapting for Other Features

To trace a different feature, change the variables and keywords:

| Feature | Keywords |
|---|---|
| Hooks | `hook, PreToolUse, PostToolUse, SessionStart, SessionEnd, SubagentStop, Stop hook, PermissionRequest, hook event` |
| MCP | `MCP, Model Context Protocol, mcp server, mcp tool, SSE, stdio, OAuth, mcp add, mcp list` |
| Plugins | `plugin, marketplace, plugin install, plugin validate, plugin system, extraKnownMarketplaces` |
| Plan Mode | `plan mode, plan subagent, /plan, plan file, ExitPlanMode, plan approval` |
| Skills | `skill, slash command, /skills, skill frontmatter, context: fork, user-invocable` |
| Vim Mode | `vim, vim mode, vim bindings, vim normal mode, vim motion, yank, paste` |
| SDK | `SDK, claude-code-sdk, claude-agent-sdk, --print, -p mode, headless, streaming` |

---

## Maintenance

When the upstream CHANGELOG.md is updated:
1. Re-fetch the changelog
2. Re-run Step 2 (filter) to pick up new entries
3. Decide if a new era boundary is needed
4. Regenerate the HTML (or manually append new timeline entries)
