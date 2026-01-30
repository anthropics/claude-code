---
name: roi-report
description: View ROI dashboard showing time saved across sessions
model: haiku
tools:
  - Read
  - Glob
---

# ROI Report

Generate a report showing time savings from using the Product Org OS.

**SCOPE**: All time savings represent PRODUCT MANAGEMENT WORK (strategy, decisions, requirements, GTM, analysis, documentation), NOT software development or coding effort.

## Trigger Patterns

- `/roi-report` - Show full dashboard
- `/roi-report session` - Show current session only
- `/roi-report [period]` - Show specific period (30d, 90d, month, quarter)

## Behavior

### 1. Load Data Sources

Read relevant files to compile ROI data:

```
Session log: context/roi/session-log.md
History: context/roi/history/*.md
Baselines: reference/roi-baselines.md
```

### 2. Calculate Metrics

**Per-Session Metrics:**
- Total interactions this session
- Time saved this session
- Top skills used

**Period Metrics (30/90 day):**
- Total interactions
- Total time saved
- Skills by frequency
- Skills by time saved
- Average time saved per interaction

**ROI Multiple:**
```
ROI Multiple = Time Saved / Time Using Plugin
```

Assume average interaction takes 2-3 minutes of user time.

### 3. Output Format

```markdown
# Product Org OS - ROI Dashboard

**Report Generated**: [date]
**Period**: [session | 30 days | 90 days | all time]

---

## Summary

| Metric | Value |
|--------|-------|
| Total Interactions | [N] |
| Total Time Saved | ~[X] hours |
| ROI Multiple | [Y]x |

---

## This Session

| Skill/Agent | Count | Time Saved |
|-------------|-------|------------|
| /prd | 2 | ~8 hours |
| @pm | 3 | ~4 hours |
| /decision-record | 1 | ~1.5 hours |

**Session Total**: ~13.5 hours saved

---

## Top Skills by Time Saved (Period)

| Rank | Skill | Uses | Total Time Saved |
|------|-------|------|------------------|
| 1 | /prd | 12 | ~48 hours |
| 2 | /strategic-bet | 8 | ~24 hours |
| 3 | @plt | 5 | ~20 hours |
| 4 | /gtm-strategy | 6 | ~18 hours |
| 5 | /business-case | 4 | ~12 hours |

---

## Top Skills by Frequency (Period)

| Rank | Skill | Uses | Avg Time/Use |
|------|-------|------|--------------|
| 1 | /user-story | 45 | ~25 min |
| 2 | /decision-record | 28 | ~60 min |
| 3 | /context-recall | 24 | ~10 min |
| 4 | @pm | 18 | ~90 min |
| 5 | /feature-spec | 15 | ~75 min |

---

## Monthly Trend

| Month | Interactions | Time Saved | ROI Multiple |
|-------|-------------|------------|--------------|
| Jan 2026 | 156 | ~78 hours | 15x |
| Dec 2025 | 142 | ~71 hours | 14x |
| Nov 2025 | 98 | ~49 hours | 12x |

---

## Category Breakdown

| Category | % of Usage | Time Saved |
|----------|-----------|------------|
| Requirements | 35% | ~40 hours |
| Strategy | 25% | ~35 hours |
| Context/Memory | 20% | ~15 hours |
| GTM/Marketing | 12% | ~18 hours |
| Decisions | 8% | ~12 hours |

---

*Time estimates based on manual product management work. See reference/roi-baselines.md for methodology.*
```

### 4. Empty State

If no data exists yet:

```markdown
# Product Org OS - ROI Dashboard

**No usage data recorded yet.**

Start using skills and agents to begin tracking your ROI:

- `/prd [topic]` - Create a PRD (~4 hours saved vs. manual writing + stakeholder reviews)
- `/decision-record [topic]` - Document a decision (~1 hour saved vs. manual documentation + alignment)
- `@pm [question]` - Get PM perspective (~1-2 hours saved vs. manual analysis + research)

Each completed skill/agent interaction is automatically logged with its time-savings estimate.

Note: All time savings represent PRODUCT WORK (research, analysis, documentation, stakeholder alignment), not development effort.
```

## Session Log Format

The session log (`context/roi/session-log.md`) should follow this format:

```markdown
# Session ROI Log

## Current Session: [YYYY-MM-DD]

| Time | Skill/Agent | Topic | Complexity | Time Saved |
|------|-------------|-------|------------|------------|
| 09:15 | /prd | Authentication | Standard | 240 min |
| 10:30 | @pm | PRD review | Simple | 60 min |
| 11:45 | /decision-record | API versioning | Standard | 75 min |

**Session Total**: 375 min (~6.25 hours)
```

## History File Format

Monthly history files (`context/roi/history/YYYY-MM.md`):

```markdown
# ROI History: [Month Year]

## Summary
- Total Interactions: [N]
- Total Time Saved: [X] hours
- Top Skill: [skill] ([count] uses)

## Daily Breakdown

### [Date]
| Skill/Agent | Count | Time Saved |
|-------------|-------|------------|
| ... | ... | ... |

**Day Total**: [X] hours
```

## Complexity Factor Reference

When logging interactions, complexity affects time saved:

| Complexity | Factor | Signals |
|------------|--------|---------|
| Simple | 0.5× | Quick question, single topic, no research needed |
| Standard | 1.0× | Typical usage, moderate scope |
| Complex | 1.5× | Multi-part, requires research, significant scope |
| Enterprise | 2.0× | Large scale, multiple stakeholders, strategic |

## Notes

- ROI tracking is opt-in via the `roi_display` setting
- Setting `roi_display: none` disables per-interaction display
- Setting `roi_display: minimal` shows only the time saved line
- History is preserved even if display is disabled
- All time estimates are approximations based on manual product management work (NOT development/coding)
