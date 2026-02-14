# Deterministic Prompt: Filter a CHANGELOG by Feature → Interactive HTML Visualization

> A reusable, step-by-step process for extracting any single feature domain from
> a semver-formatted CHANGELOG.md and producing a self-contained interactive HTML
> page that visualises that feature's lifecycle.

---

## 0. Inputs (replace the placeholders for each run)

| Placeholder | Example value | Description |
|---|---|---|
| `{{CHANGELOG_URL}}` | `https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md` | Raw URL of the CHANGELOG |
| `{{FEATURE_DOMAIN}}` | `Agent Tools & Skills` | Human-readable name of the feature area to filter for |
| `{{FILTER_KEYWORDS}}` | `hooks, skills, MCP, subagents, Task tool, Skill tool, plugins, agent, SlashCommand` | Comma-separated keywords/phrases used to match relevant entries |
| `{{OUTPUT_NUMBER}}` | `003` | Zero-padded file number for the output HTML (e.g. 003, 004, …) |
| `{{OUTPUT_DIR}}` | `deterministic-object-usage/` | Target directory for the generated files |

---

## 1. Fetch & Parse

1. **Fetch** the raw CHANGELOG at `{{CHANGELOG_URL}}`.
2. **Parse** it into a structured list of version objects. Each version has:
   - `version` (string, semver: e.g. `2.1.39`)
   - `date` (string, if present)
   - `entries[]` — each entry has:
     - `kind` — one of: `added`, `fixed`, `changed`, `removed`, `released`
     - `description` — the changelog line text
3. **Group** versions by major.minor track (e.g. `1.x`, `2.0.x`, `2.1.x`).

### Determinism rule
> The parser must treat the CHANGELOG as the single source of truth.
> No entries may be invented, inferred, or omitted.
> Every entry must map 1-to-1 to a line in the CHANGELOG.

---

## 2. Filter

For each entry, test whether it is relevant to `{{FEATURE_DOMAIN}}`:

1. **Keyword match** — case-insensitive match of any token in `{{FILTER_KEYWORDS}}` against the entry description.
2. **Section match** — if the CHANGELOG groups entries under sub-headings (e.g. "### Hooks"), match the heading against `{{FILTER_KEYWORDS}}`.
3. **Transitive relevance** — if an entry references an object that was identified as relevant in a prior version (e.g. "Fixed SubagentStop hook"), include it even if no keyword directly matches, because the referenced object belongs to the domain.

### Output of this step
A filtered version list where each version contains only matching entries.
Discard versions with zero matching entries.

### Determinism rule
> The filter is purely mechanical: keyword ∈ description OR section heading.
> The implementer must NOT apply subjective judgement about "relevance".
> If ambiguous, include the entry with a `maybe` flag and let the reviewer decide.

---

## 3. Categorise

Assign one or more **category tags** to each filtered entry.
Categories are derived from `{{FILTER_KEYWORDS}}` — each keyword becomes a category slug:

| Keyword | Slug |
|---|---|
| hooks | `hooks` |
| skills | `skills` |
| MCP | `mcp` |
| subagents | `subagents` |
| Task tool | `task` |
| plugins | `plugins` |
| agent (generic) | `agent-tools` |

An entry can have multiple categories (e.g. "SubagentStart hook" → `hooks`, `subagents`).

### Determinism rule
> Assign categories based on which keywords matched the entry.
> If multiple keywords matched, assign all corresponding categories.

---

## 4. Extract Objects & Params

For each category, build an **object model** that tracks:

| Field | Description |
|---|---|
| `label` | Human-readable name (e.g. "Hooks") |
| `firstVer` | The version where this object category first appeared |
| `events[]` | (if applicable) Named events/signals the object emits |
| `params[]` | Named parameters/fields with `{name, since, desc}` — the version where each param was introduced and a one-line description |
| `transports[]` | (if applicable) Communication protocols |
| `frontmatter[]` | (if applicable) YAML frontmatter fields with `{name, since, desc}` |

### Where to find params
- Look for entries that say "added X field", "added X parameter", "added X to input", "added X env var".
- The `since` field is the version of the entry that introduced it.

### Determinism rule
> Every param must cite its source entry. No params may be guessed.

---

## 5. Build Interaction Graph

Identify **edges** (interactions / dependencies) between object categories by scanning:

1. Entries that mention two or more categories (e.g. "MCP tools not available to sub-agents" → edge `mcp ↔ subagents`).
2. Params/fields that reference another category (e.g. `context: fork` in skills references subagents).
3. Explicit integration entries (e.g. "Plugin hooks" → edge `plugins ↔ hooks`).

