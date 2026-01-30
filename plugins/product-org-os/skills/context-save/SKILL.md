---
name: context-save
description: Save decision, bet, or learning to the context registry
argument-hint: [decision-record | strategic-bet | learning]
---

Save a **decision record**, **strategic bet**, or **learning** to the persistent context registry.

## V2V Phase

**Phase 6: Learning & Adaptation** - This skill persists organizational knowledge for future use.

**Prerequisites**: Decision record, strategic bet, or learning created
**Outputs used by**: All phases (enables organizational memory)

## Auto-Initialization

**Before saving, ensure the context folder structure exists.** If any required folder or file is missing, create it:

1. Check if `context/` folder exists - if not, inform user to run `/setup` first OR create the basic structure:
   - `context/decisions/index.md`
   - `context/bets/index.md`
   - `context/assumptions/registry.md`
   - `context/portfolio/active-bets.md`
   - `context/learnings/index.md`

2. When creating year folders (`context/decisions/2026/`), create them automatically.

## Purpose

The context registry provides organizational memory. This skill extracts key information from documents and saves them to the appropriate index, enabling future recall and cross-referencing.

## When to Use

Invoke `/context-save` after:
- Creating a decision record with `/decision-record`
- Formulating a strategic bet with `/strategic-bet`
- Completing a retrospective with `/retrospective`
- Completing an outcome review with `/outcome-review`
- Completing a decision quality audit with `/decision-quality-audit`

## Process

### 1. Identify What to Save

Ask the user what they want to save:
- **Decision Record** → Extract to `context/decisions/`
- **Strategic Bet** → Extract to `context/bets/` and `context/portfolio/`
- **Learning** → Extract to `context/learnings/`
- **Assumptions** → Extract to `context/assumptions/registry.md`

### 2. Extract Key Information

#### For Decision Records
Extract and save:
```markdown
| ID | Title | Date | Owner | Product | Status | Tags |
```
- Include Product field if specified (for multi-product organizations)
- Generate tags from content (3-5 relevant keywords)
- Link related decisions if mentioned
- Extract assumptions to assumption registry

#### For Strategic Bets
Extract and save:
```markdown
| ID | Title | Date | Owner | Product | Status | Key Assumption |
```
- Include Product field if specified (for multi-product organizations)
- Add to `context/portfolio/active-bets.md` if status is Active
- Extract ALL explicit assumptions to `context/assumptions/registry.md`
- Note upcoming checkpoints

#### For Learnings
Extract and save:
```markdown
| ID | Learning | Source | Date | Product | Tags | Confidence |
```
- Include Product field if applicable (for multi-product organizations)
- Categorize by type (Strategy, Product, GTM, Customer, Process)
- Link to source document

#### For Assumptions
Extract and save:
```markdown
| ID | Assumption | Source | Confidence | Validation Method | Status | Outcome |
```
- Generate assumption ID (A-NNN, sequential)
- Link back to source decision/bet
- Set initial status to "Pending"

### 3. Update Index Files

1. Read the current index file
2. Add the new entry to the appropriate table
3. Update "Last updated" timestamp
4. Update quick filters/categories
5. Write the updated index

### 4. Save Full Record

For decisions and bets, also save the full record:
- Create year folder if needed: `context/[type]/[YYYY]/`
- Save full document as `[ID].md`

### 5. Update JSON Index

**Also update `context/index.json` for fast retrieval:**

1. Read `context/index.json`
2. Add entry to the `entries` array:
   ```json
   {
     "id": "DR-2026-001",
     "title": "API Versioning Strategy",
     "type": "decision",
     "path": "context/decisions/2026/DR-2026-001.md",
     "topics": ["api", "versioning", "compatibility"],
     "phase": "phase2",
     "created": "2026-01-25",
     "lastAccessed": "2026-01-25"
   }
   ```
3. Update `topicIndex` - add ID to each topic array
4. Update `typeIndex` - add ID to the type array (decision, bet, learning)
5. Update `phaseIndex` - add ID to the appropriate phase array
6. Update `lastUpdated` timestamp
7. Write updated JSON

**Topic extraction:**
- Use tags from the document
- Extract key terms from title
- Include product name if multi-product org

### 6. Confirm Save

Report what was saved:
```
Saved to context registry:
- Decision DR-2026-001 added to decisions/index.md
- 3 assumptions extracted to assumptions/registry.md
- Full record saved to decisions/2026/DR-2026-001.md
- JSON index updated (topics: api, versioning, compatibility)
```

## Instructions

1. Ask what type of content to save (or detect from recent conversation)
2. If the content was just created, extract from it directly
3. If content is in a file, read it using @path/to/file.md syntax
4. Extract metadata following the formats above
5. Read current index files before updating
6. Preserve existing entries when adding new ones
7. Generate sequential IDs based on existing entries
8. Update all affected index files
9. Report what was saved and where

## ID Generation

- **Decisions**: `DR-[YYYY]-[NNN]` (e.g., DR-2026-001)
- **Bets**: `SB-[YYYY]-[NNN]` (e.g., SB-2026-003)
- **Assumptions**: `A-[NNN]` (e.g., A-015) - sequential across all assumptions
- **Learnings**: `L-[NNN]` (e.g., L-042) - sequential across all learnings

Check existing indexes to determine next available number.
