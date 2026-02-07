---
name: scale-check
description: Create or update a scalability assessment at 2x, 10x, 100x
argument-hint: [process, system, or initiative] or [update path/to/check.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "reassess", "refresh" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "assess" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the scale check", "our assessment" | UPDATE | 85% |
| Just process/system/initiative | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new scale check using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve investment roadmap and historical assessments
3. Update scale readiness or bottleneck analysis
4. Show diff summary

**FIND**: Check registry, then search user's folders for scale checks.

---

Assess **scalability** of a process, system, or initiative at 2x, 10x, and 100x scale, validating Principle #8 (Scalable Systems).

## V2V Phase

**Cross-phase** - This skill validates scalability when designing processes, systems, or operational approaches at any phase.

## Purpose

Scalable Systems means processes that work as the organization grows. This skill stress-tests approaches at multiple scale levels to identify breaking points before they become problems.

## Output Structure

```markdown
# Scale Check: [Subject]

**Date**: [Date]
**Subject**: [Process/System/Initiative being assessed]
**Current Scale**: [Baseline metrics - team size, volume, etc.]

## Scale Dimensions

Define what "scale" means for this subject:

| Dimension | Current | 2x | 10x | 100x |
|-----------|---------|-----|------|------|
| [Users/Customers] | [N] | [2N] | [10N] | [100N] |
| [Team size] | [N] | [2N] | [10N] | [100N] |
| [Transaction volume] | [N] | [2N] | [10N] | [100N] |
| [Product lines] | [N] | [2N] | [10N] | [100N] |
| [Markets/Regions] | [N] | [2N] | [10N] | [100N] |

## 2x Scale Assessment

**Scenario**: [Describe what 2x looks like]

### What Works at 2x
- [Element that scales well]
- [Element that scales well]

### What Strains at 2x
| Element | Current State | 2x Impact | Severity |
|---------|---------------|-----------|----------|
| [Process/System] | [How it works now] | [What happens at 2x] | Low/Med/High |
| [Process/System] | [Current] | [2x impact] | Severity |

### 2x Verdict
**Status**: [Ready/Minor Adjustments/Significant Changes Needed]

**Immediate actions required**:
- [Action 1]
- [Action 2]

## 10x Scale Assessment

**Scenario**: [Describe what 10x looks like]

### What Works at 10x
- [Element that still scales]
- [Element that still scales]

### What Breaks at 10x
| Element | Current State | 10x Impact | Severity |
|---------|---------------|------------|----------|
| [Process/System] | [How it works now] | [What breaks at 10x] | Low/Med/High |
| [Process/System] | [Current] | [10x impact] | Severity |

### 10x Redesign Required
- [Major change needed]
- [Major change needed]

### 10x Verdict
**Status**: [Ready/Partial/Requires Fundamental Redesign]

**Medium-term investments required**:
- [Investment 1]
- [Investment 2]

## 100x Scale Assessment

**Scenario**: [Describe what 100x looks like - may be hypothetical]

### What Survives at 100x
- [Core principle that endures]
- [Fundamental approach that scales]

### What's Completely Different at 100x
| Element | Current Approach | 100x Approach |
|---------|------------------|---------------|
| [Process] | [Manual/Semi-auto] | [Fully automated/AI-driven] |
| [Structure] | [Current] | [Required at 100x] |

### 100x Vision
[Describe what success looks like at 100x scale]

## Hero Dependency Analysis

"Heroes" are individuals whose personal effort makes a non-scalable process work.

| Process | Hero Dependency | Impact if Hero Unavailable | Scale Limit |
|---------|-----------------|---------------------------|-------------|
| [Process 1] | [Name/Role] | [What breaks] | [When it breaks] |
| [Process 2] | [Name/Role] | [What breaks] | [When it breaks] |

**Hero-dependent processes must be systematized before scaling.**

## Bottleneck Analysis

| Bottleneck | Current Capacity | Scale at Which It Breaks | Mitigation |
|------------|------------------|--------------------------|------------|
| [Bottleneck 1] | [Capacity] | [2x/10x/100x] | [How to address] |
| [Bottleneck 2] | [Capacity] | [Scale] | [Mitigation] |

## Complexity vs. Maturity Match

| Org Maturity Level | Appropriate Complexity | Current Complexity | Match? |
|--------------------|------------------------|-------------------|--------|
| Enabling | Low | [Current] | Yes/No |
| Established | Medium | [Current] | Yes/No |
| Company Leading | High | [Current] | Yes/No |
| Market Leading | Variable | [Current] | Yes/No |

**Assessment**: [Is current complexity appropriate for current maturity?]

## Investment Roadmap

### Immediate (Enable 2x)
| Investment | Cost | Impact | Priority |
|------------|------|--------|----------|
| [Investment 1] | [Effort/Cost] | [Scale enabled] | High/Med/Low |
| [Investment 2] | [Effort/Cost] | [Scale enabled] | Priority |

### Medium-term (Enable 10x)
| Investment | Cost | Impact | Priority |
|------------|------|--------|----------|
| [Investment 1] | [Effort/Cost] | [Scale enabled] | High/Med/Low |
| [Investment 2] | [Effort/Cost] | [Scale enabled] | Priority |

### Long-term (Enable 100x)
| Investment | Cost | Impact | Priority |
|------------|------|--------|----------|
| [Investment 1] | [Effort/Cost] | [Scale enabled] | High/Med/Low |

## Scalability Score

| Scale Level | Readiness |
|-------------|-----------|
| 2x | [Ready/Partial/Not Ready] |
| 10x | [Ready/Partial/Not Ready] |
| 100x | [Ready/Partial/Not Ready] |

**Overall Scalability Assessment**: [Highly Scalable/Moderately Scalable/Scale-Limited]

## Recommendations

### Do Now (2x enablement)
1. [Action]
2. [Action]

### Plan For (10x enablement)
1. [Action]
2. [Action]

### Keep in Mind (100x vision)
1. [Principle to preserve]
2. [Direction to head]
```

## Instructions

1. Ask what process, system, or initiative to assess
2. Define the relevant scale dimensions
3. Assess what works and what breaks at 2x
4. Assess what works and what breaks at 10x
5. Envision what 100x looks like
6. Identify hero dependencies and bottlenecks
7. Match complexity to maturity level
8. Provide investment roadmap and recommendations

## Validation Questions

- Does this work at 2x current scale?
- What breaks at 10x?
- What's fundamentally different at 100x?
- Are we dependent on heroes?
- Is complexity appropriate for our maturity?

## Red Flag Triggers

Immediately flag if:
- Process requires specific individuals to function
- No path to automation exists
- Complexity exceeds current maturity level
- Breaking point is before 2x scale

## When to Use

- When designing new processes
- When evaluating operational approaches
- Before making infrastructure decisions
- During strategic planning
- When assessing readiness for growth

## Related Skills

- `/maturity-check` - Assess current maturity level
- `/commitment-check` - Includes scalability consideration
- `/strategic-bet` - Should consider scale implications

## Operating Principle

> "Design for 10x, deliver for 2x, dream about 100x. Don't over-engineer for today, but don't paint yourself into a corner either."
