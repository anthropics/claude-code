# Branch Create Template — Deterministic Feature Extraction

Use this template when starting a new feature extraction. It provides the full context and checklist that maps 1:1 to the PR template at `.github/PULL_REQUEST_TEMPLATE/deterministic-object-usage.md`.

> **Target repo**: `jadecli-experimental/claude-code` (fork)
> All pushes and PRs go to the fork — never to `anthropics/claude-code`.

---

## How to Use

1. Fill in the **Execution Parameters** below
2. Create your branch: `git checkout -b claude/{feature-kebab}-{session-id}`
3. Work through the **Task Sequence** in order — each task maps to a conventional commit
4. Push to the fork: `git push -u origin claude/{feature-kebab}-{session-id}`
5. Open PR **on the fork**: `gh pr create --repo jadecli-experimental/claude-code` using the `deterministic-object-usage` PR template — the checklist will already match your commits

---

## Execution Parameters

Fill these in before starting:

```
CHANGELOG_URL:  _______________________________________________
FEATURE_NAME:   _______________________________________________
FEATURE_KEYWORDS: _____________________________________________
OUTPUT_DIR:     deterministic-object-usage/
OUTPUT_NUMBER:  ___ (check CLAUDE.md for next available number)
BRANCH_NAME:    claude/___________________-{session-id}
```

---

## Pre-Flight

Before writing any code, complete these reads:

```
ci: read CLAUDE.md
  → deterministic-object-usage/CLAUDE.md
  → Note the next available number
  → Note accumulated insights to apply
  → Note current extraction inventory

ci: read process doc
  → deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md
  → Confirm JSONL schema (5 line types: meta, era, object, release, interaction)
  → Confirm HTML structure requirements
  → Confirm quality checklist
```

---

## Task Sequence

Each task below produces one conventional commit. Work top to bottom. The commit type prefix tells you what kind of change it is.

### Phase 1 — Setup

| # | Commit Type | Task | Output |
|---|---|---|---|
| 1 | `ci` | Create branch from main | Branch `claude/{feature-kebab}-{session-id}` |
| 2 | `ci` | Read CLAUDE.md, confirm next number | Mental model of current state |
| 3 | `ci` | Read process doc, confirm schema | Confirmed JSONL + HTML requirements |

### Phase 2 — Changelog Fetch & Parse

| # | Commit Type | Task | Output |
|---|---|---|---|
| 4 | `feat` | Fetch raw changelog from URL | Raw markdown content in memory |
| 5 | `feat` | Parse all version entries | Version list with categories + bullets |
| 6 | `feat` | Count total versions for meta line | `total_versions_scanned: N` |

