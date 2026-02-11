---
name: interaction-recall
description: Query past conversation history by topic, agent, or date
argument-hint: [topic or keyword] [agent:name] [date:YYYY-MM] [product:name] [type:agent|gateway|skill]
user-invocable: true
---

Query **past interactions** — agent conversations, gateway sessions, and skill invocations — to understand what was discussed, who contributed, and what conclusions were reached.

## V2V Phase

**Cross-phase** — This skill surfaces conversation history relevant to any phase of work.

**Prerequisites**: Interaction log populated (interactions logged via the interaction logging system)
**Outputs used by**: Any agent or skill needing prior conversation context

## Purpose

Before starting work in an area that may have been discussed before, query the interaction log to surface:
- What was previously discussed on this topic
- Which agents contributed perspectives
- What conclusions or outcomes were reached
- What open questions remain

This complements `/context-recall` (which searches decisions, bets, and learnings) by searching **conversation history** — the request/response pairs that led to those decisions.

## When to Use

Invoke `/interaction-recall [topic]` when:
- Starting a new session and want to pick up where you left off
- Checking what agents previously said about a topic
- Auditing how a conclusion was reached
- Understanding the progression of thinking on a topic
- Finding which agents have weighed in on an area

## Query Syntax

```
/interaction-recall pricing                      → All pricing interactions
/interaction-recall pricing agent:pm             → Only PM's pricing interactions
/interaction-recall pricing date:2026-01         → January 2026 only
/interaction-recall pricing product:AXIA         → Product-filtered
/interaction-recall pricing type:gateway         → Only gateway sessions
/interaction-recall agent:pm                     → All PM interactions (any topic)
/interaction-recall date:2026-01-27              → All interactions on a specific date
```

### Filters

| Filter | Format | Example |
|--------|--------|---------|
| `agent:` | Agent key | `agent:pm`, `agent:vp-product`, `agent:plt` |
| `date:` | YYYY, YYYY-MM, or YYYY-MM-DD | `date:2026`, `date:2026-01`, `date:2026-01-27` |
| `product:` | Product name | `product:AXIA` |
| `type:` | Interaction type | `type:agent`, `type:gateway`, `type:skill` |

Multiple filters can be combined: `/interaction-recall pricing agent:pm product:AXIA`

## Process

### 1. Parse Query

Extract:
- **Topic keywords**: The main search terms
- **Filters**: agent, date, product, type (optional)

### 2. Search JSON Index

Read `context/interactions/index.json` and search:

1. **Topic search**: Match keywords against `topicIndex` keys and entry `topics` arrays
2. **Request/outcome search**: Match keywords against `requestSummary` and `outcomeSummary` fields
3. **Apply filters**: Filter results by agent, date, product, type as specified

### 3. Rank Results

Order by relevance:
1. Exact topic match in `topicIndex`
2. Keyword match in `requestSummary` or `outcomeSummary`
3. Partial topic match
4. Most recent first (within same relevance tier)

### 4. Retrieve Full Content

For the top 5 matches:
- Read the daily log file at `entries[].path`
- Find the specific entry by ID within the file
- Extract full request and response content

### 5. Present Results

```markdown
## Interaction History: [Topic]

*Found [N] interactions matching "[query]"*
*Filters: [applied filters]*

---

### IX-2026-00042 | {emoji} @pm | 2026-01-27 14:23
**Topics**: prd, authentication, requirements-gaps
**Product**: AXIA

**Request**: Review authentication PRD for requirements gaps

**Outcome**: Found 3 gaps: SSO edge cases, session timeout, MFA fallback

**Related**: DR-2026-003, DOC-2026-015

<details>
<summary>Full conversation</summary>

[Full request and response text]

</details>

---

### IX-2026-00038 | {emoji} @vp-product | 2026-01-25 10:15
...

---

### Related Context

These skills may surface additional information:
- `/context-recall [topic]` — Decisions, bets, learnings on this topic
- `/feedback-recall [topic]` — Customer feedback on this topic

*Showing top 5 of [N] matches. Narrow with filters: `agent:`, `date:`, `product:`, `type:`*
```

### 6. Handle No Results

If no interactions match:

```markdown
## Interaction History: [Topic]

No interactions found matching "[query]".

**Suggestions**:
- Try broader keywords
- Remove filters to widen search
- Check `/context-recall [topic]` for decisions and documents
- Check `/feedback-recall [topic]` for customer feedback
```

## Instructions

1. Accept topic/keyword from user (at least one keyword or filter required)
2. Parse optional filters: `agent:`, `date:`, `product:`, `type:`
3. Read `context/interactions/index.json`
4. Search entries using topic matching + filters
5. Rank results by relevance, then recency
6. For top 5 matches, read full content from daily log files
7. Present results with summaries and expandable full content
8. Suggest related context skills (`/context-recall`, `/feedback-recall`)
9. If no matches, provide helpful suggestions

## Example Usage

```
User: /interaction-recall pricing

Agent: Searches context/interactions/index.json for topic "pricing"
       Returns matching interactions with summaries and full content
       Suggests /context-recall pricing for related decisions
```

```
User: /interaction-recall agent:pm date:2026-01

Agent: Returns all PM interactions from January 2026
       Ordered by date, most recent first
```

```
User: /interaction-recall enterprise product:AXIA type:gateway

Agent: Returns gateway sessions about enterprise topics for AXIA
       Shows all agent perspectives from those sessions
```
