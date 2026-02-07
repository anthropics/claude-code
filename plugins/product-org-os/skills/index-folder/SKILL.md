---
name: index-folder
description: Index a folder's contents into the context system for fast retrieval
model: haiku
tools:
  - Read
  - Write
  - Edit
  - Glob
---

# Index Folder

Scan a folder and add its contents to `context/index.json` for fast topic-based retrieval.

## Trigger Patterns

- `/index-folder [path]` - Index all supported files in path
- `/index-folder [path] --recursive` - Include subfolders
- `/index-folder [path] --type [type]` - Only index specific type

## Behavior

### 1. Validate Path

Confirm the path exists and is accessible:
- Accept relative paths from project root
- Accept absolute paths
- Reject paths outside the project

### 2. Scan for Supported Files

**Supported file types:**
- `.md` - Markdown documents
- `.json` - JSON data files (skip `package.json`, `node_modules`)

**Always skip:**
- `node_modules/`
- `.git/`
- `__pycache__/`
- `.venv/`, `venv/`
- `dist/`, `build/`
- Files starting with `.`
- Files over 100KB (likely not documents)

### 3. Extract Metadata

For each file, extract:

```json
{
  "id": "DOC-YYYY-NNN",
  "title": "[H1 or filename]",
  "type": "[detected type]",
  "path": "[relative path]",
  "topics": ["topic1", "topic2"],
  "phase": "[V2V phase if detectable]",
  "created": "[file creation date]",
  "lastAccessed": "[current date]",
  "size": "[file size]"
}
```

**Type Detection:**
| Pattern | Type |
|---------|------|
| Contains "PRD" or in `prd/` | prd |
| Contains "Decision Record" or `DR-` | decision |
| Contains "Strategic Bet" or `SB-` | bet |
| Contains "Roadmap" | roadmap |
| Contains "GTM" or "Go-to-Market" | gtm |
| Contains "Analysis" | analysis |
| Contains "Feedback" or `FB-` | feedback |
| Contains "Learning" or `L-` | learning |

**Topic Extraction:**
- Extract from document headers (H1, H2)
- Extract from tags if present in frontmatter
- Extract key nouns from first paragraph
- Limit to 5-10 topics per document

**Phase Detection:**
Look for V2V phase indicators:
- "Strategic Foundation" → phase1
- "Strategic Decision" → phase2
- "Commitment" or "Roadmap" → phase3
- "Execution" or "Launch" → phase4
- "Outcome" or "Value" → phase5
- "Learning" or "Retrospective" → phase6

### 4. Update Index

Read `context/index.json` and:

1. **Add new entries** - Files not already indexed
2. **Update existing entries** - Files that have changed (by path)
3. **Update topicIndex** - Add document IDs to topic arrays
4. **Update typeIndex** - Add document IDs to type arrays
5. **Update phaseIndex** - Add document IDs to phase arrays
6. **Update lastUpdated** - Set to current date

### 5. Output Report

```markdown
# Folder Indexed: [path]

**Scanned**: [N] files
**Added**: [N] new entries
**Updated**: [N] existing entries
**Skipped**: [N] (already indexed, unchanged)

## New Entries

| ID | Title | Type | Topics |
|----|-------|------|--------|
| DOC-2026-015 | Authentication PRD | prd | auth, security, login |
| DOC-2026-016 | Pricing Decision | decision | pricing, enterprise |

## Topic Summary

| Topic | Documents |
|-------|-----------|
| authentication | 5 |
| pricing | 3 |
| enterprise | 3 |
| security | 2 |

---

*Index updated at context/index.json*
```

## Index Format

The `context/index.json` structure:

```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-25",
  "entries": [
    {
      "id": "DOC-2026-001",
      "title": "Authentication PRD",
      "type": "prd",
      "path": "documents/prd-auth.md",
      "topics": ["authentication", "security", "login", "oauth"],
      "phase": "phase3",
      "created": "2026-01-15",
      "lastAccessed": "2026-01-25",
      "size": 4520
    }
  ],
  "topicIndex": {
    "authentication": ["DOC-2026-001", "DOC-2026-005"],
    "pricing": ["DOC-2026-003", "DOC-2026-007"]
  },
  "typeIndex": {
    "prd": ["DOC-2026-001"],
    "decision": ["DOC-2026-003"],
    "bet": ["DOC-2026-002"]
  },
  "phaseIndex": {
    "phase1": ["DOC-2026-010"],
    "phase2": ["DOC-2026-003"],
    "phase3": ["DOC-2026-001", "DOC-2026-005"]
  }
}
```

## ID Generation

Generate unique IDs:
- Format: `DOC-YYYY-NNN`
- YYYY = current year
- NNN = sequential number (001, 002, ...)
- Check existing entries to avoid collisions

## Notes

- Indexing is additive - existing entries are preserved
- To remove stale entries, use `/index-cleanup`
- Large folders may take time - provide progress updates
- Topics are normalized to lowercase
- Duplicate entries (same path) are updated, not duplicated
