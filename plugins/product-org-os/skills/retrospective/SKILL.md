---
name: retrospective
description: "Conduct structured retrospective. Use when user says 'run a retro', 'retrospective', 'what went well', 'lessons learned', or needs team reflection."
argument-hint: [project, launch, or quarter] or [update path/to/retro.md]
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: learning
compatibility: Requires Product Org OS v3+ context layer and rules
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "add items", "finalize" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "conduct" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the retrospective", "our retro" | UPDATE | 85% |
| Just project/quarter | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new retrospective using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve participant input and prior discussions
3. Update actions, learnings, or follow-up items
4. Show diff summary

**FIND**: Check registry, then search user's folders for retrospectives.

---

Conduct a **Structured Retrospective** for the specified project, launch, or time period.

## V2V Phase
**Phase 6: Learning & Adaptation Loop** - This skill captures learnings for continuous improvement.

## Output Structure

### 1. Retrospective Overview
- Scope: What we're reviewing
- Timeframe: Period covered
- Participants: Who contributed
- Facilitator: Who led

### 2. Context Summary
- Original goals/objectives
- Key deliverables planned
- Resources allocated
- Timeline planned vs actual

### 3. What Went Well 🟢

| Success | Impact | Why It Worked | How to Replicate |
|---------|--------|---------------|------------------|
| [Success 1] | High/Med/Low | [Analysis] | [Action] |
| [Success 2] | High/Med/Low | [Analysis] | [Action] |
| [Success 3] | High/Med/Low | [Analysis] | [Action] |

### 4. What Didn't Go Well 🔴

| Challenge | Impact | Root Cause | Prevention |
|-----------|--------|------------|------------|
| [Challenge 1] | High/Med/Low | [Cause] | [Action] |
| [Challenge 2] | High/Med/Low | [Cause] | [Action] |
| [Challenge 3] | High/Med/Low | [Cause] | [Action] |

### 5. What We Learned 💡

| Learning | Evidence | Application |
|----------|----------|-------------|
| [Learning 1] | [What showed us this] | [How to apply] |
| [Learning 2] | [What showed us this] | [How to apply] |
| [Learning 3] | [What showed us this] | [How to apply] |

### 6. Action Items

| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| [Action 1] | [Owner] | [Date] | P1/P2/P3 |
| [Action 2] | [Owner] | [Date] | P1/P2/P3 |
| [Action 3] | [Owner] | [Date] | P1/P2/P3 |

### 7. Process Improvements

| Process | Current State | Desired State | How to Improve |
|---------|---------------|---------------|----------------|
| [Process 1] | [Current] | [Desired] | [Improvement] |
| [Process 2] | [Current] | [Desired] | [Improvement] |

### 8. Decisions to Revisit

| Decision | Original Rationale | New Evidence | Recommendation |
|----------|-------------------|--------------|----------------|
| [Decision 1] | [Why we decided] | [What we learned] | Keep/Modify/Reverse |
| [Decision 2] | [Why we decided] | [What we learned] | Keep/Modify/Reverse |

### 9. Recognition
- People who went above and beyond
- Teams that collaborated exceptionally
- Contributions worth highlighting

### 10. Follow-up Plan

| Item | Owner | Check-in Date | Success Criteria |
|------|-------|---------------|------------------|
| [Item 1] | [Owner] | [Date] | [Criteria] |
| [Item 2] | [Owner] | [Date] | [Criteria] |

## Retrospective Facilitation Notes

**For facilitators:**
1. Create psychological safety first
2. Focus on systems, not blame
3. Balance critique with recognition
4. Drive to specific actions
5. Assign owners and dates to everything

## Instructions

1. Ask about scope if not specified
2. **Check prior context**: Run `/relevant-learnings [topic]` to see if we've learned similar lessons before
3. Reference any project documents provided via @file syntax
4. Distinguish root causes from symptoms
5. Ensure every learning has an action
6. Save as markdown file
7. Offer to create presentation version using /present

## Context Integration

After completing the retrospective:

1. **Offer to save learnings**: Ask "Should I save these learnings to the context registry? (`/context-save`)"
2. If yes, extract and save:
   - Each learning to `context/learnings/index.md` with:
     - Learning ID (L-NNN)
     - Clear one-sentence insight
     - Source (this retrospective)
     - Category (Strategy/Product/GTM/Customer/Process)
     - Confidence level
     - Application guidance
3. **Update assumptions**: If any assumptions were validated/invalidated, update `context/assumptions/registry.md`
4. **Flag re-decisions**: If findings trigger re-decision criteria for past decisions, highlight this
