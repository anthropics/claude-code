---
name: context-recall
description: "Query past decisions, bets, learnings, and documents by topic. Use when user says 'what did we decide about', 'find past decisions', 'recall context on', or needs historical context."
argument-hint: [topic or keyword]
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: context-layer
compatibility: Requires Product Org OS v3+ context layer and rules
---

Recall relevant **past context** before making new decisions or starting strategic work.

## V2V Phase

**Cross-phase** - This skill is used before work in any phase to surface relevant history.

**Prerequisites**: Context registry populated (decisions, bets, learnings saved)
**Outputs used by**: Decision-making at any phase

## Purpose

Before making a decision that may have been made before, or starting work in an area with existing strategic context, query the context registry to surface relevant history.

## When to Use

Invoke `/context-recall [topic]` when:
- Starting work on a new decision
- Beginning strategic planning in an area
- Checking if similar decisions exist
- Understanding constraints from past decisions
- Finding relevant learnings to apply

## Process

### 1. Parse the Query

Accept a topic or keyword from the user, with optional filters:
- `/context-recall pricing` → Search for pricing-related context
- `/context-recall enterprise` → Search for enterprise-related context
- `/context-recall pricing product:AXIA` → Search filtered to AXIA product
- `/context-recall pricing --include-demo` → Include demo data even if production data exists
- `/context-recall pricing --demo-only` → Show only demo data

**Filters**:
- `product:[name]` - Filter to specific product
- `--include-demo` - Include demo data (marked with `[DEMO]`)
- `--demo-only` - Show only demo data (for testing/learning)

### 1b. Check for Production Data (Demo Filtering)

**Before searching**, determine if production data exists:

1. Check main context folders (NOT `context/demo/`):
   - `context/decisions/` - Any non-demo decision files?
   - `context/bets/` - Any non-demo bet files?
   - `context/feedback/index.md` - Any non-demo entries?

2. Apply demo filtering rule:
   | Production Data? | Flag | Behavior |
   |-----------------|------|----------|
   | No | (any) | Include demo with `[DEMO]` markers |
   | Yes | (none) | **Exclude demo data**, show excluded count |
   | Yes | `--include-demo` | Include demo with `[DEMO]` markers |
   | (any) | `--demo-only` | Only demo data |

3. Demo data is identified by:
   - Path contains `context/demo/`
   - ID contains "DEMO" (e.g., `DR-DEMO-001`)
   - JSON entry has `demo: true`

### 2. Search JSON Index First (Fast Path)

**Primary search method**: Use `context/index.json` for fast topic-based retrieval.

```json
// Read context/index.json
{
  "topicIndex": {
    "pricing": ["DR-2026-001", "DOC-2026-015"],
    "api": ["DR-2026-003", "DOC-2026-008"]
  }
}
```

1. Check `topicIndex` for exact topic match
2. Check `typeIndex` if user specifies a type (e.g., "prd", "decision")
3. Check `phaseIndex` if user specifies a phase
4. Retrieve matching `entries` by ID
5. Get file paths from entries for full document access

**If JSON index doesn't exist or has no matches**, fall back to markdown index search.

### 3. Search Markdown Indexes (Fallback)

If JSON index has no matches, search across markdown indexes:

#### Decisions (`context/decisions/index.md`)
- Search titles and tags
- Return matching decision summaries

#### Strategic Bets (`context/bets/index.md`)
- Search titles and key assumptions
- Return matching bet summaries

#### Assumptions (`context/assumptions/registry.md`)
- Search assumption text
- Return matching assumptions with status

#### Learnings (`context/learnings/index.md`)
- Search learning text and tags
- Return matching learnings

#### Active Portfolio (`context/portfolio/active-bets.md`)
- Check if topic relates to active bets
- Surface current strategic context

#### Strategic Documents (`context/documents/index.md`)
- Search titles, type, skill, and auto-generated tags
- Match on document type (PRD, roadmap, GTM strategy, etc.)
- Return matching documents with file location

### 3. Read Full Records if Needed

For highly relevant matches:
- Read the full decision record or bet document
- Extract key rationale and constraints
- Note re-decision triggers

### 4. Synthesize Results

Present findings in order of relevance. **Apply demo data formatting**:

```markdown
## Context Recall: [Topic]

### Relevant Decisions
| ID | Title | Status | Key Rationale |
|----|-------|--------|---------------|
| DR-2026-001 | [Title] | Accepted | [Why this was decided] |
| `[DEMO]` DR-DEMO-001 | Demo Title | Demo | Demo rationale |

**Constraints from these decisions:**
- [Constraint 1]
- [Constraint 2]

### Related Strategic Bets
| ID | Title | Status | Relevance |
|----|-------|--------|-----------|
| SB-2026-002 | [Title] | Active | [How it relates] |

### Tracked Assumptions
| ID | Assumption | Status |
|----|------------|--------|
| A-005 | [Assumption text] | Pending |

### Applicable Learnings
| ID | Learning | Confidence |
|----|----------|------------|
| L-012 | [Learning text] | High |

### Related Strategic Documents
| ID | Title | Type | Date | Location |
|----|-------|------|------|----------|
| DOC-2026-001 | [Title] | [Type] | [Date] | [File path] |

*Tip: Read the document at [location] for full details*

### Recommendations
Based on past context:
- [Recommendation 1]
- [Recommendation 2]

---
*[If demo excluded]: X demo results excluded. Use `--include-demo` to show.*
*[If demo included]: Results include demo data marked with `[DEMO]`.*

💬 Related conversations may exist. Use `/interaction-recall [topic]` to search past interactions.
```

**Demo Display Rules**:
- Demo entries: Prefix ID with `[DEMO]` marker
- If demo excluded: Show count at bottom with flag hint
- If demo included: Note that demo data is present

### 5. Flag Conflicts or Risks

If the current work might conflict with past decisions:
- Highlight the potential conflict
- Reference the re-decision triggers
- Suggest whether a re-decision process is needed

## Instructions

1. Accept topic/keyword from user (required)
2. Parse optional `product:[name]` filter from query
3. Read all context index files (decisions, bets, assumptions, learnings, portfolio, documents)
4. Search for matches (case-insensitive, partial match OK)
5. If product filter specified, filter results to that product only
6. For strong matches, read full records or referenced documents
7. Synthesize and present findings
8. Highlight constraints that apply to current work
9. Note any potential conflicts with past decisions
10. If no matches found, say so clearly

## Example Usage

```
User: /context-recall pricing

Agent: Searches context/decisions/index.md, context/bets/index.md,
       context/assumptions/registry.md, context/learnings/index.md,
       context/portfolio/active-bets.md, context/documents/index.md

       Returns relevant matches with summaries and recommendations.
```

```
User: /context-recall roadmap product:AXIA

Agent: Searches all context indexes filtered to AXIA product only.
       Returns AXIA-specific roadmap documents, decisions, and bets.
```

## Enhanced Recall (v3)

When querying the context registry:

1. **Check auto-context**: See if `rules/auto-context.md` triggers apply
2. **Search topic indexes**: Use `topicIndex`, `productIndex`, `phaseIndex` from `context/index.json`
3. **Follow cross-references**: For each direct match, include linked items one level deep (see `rules/context-graph.md`)
4. **Attribute links**: Show why related items appear: `[via: DR-2026-003]`
5. **Limit expansion**: Max 3 cross-referenced items per direct match