# Deterministic Prompt: Filter a CHANGELOG by Feature → Animated Visualization

> A reusable, step-by-step process for extracting any single feature domain from
> a semver-formatted CHANGELOG.md and producing a self-contained interactive HTML
> page with **Ghostty-style ASCII animation** and **beautiful-mermaid SVG diagrams**
> that visualises that feature's lifecycle.

## Toolchain

| Tool | Role |
|------|------|
| [`@vercel/beautiful-mermaid`](https://github.com/vercel-labs/beautiful-mermaid) | Renders mermaid syntax → animated SVG (16 themes) + ASCII (Unicode box-drawing) |
| [`generate.mjs`](generate.mjs) | Build pipeline: mermaid → beautiful-mermaid → Ghostty-style frames → HTML |
| [Ghostty animation technique](https://ghostty.org) | Pre-rendered frames via `requestAnimationFrame`, character-density mapping |
| [Agent Skills format](https://github.com/vercel-labs/agent-skills) | Skill structure (SKILL.md + YAML frontmatter) for reuse across 40+ AI agents |

### Quick start

```bash
cd deterministic-object-usage
npm install                           # installs @vercel/beautiful-mermaid
node generate.mjs --output 003-claude-agent-tools.html
```

### Invoking as a Claude Code skill

```
/changelog-visual Agent Tools & Skills
/changelog-visual IDE Integrations --output 004-ide-integrations.html
```

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

## 6. Generate Visualization

### 6a. Express diagrams as Mermaid syntax

From the data gathered in steps 3–5, produce two mermaid diagrams:

1. **Interaction graph** (`graph TD`) — one node per category, edges from step 5.
   Two versions: rich (with HTML labels `<b>`, `<i>`) for SVG, plain for ASCII.
2. **Timeline graph** (`graph LR`) — milestone versions as a left-to-right chain.

Update the constants in `generate.mjs`:
- `INTERACTION_GRAPH` / `INTERACTION_GRAPH_ASCII`
- `TIMELINE_GRAPH` / `TIMELINE_GRAPH_ASCII`
- `COLORS` — one entry per category with `{hex, label}`
- `WORD_COLORS` — keywords/versions mapped to their category color

### 6b. Run the build pipeline

```bash
cd {{OUTPUT_DIR}}
npm install
node generate.mjs --output {{OUTPUT_NUMBER}}-<slug>.html
```

The pipeline executes:

1. **SVG rendering** — `renderMermaid(diagram, { ...THEMES["vercel-dark"], animate: true })`
   produces animated SVGs with rank-by-rank reveal, edge-draw, and arrowhead motion.
2. **ASCII rendering** — `renderMermaidAscii(diagram)` produces Unicode box-drawing art.
3. **Frame generation** — two animation phases inspired by [Ghostty](https://ghostty.org):
   - **Reveal phase**: characters materialise progressively (top→bottom, left→right)
     with a "shimmer" effect where upcoming characters briefly show density glyphs.
   - **Shimmer phase**: box-drawing characters cycle through the density ramp
     (`· ~ o x + = * % $ @`) using a sinusoidal wave function.
4. **Colorisation** — recognised keywords are wrapped in `<span style="color:...">`.
5. **HTML assembly** — frames are embedded as JSON arrays, played by an
   `AnimationManager` class using `requestAnimationFrame` with delta-time tracking.

### 6c. Output structure

The generated HTML includes:

| Section | Content |
|---------|---------|
| **Hero** | Title, subtitle, source link |
| **Mode tabs** | Toggle between ASCII Animation and SVG Diagrams |
| **Legend** | Category color dots |
| **Terminal 1** | Interaction graph — Ghostty-style terminal chrome (traffic lights, title bar) with animated ASCII + play/pause/replay/speed controls |
| **Terminal 2** | Timeline — same treatment |
| **SVG mode** | beautiful-mermaid animated SVGs (vercel-dark theme) |
| **Footer** | Links to generate.mjs and CHANGELOG |

### Style Requirements
- Dark theme (`--bg: #0d1117`, terminal: `#0a0a0a`)
- CSS custom properties for all category colors
- Responsive `clamp()` font sizing
- Ghostty-inspired terminal chrome (traffic-light dots, border-radius)
- No external CSS/JS — everything inline, works offline

### Animation Requirements
- Default 24 FPS via `requestAnimationFrame` with delta accumulator
- Speed control: 0.5x / 1x / 2x / 4x
- Auto-play on scroll into view (IntersectionObserver)
- Pause on tab blur, resume on focus
- Frame counter display

### Determinism rule
> The mermaid syntax is the single source of truth for both SVG and ASCII.
> The HTML structure, CSS variable names, and animation engine are fixed.
> Only the mermaid definitions, COLORS, and WORD_COLORS change between runs.

---

## 7. Quality Checklist

Before committing, verify:

- [ ] Mermaid syntax parses without errors in both SVG and ASCII modes
- [ ] `node generate.mjs` completes without errors
- [ ] ASCII animation plays with progressive reveal → shimmer loop
- [ ] SVG diagrams render with correct theme and animation
- [ ] Category keyword coloring is correct (spot-check 3 keywords)
- [ ] Play/Pause/Replay/Speed controls work for both terminals
- [ ] Frame counter increments correctly
- [ ] Mode tabs switch between ASCII and SVG views
- [ ] Auto-play triggers on scroll into view
- [ ] Animation pauses on tab blur, resumes on focus
- [ ] The page works offline (no external fetches)
- [ ] The page renders correctly at 375px and 1440px widths
- [ ] HTML file size is reasonable (<1MB for 50-60 frame animations)

---

## 8. Reuse for Other Features

To apply this process to a different feature domain:

### Option A: Via Claude Code skill (recommended)

```
/changelog-visual <Feature Domain Name> --output <NNN>-<slug>.html
```

The skill will execute steps 1–7 automatically, updating `generate.mjs` with
the new mermaid definitions and re-running the build.

### Option B: Manual

1. **Replace** the placeholders in section 0.
2. **Run** steps 1–5 to gather data and build mermaid syntax.
3. **Edit** `generate.mjs`:
   - Update `INTERACTION_GRAPH` / `INTERACTION_GRAPH_ASCII`
   - Update `TIMELINE_GRAPH` / `TIMELINE_GRAPH_ASCII`
   - Update `COLORS` and `WORD_COLORS`
4. **Run** `node generate.mjs --output <NNN>-<slug>.html`
5. **Verify** with the quality checklist.
6. **Commit** the new HTML file alongside this template.

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
