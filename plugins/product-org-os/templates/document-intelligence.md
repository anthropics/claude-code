# Document Intelligence Template

This template defines the standard Document Intelligence enhancement block for all document-generating skills in the V2V Product Org Plugin.

## Overview

Document Intelligence enables skills to intelligently detect whether to:
- **Create** a new document (default behavior)
- **Update** an existing document (preserving unchanged sections)
- **Find** existing documents (search and present options)

## Standard Enhancement Block

Insert this block into skill files immediately after the YAML frontmatter, before existing content.

---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

Determine the appropriate mode by analyzing user input for these signals (in priority order):

| Signal Type | Examples | Detected Mode | Confidence |
|-------------|----------|---------------|------------|
| **Explicit verb** | "update", "revise", "modify", "change" | UPDATE | 100% |
| **Explicit verb** | "create", "new", "draft", "write" | CREATE | 100% |
| **Explicit verb** | "find", "search", "list", "show existing" | FIND | 100% |
| **File path** | `@path/to/document.md` | UPDATE | 100% |
| **Document ID** | `PRD-2026-001`, `DR-2026-015` | UPDATE | 100% |
| **Definite article** | "the PRD", "the roadmap", "our pricing strategy" | UPDATE | 85% |
| **Possessive** | "my business case", "our decision record" | UPDATE | 85% |
| **Partial content** | "add section X to...", "include Y in..." | UPDATE | 80% |
| **Session context** | Document discussed earlier in conversation | UPDATE | 75% |
| **No signals** | Just topic/feature name | CREATE | 60% |

### Decision Thresholds

| Confidence Level | Action |
|------------------|--------|
| **≥85%** | Auto-proceed with detected mode |
| **70-84%** | Proceed but state assumption clearly |
| **<70%** | Ask user for clarification |

### Mode Behaviors

**CREATE Mode** (default when confidence <70% or no signals):
1. Generate complete new document using the skill's template
2. Save to appropriate location based on document type
3. Offer to register in context system if applicable (decisions, bets, learnings)

**UPDATE Mode**:
1. **Locate document**:
   - If path provided: Read directly
   - If ID provided: Search context indexes for path, then read
   - If neither: Search type-specific paths (see skill's Search Locations)
2. **Handle search results**:
   - 0 found: "No existing [type] found. Creating new document."
   - 1 found: Use that document
   - 2+ found: Present list, ask user to choose
3. **Parse existing document**:
   - Extract frontmatter/metadata
   - Identify section structure
   - Note current content for each section
4. **Merge changes**:
   - Replace only sections mentioned in user input
   - Preserve unchanged sections exactly (including formatting)
   - Add new sections in appropriate location if requested
5. **Update metadata**:
   - Keep `created:` unchanged
   - Keep `id:` unchanged
   - Update `last_modified:` to current date
   - Increment `version:` if present
6. **Show diff summary**:
   ```
   ## Changes Made

   **Updated sections:**
   - [Section name]: [brief description of change]

   **Added sections:**
   - [Section name]: [brief description]

   **Unchanged sections:**
   - [List of preserved sections]
   ```

**FIND Mode**:
1. Search type-specific paths for documents of this type
2. Present results with: title, path, last modified date, 1-line summary
3. Limit to top 5 results with option to see more
4. After presenting, ask: "Update one of these, or create new?"

### Document Registry (Preferred)

The Document Registry (`context/documents/registry.md`) is the preferred way to track and find documents. It:
- Uses the user's existing folder structure (no forced conventions)
- Tracks document status, connections, and metadata
- Enables instant lookup without filesystem searching
- References both files AND directories

**Registry Structure:**
```markdown
# Document Registry

## Documents
| ID | Type | Title | Path | Status | Created | Connected To |
|----|------|-------|------|--------|---------|--------------|
| PRD-2026-001 | PRD | Auth System | path/to/auth-prd.md | Active | 2026-01-15 | SB-2026-003 |

## Directories
| Name | Path | Contains | Notes |
|------|------|----------|-------|
| Product Specs | project/specs/ | Feature specs | Main spec location |
```

**Search Priority:**
1. **Check registry first** - instant lookup by ID, type, or title
2. **Check registered directories** - search in user-defined locations
3. **Fallback: filesystem search** - use common patterns (below) if registry is empty

### Fallback Search Paths

When registry is not available, search these common patterns:

| Document Type | Common Paths |
|---------------|--------------|
| PRD/Specs | `requirements/`, `specs/`, `prds/`, `docs/` |
| Roadmaps | `roadmap/`, `strategy/`, `planning/` |
| Decisions | `decisions/`, `context/decisions/` |
| GTM | `gtm/`, `marketing/`, `launch/` |
| Business | `business/`, `strategy/`, `pricing/` |

### Handling Multiple Documents

When search finds multiple candidates:

| Scenario | Action |
|----------|--------|
| **Recent & clearly active** | Offer to update, note last modified date |
| **Old & potentially outdated** | Note as "possibly outdated (last modified [date])" |
| **Multiple active versions** | Present all options, ask which to update |
| **None found** | Proceed with CREATE mode |
| **One found but user said "new"** | Create new, offer to reference existing |

### Ambiguity Resolution

When confidence is below 70%, present options concisely:

```markdown
I found [N] existing [document type](s) that might be relevant:

1. **[Title]** (`[path]`) - Modified [date]
   > [First ~80 chars of summary/description]

2. **[Title]** (`[path]`) - Modified [date]
   > [First ~80 chars of summary/description]

Would you like to:
- **Update** one of these? (reply with number)
- **Create** a new [document type]?
- **See more** existing documents?
```

### Error Handling

| Error Case | Response |
|------------|----------|
| File path provided but doesn't exist | "Document not found at [path]. Create new document here?" |
| Search returns 0 results for UPDATE intent | "No existing [type] found. Creating new document." |
| Search fails (permissions, etc.) | "Couldn't search for existing documents. Creating new document." |
| Document read fails | "Couldn't read existing document. Would you like to create a new one?" |
| Malformed existing document | "Existing document has unexpected structure. Create new or attempt merge?" |

---

## Customization per Skill

Each skill file should customize only the **Search Locations** section with paths appropriate to that document type. All other sections remain standard.

Example customization for `/prd`:

```markdown
### Search Locations for PRDs

When finding or updating, search these paths:
- `requirements/`
- `prds/`
- `specs/`
- `docs/requirements/`
- `context/decisions/` (for linked PRDs)
```

---

## Integration with Context Layer

After CREATE or UPDATE:
- For decisions: Offer `/context-save` to add to decision registry
- For strategic bets: Offer `/context-save` to add to bet registry
- For reviews/retrospectives: Offer to extract learnings

The context layer enables future FIND operations to locate documents by topic, not just by path.