For each edge, record:
- `source` category
- `target` category
- `label` — short description of the interaction
- `since` — version where the interaction was first established

### Determinism rule
> Edges must be backed by at least one changelog entry. No speculative edges.

---

## 6. Generate HTML

Produce a **single self-contained HTML file** (no external dependencies) at:

```
{{OUTPUT_DIR}}/{{OUTPUT_NUMBER}}-<slug>.html
```

The file must include:

### 6.1 Hero / Header
- Title: `{{FEATURE_DOMAIN}}`
- Subtitle: "Interactive changelog visualization — filtered for {{FEATURE_DOMAIN}} features"
- Link to source CHANGELOG

### 6.2 Filter Controls
- One toggle button per category (styled with category color)
- A text search box that filters entries by substring match
- An "All" button that resets filters

### 6.3 Stats Bar
- Total entry count and version count
- Per-category entry counts with colored dots

### 6.4 Interaction Graph (SVG)
- One node per category, colored by category
- Edges with labels from step 5
- Nodes are clickable → show object detail panel

### 6.5 Timeline
- Grouped by semver track (1.x, 2.0.x, 2.1.x, …)
- Each version is a collapsible card showing:
  - Version number + category badges
  - Milestone dot (larger, colored) for versions that **released** a new object
  - Expandable body with entry list (kind badge + description + param tags)
  - Params table if new params were introduced in that version

### 6.6 Object Detail Panel
- Shown when clicking a graph node
- Displays: first version, events, transports, params table with `since` column
- Mini-timeline of all entries for that object

### 6.7 Footer
- Link to source CHANGELOG
- Link to this prompt template file

### Style Requirements
- Dark theme (GitHub-dark palette)
- CSS custom properties for all category colors
- Responsive, works on mobile
- No external CSS/JS — everything inline

### Determinism rule
> The HTML structure, CSS variable names, class names, and data shape must
> follow this template exactly. Only the DATA contents change between runs.

---

## 7. Quality Checklist

Before committing, verify:

- [ ] Every entry in the HTML maps to a real CHANGELOG line
- [ ] No entries were missed (spot-check 5 random versions)
- [ ] Category badges render with correct colors
- [ ] Filter buttons show/hide cards correctly
- [ ] Search box filters entries by substring
- [ ] Graph nodes are clickable and show detail panels
- [ ] Timeline cards expand/collapse
- [ ] Milestone dots appear for "released" entries
- [ ] Params tables display for versions that introduced new params
- [ ] The page works offline (no external fetches)
- [ ] The page renders correctly at 375px and 1440px widths

---

## 8. Reuse for Other Features

To apply this process to a different feature domain:

1. **Copy** this prompt template.
2. **Replace** the placeholders in section 0:
   - `{{FEATURE_DOMAIN}}` → e.g. "IDE Integrations"
   - `{{FILTER_KEYWORDS}}` → e.g. "VS Code, IDE, extension, Neovim, JetBrains"
   - `{{OUTPUT_NUMBER}}` → next available number
3. **Run** steps 1–7 with the new values.
4. **Commit** the new HTML file alongside this template.

### Examples of other feature domains

| # | Feature Domain | Filter Keywords |
|---|---|---|
| 001 | CLI & Configuration | CLI, config, settings, flags, arguments, environment |
| 002 | Security & Permissions | permission, security, sandbox, allowedTools, deny |
| 003 | Agent Tools & Skills | hooks, skills, MCP, subagents, Task tool, plugins, agent |
| 004 | IDE Integrations | VS Code, extension, IDE, Neovim, JetBrains, LSP |
| 005 | UI & UX | theme, style, status line, markdown, rendering, keybinding |
| 006 | SDK & API | SDK, API, streaming, TypeScript, Python, non-interactive |

---

## Appendix: Data Schema (TypeScript types)

```typescript
interface ChangelogEntry {
  kind: 'added' | 'fixed' | 'changed' | 'removed' | 'released';
  cats: string[];          // category slugs
  desc: string;            // description text
  params?: string[];       // param/field names introduced
}

interface VersionBlock {
  ver: string;             // semver string
  semver: string;          // track label (e.g. "2.1.x")
  milestone?: boolean;     // true if this version released a new object
  entries: ChangelogEntry[];
}

interface ObjectParam {
  name: string;
  since: string;           // version introduced
  desc: string;
}

interface ObjectModel {
  label: string;
  color: string;
  firstVer: string;
  events?: string[];
  transports?: string[];
  params?: ObjectParam[];
  frontmatter?: ObjectParam[];
}

interface GraphEdge {
  source: string;          // category slug
  target: string;
  label: string;
  since: string;
}
```
