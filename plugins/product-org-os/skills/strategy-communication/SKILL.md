---
name: strategy-communication
description: Create or update a strategy communication package
argument-hint: [strategy or initiative name] or [update path/to/communication.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "build" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the communication", "strategy comms" | UPDATE | 85% |
| Just strategy/initiative name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new communication package using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve strategic narrative
3. Update FAQ, key messages, or communication plan
4. Show diff summary

**FIND**: Check registry, then search user's folders for strategy communications.

---

Create a **Strategy Communication Package** for the specified strategy or initiative.

## V2V Phase
**Phase 3: Strategic Commitments** - This skill creates the communication materials after commitments are hardened.

## Output Structure

### 1. Executive Summary
- Strategy overview in 2-3 sentences
- Why now
- Expected outcomes
- Call to action for stakeholders

### 2. Strategic Narrative
A compelling story that explains:
- Where we've been
- Where we're going
- How we'll get there
- Why this path was chosen

### 3. Key Messages by Audience

| Audience | Primary Message | Supporting Points | Call to Action |
|----------|-----------------|-------------------|----------------|
| Executives | [Message] | [Points] | [Action] |
| Product team | [Message] | [Points] | [Action] |
| Engineering | [Message] | [Points] | [Action] |
| Sales | [Message] | [Points] | [Action] |
| Customers | [Message] | [Points] | [Action] |

### 4. Roadmap Highlights
- Key milestones
- What's changing
- What's staying the same
- What's being deprioritized

### 5. Success Metrics
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| [Metric 1] | [Current] | [Target] | [When] |
| [Metric 2] | [Current] | [Target] | [When] |

### 6. FAQ Document

**Q: [Common question 1]**
A: [Answer]

**Q: [Common question 2]**
A: [Answer]

**Q: [Common question 3]**
A: [Answer]

### 7. Communication Plan

| Audience | Channel | Timing | Owner | Materials |
|----------|---------|--------|-------|-----------|
| [Audience] | [Channel] | [When] | [Owner] | [Materials] |

### 8. Presentation Deck Outline
1. Title and context
2. The opportunity/challenge
3. Our strategic response
4. Key initiatives
5. Timeline and milestones
6. Success metrics
7. What we need from [audience]
8. Q&A

## Instructions

1. Ask about target audiences if not specified
2. Reference any strategy documents provided via @file syntax
3. Tailor messages to each audience's concerns
4. Include anticipated questions and answers
5. Save as markdown file
6. Create presentation version using /present
