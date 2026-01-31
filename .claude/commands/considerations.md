# Considerations & Guard-Rails

You are applying the **7 Key Considerations** as a pre-flight checklist and ongoing guard-rails for the current task. The context is: **$ARGUMENTS**

If no context is given, apply these considerations to whatever task is currently in progress.

---

## The 7 Considerations

These are hard-won principles from adversarial evaluation methodology. Apply them as both a **pre-flight checklist** (before starting) and **in-flight guard-rails** (during execution).

### 1. Adversarial evaluation is most valuable on first drafts

> The initial version of anything scores ~2-3/5. That's expected, not a failure. One focused round of adversarial review typically yields the largest improvement. Diminishing returns set in after 2-3 rounds.

**Guard-rail:** Don't polish prematurely. Get the first draft out, then evaluate. Don't run 5 adversarial passes when 2 will capture 90% of the value.

**Pre-flight check:**
- [ ] Is this a first draft? → Run full adversarial evaluation
- [ ] Is this a second pass? → Run focused evaluation on weak dimensions only
- [ ] Is this a third+ pass? → Only proceed if a specific dimension is still below 3/5

---

### 2. Parallel evaluation beats sequential

> Six focused evaluators with narrow mandates find more than one generalist trying to evaluate everything at once. They also run concurrently, so wall-clock time is the same as a single evaluation.

**Guard-rail:** Always fan-out to multiple subagents. Never ask one subagent to evaluate "everything." A narrow mandate prevents evaluator fatigue and blind spots.

**Pre-flight check:**
- [ ] Have I defined distinct, non-overlapping rubric dimensions?
- [ ] Am I launching all evaluators in parallel (single message, multiple Task calls)?
- [ ] Does each evaluator have a clear scope boundary?

---

### 3. The fan-out → synthesize → apply pattern is the core reusable unit

> This three-stage pattern works for any quality gate: doc review, code review, test gap analysis, architecture review, incident postmortem, onboarding material audit.

**Guard-rail:** If you're doing any kind of review or audit, reach for this pattern first. The stages are:
1. **Fan-out** — parallel independent evaluation with narrow mandates
2. **Synthesize** — aggregate, deduplicate, prioritize
3. **Apply** — implement changes in priority order

**Applicable to:**
- Documentation and reference material
- Source code and implementations
- Test suites and coverage
- Architecture and design documents
- Configuration and infrastructure
- API designs and schemas
- Onboarding and runbooks
- Incident postmortems and retrospectives

---

### 4. Scoring forces accountability

> Without numeric scores, evaluations drift toward "looks good" or vague suggestions. A 1-5 scale with mandatory specific findings per score makes hand-waving impossible.

**Guard-rail:** Every evaluation dimension MUST produce:
- A numeric score (1-5)
- At least one specific finding (with file/line reference where possible)
- At least one concrete recommendation (exact change, not "consider improving X")

**Scoring calibration:**
| Score | Meaning | Action Required |
|-------|---------|-----------------|
| 1 | Fundamentally broken | Stop and fix before proceeding |
| 2 | Significant gaps | Major rework needed |
| 3 | Functional but incomplete | Targeted improvements |
| 4 | Good with minor gaps | Polish pass |
| 5 | Comprehensive | No action needed |

---

### 5. Source-of-truth extraction catches documentation lies

> Inspecting the actual runtime artifact (code, schema, config) catches things that reviewing documentation in isolation never will. The stated behavior and the actual behavior diverge more often than expected.

**Guard-rail:** Always cross-reference documentation claims against the source of truth. Methods:
- Read the actual source code / compiled bundle / installed package
- Run the tool and observe actual behavior
- Check schema definitions (Zod, JSON Schema, OpenAPI) for real constraints
- Compare documented defaults against actual defaults in code

**Common documentation lies:**
- Default values that changed but the doc wasn't updated
- Enum values that were added but not documented
- Constraints that were loosened/tightened
- Parameters that were added/removed/renamed
- Features gated behind flags that the doc doesn't mention

---

### 6. Prioritize convex easy wins

> A "convex" improvement is one where the value delivered is disproportionately high relative to the effort required. Fix these first. They compound — each easy fix improves the overall quality, making the next improvement clearer.

**Guard-rail:** After synthesis, sort by effort-to-impact ratio:

```
Priority = Impact / Effort

High impact + Low effort  = DO FIRST  (convex wins)
High impact + High effort = DO SECOND (strategic)
Low impact  + Low effort  = DO THIRD  (cleanup)
Low impact  + High effort = SKIP      (waste)
```

**Common convex wins:**
- Adding a missing default value to a parameter table (1 line, prevents user confusion)
- Fixing an incorrect constraint (1 word, prevents runtime errors)
- Adding a cross-reference "See also: X" (1 line, connects isolated knowledge)
- Adding a glossary entry (2 lines, eliminates repeated confusion)
- Fixing inconsistent formatting (find-and-replace, improves scannability)

---

### 7. Know when to stop

> Adversarial evaluation has diminishing returns. The first round captures ~60% of issues. The second captures ~25% more. The third captures ~10%. Beyond that, you're polishing polish.

**Guard-rail:** Stop when ANY of these are true:
- All dimensions score 4+/5
- A round yields fewer than 3 actionable findings
- You've completed 3 rounds
- The remaining findings are all "Enhancement" severity (nice-to-have, not need-to-have)

**Do NOT stop when:**
- Any dimension is below 3/5
- Accuracy/correctness findings remain unaddressed (wrong > missing)
- Critical or Major findings exist from any dimension

---

## Using These as a Pre-Flight Checklist

Before starting any review, evaluation, or documentation task, verify:

```
[ ] 1. What draft stage is this? (first → full eval, second → focused, third+ → only if <3/5)
[ ] 2. Am I using parallel subagents with narrow mandates? (not one generalist)
[ ] 3. Am I using fan-out → synthesize → apply? (not ad-hoc review)
[ ] 4. Does every evaluation require scores + findings + recommendations? (not vibes)
[ ] 5. Am I cross-referencing against the source of truth? (not reviewing docs in isolation)
[ ] 6. Am I prioritizing convex easy wins first? (not big-effort items)
[ ] 7. Do I know my stopping criteria? (not infinite polish)
```

## Using These as In-Flight Guard-Rails

During execution, check periodically:

- **Am I going deep on one dimension at the expense of others?** → Rebalance
- **Am I making changes without scoring first?** → Score, then change
- **Am I trusting the documentation without verifying the source?** → Cross-reference
- **Am I spending significant effort on a low-impact finding?** → Skip, note for future
- **Am I on round 4+ with marginal returns?** → Stop