**Context for Phase 2:**
- The changelog uses `## <version>` headings with `### Added/Changed/Fixed/Removed` subcategories
- Build the version list newest-to-oldest (the changelog's natural order), then reverse for scanning
- Record the total version count — it goes in the `meta` JSONL line

### Phase 3 — JSONL Extraction (the core work)

| # | Commit Type | Task | Output |
|---|---|---|---|
| 7 | `feat` | Define initial keyword set from `FEATURE_KEYWORDS` | Keyword list ready for matching |
| 8 | `feat` | Write `meta` line to `.insights.jsonl` | First line of JSONL written |
| 9 | `feat` | Scan oldest→newest: write `era` lines at boundaries | Era markers in JSONL |
| 10 | `feat` | Scan: write `object` lines on first discovery | Object registry in JSONL (deduplicated) |
| 11 | `feat` | Scan: write `release` lines for matching versions | Classified entries in JSONL |
| 12 | `feat` | Scan: write `interaction` lines for milestones | Flow diagrams in JSONL |
| 13 | `feat` | Update meta keywords with expanded set | Final keyword set recorded |

**Context for Phase 3:**
- Scanning order is **chronological** (oldest version first) — this produces append-only natural ordering
- Object deduplication: only write an `object` line the FIRST time you see a new `id`
- Milestone heuristic: new capability class = milestone; bugfixes/params are never milestones
- Keyword expansion: as you scan, extract new proper nouns (tool names, config keys, hooks) from matching entries
- Each JSONL line must be valid JSON independently (streamable)

**Classification reference:**

| Field | Values |
|---|---|
| `change_type` | `added`, `changed`, `fixed`, `removed` |
| `object_category` | `agent`, `tool`, `hook`, `param`, `event` |
| `is_milestone` | `true` only for new capability classes |
| `is_breaking` | `true` only for behavior changes/removals |

### Phase 4 — JSONL Validation

| # | Commit Type | Task | Expected |
|---|---|---|---|
| 14 | `test` | Validate every line is parseable JSON | 0 parse errors |
| 15 | `test` | Validate ordering (meta→eras→objects→releases) | Correct order |
| 16 | `test` | Validate no duplicate object ids | 0 duplicates |
| 17 | `test` | Validate milestone↔interaction correspondence | Every milestone has interaction |
| 18 | `test` | Validate release count matches meta | `versions_matched` is accurate |

**Quick validation script:**

```python
import json
with open("{NNN}-{feature}.insights.jsonl") as f:
    lines = f.readlines()
types = {}
obj_ids = []
for i, line in enumerate(lines, 1):
    obj = json.loads(line.strip())
    t = obj["type"]
    types[t] = types.get(t, 0) + 1
    if t == "object":
        assert obj["id"] not in obj_ids, f"Duplicate object: {obj['id']}"
        obj_ids.append(obj["id"])
assert json.loads(lines[0])["type"] == "meta", "First line must be meta"
print(f"Lines: {len(lines)} | Types: {types} | Objects: {len(obj_ids)}")
```

### Phase 5 — HTML Generation

| # | Commit Type | Task | Output |
|---|---|---|---|
| 19 | `feat` | Generate `{NNN}-{feature}.html` from JSONL | HTML file created |
| 20 | `feat` | Verify sidebar has all objects grouped by category | Object registry rendered |
| 21 | `feat` | Verify timeline has all releases as expandable cards | Timeline cards rendered |
| 22 | `feat` | Verify era dividers present | Section breaks rendered |
| 23 | `feat` | Verify interaction diagrams in milestone cards | Flow diagrams rendered |
| 24 | `feat` | Verify filter buttons work | All 7 filters functional |
| 25 | `feat` | Verify footer references JSONL + changelog + process doc | Attribution complete |

**Context for Phase 5:**
- HTML must be **self-contained** — zero external resources (no CDN, no fetch, no external fonts)
- Use the same visual design language: dark theme, monospace, 5-color category system
- The JSONL is the single source of truth — the HTML should be fully derivable from it
- Color mapping: Blue=Agents, Green=Tools, Orange=Hooks, Purple=Params, Pink=Events

### Phase 6 — HTML Validation

| # | Commit Type | Task | Expected |
|---|---|---|---|
| 26 | `test` | Verify no external resource references | 0 CDN/fetch/external links |
| 27 | `test` | Cross-reference: every JSONL entry has HTML element | Full coverage |
| 28 | `test` | Test filter/expand/sidebar interactions | All interactive features work |

### Phase 7 — Documentation Updates

| # | Commit Type | Task | File |
|---|---|---|---|
| 29 | `docs` | Add row to CLAUDE.md "Current Extractions" table | `CLAUDE.md` |
| 30 | `docs` | Increment next available number in CLAUDE.md | `CLAUDE.md` |
| 31 | `docs` | Append any new insights discovered | `CLAUDE.md` |
| 32 | `docs` | Record any edge cases or changelog quirks | `CLAUDE.md` |

### Phase 8 — Ship

| # | Commit Type | Task | Output |
|---|---|---|---|
| 33 | `chore` | Stage all files, commit with descriptive message | Commit created |
| 34 | `chore` | Push to fork: `git push -u origin claude/{feature-kebab}-{session-id}` | Branch on `jadecli-experimental/claude-code` |
| 35 | `chore` | Open PR on fork: `gh pr create --repo jadecli-experimental/claude-code` | PR created (NOT on `anthropics/claude-code`) |

---

## Commit Message Templates

Use these conventional commit formats for each phase:

```bash
# Phase 1 — no commits (reads only)

# Phase 2+3 — single commit covering fetch through JSONL
git commit -m "feat: extract {FEATURE_NAME} feature to insights JSONL

Scan {CHANGELOG_URL} for {FEATURE_NAME} entries.
- {N} versions matched out of {TOTAL} scanned
- {N} unique objects discovered across {N} eras
- {N} interaction patterns documented for milestone releases

Keywords: {final expanded keyword list summary}"

# Phase 4 — validation (can fold into above if clean)
git commit -m "test: validate {NNN}-{feature} JSONL structure

- All {N} lines parse as valid JSON
- {N} unique object ids, no duplicates
- meta→era→object→release ordering verified
- All {N} milestone releases have interaction lines"

# Phase 5+6 — HTML generation
git commit -m "feat: generate {FEATURE_NAME} interactive HTML from JSONL

- Self-contained HTML with inline CSS/JS (no external deps)
- {N} releases rendered as expandable timeline cards
- {N} objects in sidebar registry
- {N} era dividers, {N} interaction diagrams
- 7 filter categories, click-to-scroll sidebar"

# Phase 7 — docs
git commit -m "docs: update CLAUDE.md with {FEATURE_NAME} extraction #{NNN}

- Added extraction to Current Extractions table
- Next available number: {NNN+1}
- Recorded {N} new insights from this extraction"

# Phase 8 — push to fork and open PR
git push -u origin claude/{feature-kebab}-{session-id}
gh pr create --repo jadecli-experimental/claude-code \
  --template deterministic-object-usage.md
# IMPORTANT: Always target jadecli-experimental/claude-code, never anthropics/claude-code
```

---

## Notes

- The task numbers (1-35) are a maximum — many can be combined into fewer commits in practice
- The minimum viable commit sequence is: **3 commits** (feat: JSONL, feat: HTML, docs: CLAUDE.md)
- The PR template checklist at `.github/PULL_REQUEST_TEMPLATE/deterministic-object-usage.md` mirrors this sequence exactly
- Both templates use the same conventional commit types so that commits and PR checkboxes stay in sync
