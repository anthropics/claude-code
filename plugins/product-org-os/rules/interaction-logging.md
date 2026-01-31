---
globs:
  - "**/*"
---

# Interaction Logging Rules

Every meaningful agent, gateway, and skill interaction is logged to provide cross-session continuity, audit trails, and usage analytics.

---

## What Gets Logged

| MUST Log | MAY Log | NEVER Log |
|----------|---------|-----------|
| Agent spawns (`@pm`, `@plt`, etc.) | Multi-turn strategic discussions | Simple greetings, meta-questions |
| Gateway invocations (`@product`, `@plt`) | User decisions in natural language | System ops (`/setup`, `/clear-demo`) |
| Skills producing deliverables | Follow-up refinements | Empty context-recall results |
| | | Failed/cancelled operations |

---

## Interaction Entry Format

Each logged interaction follows this structure in the daily log file:

```markdown
---

### IX-2026-00042 | {emoji} @{agent} | 2026-01-27 14:23

**Type**: agent | gateway | skill
**Agent**: {emoji} {Display Name} (@{alias})
**Product**: {product name if applicable}
**Topics**: topic1, topic2, topic3
**Related**: DR-2026-003, DOC-2026-015

#### User Request

> {Verbatim user request, including any @file references}

#### Response

{Full response text, including ROI line}

---
```

### Entry Variations

**Gateway/multi-agent sessions**: Include ALL agent responses + synthesis section within a single entry.

**Skill invocations**: Log a **deliverable summary** (not the full document — the document is already saved as a file and registered in the document registry). Include: skill name, output path, key parameters.

**Follow-up refinements** (MAY log): If a user refines a deliverable in the same session, log as a separate entry linked to the original via the `Related` field.

---

## JSON Index Format

`context/interactions/index.json`:

```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-27",
  "nextId": 1,
  "entries": [
    {
      "id": "IX-2026-00042",
      "type": "agent",
      "agent": "pm",
      "agents": null,
      "date": "2026-01-27",
      "time": "14:23",
      "product": "AXIA",
      "topics": ["prd", "authentication", "requirements-gaps"],
      "requestSummary": "Review authentication PRD for requirements gaps",
      "outcomeSummary": "Found 3 gaps: SSO edge cases, session timeout, MFA fallback",
      "path": "context/interactions/2026/2026-01-27.md",
      "related": ["DR-2026-003", "DOC-2026-015"]
    }
  ],
  "topicIndex": {},
  "agentIndex": {},
  "dateIndex": {}
}
```

### Key Fields

- `type`: `"agent"` | `"gateway"` | `"skill"`
- `agent`: Primary agent key (e.g., `"pm"`) — null for skills
- `agents`: Array of all agent keys for gateway sessions (e.g., `["vp-product", "pm", "pmm-dir"]`) — null for single-agent
- `requestSummary`: One-line summary of the user's request (for scanning)
- `outcomeSummary`: One-line summary of the outcome (for scanning)
- `related`: Array of related context IDs (decisions, documents, bets, other interactions)

### Index Maps

- `topicIndex`: `{ "topic": ["IX-2026-00042", ...] }` — maps topics to interaction IDs
- `agentIndex`: `{ "pm": ["IX-2026-00042", ...] }` — maps agent keys to interaction IDs
- `dateIndex`: `{ "2026-01-27": ["IX-2026-00042", ...] }` — maps dates to interaction IDs

---

## Logging Sequence (MANDATORY)

After every loggable interaction, the **parent session** executes these steps:

```
1. Read context/interactions/index.json → get nextId
2. Generate entry ID: IX-YYYY-NNNNN (zero-padded, e.g., IX-2026-00001)
3. Format markdown entry (per entry format above)
4. Append to context/interactions/YYYY/YYYY-MM-DD.md (create year dir + file if new)
5. Add metadata to index.json entries array
6. Update topicIndex, agentIndex, dateIndex maps in index.json
7. Increment nextId, write index.json
8. Update context/interactions/current-session.md
```

### Responsibility

The **parent session** is responsible for all logging. Spawned agents run in isolated contexts and cannot write to logs. The logging step slots into the existing post-response sequence:

```
Agent/skill returns response
  → Parent applies meeting mode (if multi-agent)
  → Parent applies ROI display
  → Parent logs interaction                        ← THIS STEP
```

### ID Generation

- Format: `IX-[YYYY]-[NNNNN]` (5-digit zero-padded sequential)
- Year resets: IDs are globally sequential, they do NOT reset per year
- Example sequence: IX-2026-00001, IX-2026-00002, ..., IX-2026-00042

---

## Session Summary (`current-session.md`)

A rolling file updated after each logged interaction:

```markdown
# Current Session

**Started**: 2026-01-27 09:15
**Interactions**: 7
**Agents Consulted**: {emoji} PM, {emoji} VP Product, {emoji} CI
**Skills Used**: /prd, /decision-record
**Key Topics**: pricing, enterprise, authentication
**Products**: AXIA

### Interaction Summary
| # | Time | Type | Agent/Skill | Topic | Key Outcome |
|---|------|------|-------------|-------|-------------|
| 1 | 09:15 | agent | {emoji} PM | PRD review | 3 gaps found |
| 2 | 09:45 | skill | /decision-record | Pricing model | Tiered pricing selected |

### Context Carried Forward
[Open questions, unfinished discussions, next actions —
 what the next session should know]
```

The session summary is **overwritten** at the start of each new session (first interaction). The previous session's "Context Carried Forward" section should be read before overwriting.

---

## Topic Extraction

When logging, extract topics from:
1. **Explicit keywords** in the user's request
2. **Agent/skill domain** (e.g., `@pm` → "requirements", "delivery")
3. **Document references** (e.g., PRD → "prd", "requirements")
4. **Product mentions** (e.g., "AXIA" → product field)

Topics should be:
- Lowercase, hyphenated (e.g., `pricing-strategy`, `user-onboarding`)
- 2-5 topics per interaction
- Consistent with existing topic vocabulary in the index

---

## Storage Structure

```
context/
└── interactions/
    ├── index.json              # Metadata + topic/agent/date indexes
    ├── current-session.md      # Rolling session summary
    └── [YYYY]/                 # Created on demand
        └── [YYYY-MM-DD].md    # Full content per day
```

### Growth Management

- Daily files: ~50KB cap even with heavy use (20 interactions/day)
- JSON index: ~2.2MB/year at 20/day
- ID space: 5-digit (99,999) lasts ~13 years at 20/day
- Archival follows existing convention: quarterly for >90 day entries

---

## Multi-Product Support

For multi-product organizations, the `product` field in each entry enables filtering:

```
/interaction-recall pricing product:AXIA
→ Returns only AXIA pricing interactions
```

When the user's request mentions a specific product or the context is product-specific, set the `product` field. Leave null for cross-product or unscoped interactions.

---

## V2V Operating Principle

> "Conversation history is the connective tissue between sessions. Without it, every session starts from zero — with it, your AI org builds momentum."
