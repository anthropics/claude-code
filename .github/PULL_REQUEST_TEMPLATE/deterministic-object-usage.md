## Feature Extraction: `{FEATURE_NAME}`

> **Source**: `{CHANGELOG_URL}`
> **Extraction #**: `{NNN}`
> **Branch**: `claude/{feature-kebab}-{session-id}`

---

### build: Extraction Parameters

- **CHANGELOG_URL**: <!-- e.g. https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md -->
- **FEATURE_NAME**: <!-- e.g. Hooks System -->
- **FEATURE_KEYWORDS**: <!-- comma-separated initial keywords -->
- **OUTPUT_NUMBER**: <!-- e.g. 002 -->

---

### Conventional Commit Checklist

Complete each task in order. Each maps to a commit using the indicated conventional commit type. Check the box only after the commit is pushed.

#### ci: Environment & Branch Setup

- [ ] **ci: create feature branch** — Branch created from main following naming convention `claude/{feature-kebab}-{session-id}`
- [ ] **ci: read CLAUDE.md** — Read `deterministic-object-usage/CLAUDE.md` for current state, next available number, and accumulated insights
- [ ] **ci: verify process doc** — Read `000-claude-filter-changelog-feature-to-html-prompt.md` and confirm the process is current

#### feat: Changelog Fetch & Parse (Step 1)

- [ ] **feat: fetch changelog** — Fetch raw changelog from `CHANGELOG_URL` and extract full markdown content
- [ ] **feat: parse version structure** — Identify all version entries with their Added/Changed/Fixed/Removed categories
- [ ] **feat: build version list** — Create ordered version list (newest to oldest) — record total count for `meta` line

#### feat: Keyword Matching & JSONL Extraction (Step 2)

- [ ] **feat: define keyword set** — Start with `FEATURE_KEYWORDS`, prepare for iterative expansion during scan
- [ ] **feat: write meta line** — Write `type: "meta"` as first line of `{NNN}-{feature}.insights.jsonl`
- [ ] **feat: scan and write eras** — Identify era boundaries, write `type: "era"` lines at each transition
- [ ] **feat: scan and write objects** — Write `type: "object"` line for each newly discovered object (deduplicated by `id`)
- [ ] **feat: scan and write releases** — Write `type: "release"` line for each matching version with classified entries
- [ ] **feat: scan and write interactions** — Write `type: "interaction"` line for each milestone release
- [ ] **feat: expand keywords** — Update `meta` line's keyword set with any new terms discovered during scanning

#### test: JSONL Validation (Step 2 QA)

- [ ] **test: validate JSON** — Every line parses as valid JSON independently
- [ ] **test: validate ordering** — `meta` first, then `era` before its releases, `object` before first reference
- [ ] **test: validate deduplication** — No duplicate `object` ids
- [ ] **test: validate completeness** — Every milestone release has a corresponding `interaction` line
- [ ] **test: validate entry count** — `versions_matched` in `meta` matches actual `release` line count

#### feat: HTML Generation (Step 4)

- [ ] **feat: generate HTML** — Create `{NNN}-{feature}.html` from the JSONL source of truth
- [ ] **feat: sidebar registry** — All `object` lines rendered in sidebar grouped by category
- [ ] **feat: timeline cards** — All `release` lines rendered as expandable cards in chronological order
- [ ] **feat: era dividers** — All `era` lines rendered as section breaks in the timeline
- [ ] **feat: interaction diagrams** — All `interaction` lines rendered inside their milestone cards
- [ ] **feat: filter controls** — Filter buttons working for: Agents, Tools, Hooks, Params, Milestones, Breaking
- [ ] **feat: footer attribution** — Footer references changelog URL, JSONL file, and process doc

#### test: HTML Validation (Step 4 QA)

- [ ] **test: self-contained** — No external CSS, JS, fonts, or fetch calls — renders fully offline
- [ ] **test: cross-reference JSONL** — Every release/object/era/interaction in JSONL has a corresponding HTML element
- [ ] **test: interactive features** — Filter buttons, expand/collapse, sidebar click-to-scroll all functional

#### docs: Knowledge Base Updates (Step 5)

- [ ] **docs: update CLAUDE.md extraction table** — Add new row to "Current Extractions" with JSONL stats
- [ ] **docs: update next available number** — Increment the next available number in CLAUDE.md
- [ ] **docs: record new insights** — Append any new process insights discovered during this extraction
- [ ] **docs: record edge cases** — Document any changelog quirks or classification ambiguities encountered

#### chore: Final Commit & PR

- [ ] **chore: final commit** — All files staged and committed with descriptive message
- [ ] **chore: push to branch** — `git push -u origin claude/{feature-kebab}-{session-id}`

---

### Summary

<!-- 1-3 bullet points summarizing what this extraction covers -->

-
-
-

### JSONL Stats

| Metric | Value |
|---|---|
| Total lines | |
| Objects | |
| Releases | |
| Eras | |
| Interactions | |
| Keywords (final) | |

### Files Changed

- [ ] `deterministic-object-usage/{NNN}-{feature}.insights.jsonl` (new)
- [ ] `deterministic-object-usage/{NNN}-{feature}.html` (new)
- [ ] `deterministic-object-usage/CLAUDE.md` (updated)

### MLflow Trace Analysis

> **Note**: This section is required once MLflow tracing is enabled. Until then, fill in what you can manually.

- **Trace ID**: `N/A — tracing not yet enabled`
- **Experiment**: `deterministic-object-usage`
- **Total tokens**: <!-- estimated or actual -->
- **Span breakdown**:

  | Step | Tokens | Duration |
  |---|---|---|
  | Changelog fetch & parse | | |
  | Keyword matching & JSONL write | | |
  | HTML generation | | |

- **Insights from trace**:
  - <!-- What was most expensive? Any retries? -->
- **Comparison to previous extractions**:
  - <!-- Token delta vs prior extractions -->

---

*Process defined in `deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md`*
