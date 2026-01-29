---
name: commitment-check
description: Create or update a commitment validation before crossing the "point of no return"
argument-hint: [commitment or initiative name] or [update path/to/check.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "recheck", "refresh" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "validate" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the commitment check", "our check" | UPDATE | 85% |
| Just initiative name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new commitment check using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve prior assessments and gap tracking
3. Update readiness status and close gaps
4. Show diff summary

**FIND**: Check registry, then search user's folders for commitment checks.

---

Validate that a **Commitment is Properly Hardened** before proceeding.

## Purpose
The commitment check ensures decisions are thoroughly vetted before crossing the "point of no return" where reversal becomes costly.

## V2V Phase

**Phase 3: Strategic Commitments** - This is the "point of no return" gate. Once passed, resources are committed and reversal is expensive.

**Prerequisites**: Phase 1 and Phase 2 complete
**Outputs used by**: Phase 4 execution, resource allocation

## Output Structure

```markdown
# Commitment Check: [Initiative Name]

**Date**: [Date]
**Reviewed By**: [Name/Role]
**Status**: ✅ Ready to Commit / ⚠️ Needs Work / ❌ Not Ready

## Commitment Overview

**What**: [What we're committing to]
**Investment**: [Resources/budget being committed]
**Timeline**: [Commitment duration]
**Point of No Return**: [What happens after commitment]

## V2V Phase Prerequisites

### Phase 1: Strategic Foundation ✅/⚠️/❌

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Strategic intent documented | ✅/⚠️/❌ | [Link] |
| Market analysis complete | ✅/⚠️/❌ | [Link] |
| Competitive landscape understood | ✅/⚠️/❌ | [Link] |
| Target segments defined | ✅/⚠️/❌ | [Link] |

**Phase 1 Assessment**: Complete / Gaps Exist

### Phase 2: Strategic Decisions ✅/⚠️/❌

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Business case approved | ✅/⚠️/❌ | [Link] |
| Pricing defined | ✅/⚠️/❌ | [Link] |
| Positioning clear | ✅/⚠️/❌ | [Link] |
| Key assumptions documented | ✅/⚠️/❌ | [Link] |

**Phase 2 Assessment**: Complete / Gaps Exist

**Phase Prerequisite Status**: ✅ Ready / ⚠️ Gaps to Close / ❌ Not Ready

## Ownership Chain (Principle #1)

| V2V Phase | Accountable Owner | Status |
|-----------|-------------------|--------|
| Phase 1: Strategic Foundation | [Name] | ✅/⚠️/❌ |
| Phase 2: Strategic Decisions | [Name] | ✅/⚠️/❌ |
| Phase 3: This Commitment | [Name] | ✅/⚠️/❌ |
| Phase 4: Execution | [Name] | ✅/⚠️/❌ |
| Phase 5: Outcomes | [Name] | ✅/⚠️/❌ |

**End-to-End Owner**: [Single person accountable from strategy to outcome]
**Ownership Chain Status**: ✅ Clear / ⚠️ Gaps / ❌ Broken

---

## Readiness Assessment

### 1. Strategic Alignment ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Connects to strategic goals | ✅/⚠️/❌ | [Evidence] |
| Fits within portfolio priorities | ✅/⚠️/❌ | [Evidence] |
| Approved by appropriate authority | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

### 2. Problem Validation ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Customer problem is validated | ✅/⚠️/❌ | [Evidence] |
| Market opportunity is sized | ✅/⚠️/❌ | [Evidence] |
| Timing is right | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

### 3. Solution Clarity ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Solution approach is defined | ✅/⚠️/❌ | [Evidence] |
| Technical feasibility confirmed | ✅/⚠️/❌ | [Evidence] |
| Key risks identified | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

### 4. Business Case ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Financial projections complete | ✅/⚠️/❌ | [Evidence] |
| ROI meets threshold | ✅/⚠️/❌ | [Evidence] |
| Assumptions documented | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

### 5. Resource Readiness ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Team identified and available | ✅/⚠️/❌ | [Evidence] |
| Budget approved | ✅/⚠️/❌ | [Evidence] |
| Dependencies resolved | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

### 6. GTM Readiness ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Positioning defined | ✅/⚠️/❌ | [Evidence] |
| Launch plan drafted | ✅/⚠️/❌ | [Evidence] |
| Sales enablement planned | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

### 7. Success Criteria ✅/⚠️/❌

| Criteria | Status | Evidence |
|----------|--------|----------|
| Success metrics defined | ✅/⚠️/❌ | [Evidence] |
| Measurement plan in place | ✅/⚠️/❌ | [Evidence] |
| Re-decision triggers defined | ✅/⚠️/❌ | [Evidence] |

**Assessment**: [Summary]

## Overall Assessment

| Category | Status |
|----------|--------|
| Strategic Alignment | ✅/⚠️/❌ |
| Problem Validation | ✅/⚠️/❌ |
| Solution Clarity | ✅/⚠️/❌ |
| Business Case | ✅/⚠️/❌ |
| Resource Readiness | ✅/⚠️/❌ |
| GTM Readiness | ✅/⚠️/❌ |
| Success Criteria | ✅/⚠️/❌ |

**Overall Status**: [Ready / Needs Work / Not Ready]

## Gaps to Close

| Gap | Owner | Due Date | Blocking? |
|-----|-------|----------|-----------|
| [Gap 1] | [Owner] | [Date] | Yes/No |
| [Gap 2] | [Owner] | [Date] | Yes/No |

## Recommendation

[Clear recommendation: Proceed / Proceed with conditions / Delay / Do not proceed]

**Conditions (if applicable)**:
- [Condition 1]
- [Condition 2]
```

## Instructions

1. Ask about the initiative if context is incomplete
2. Reference any relevant documents provided via @file syntax
3. Be rigorous - this is the last gate before significant investment
4. Identify specific gaps and owners
5. Make a clear recommendation
6. Save assessment with the initiative documents
