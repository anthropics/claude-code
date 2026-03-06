# Fan-Out → Synthesize → Apply

You are executing the **Parallel Adversarial Subagent Pattern**. The target is: **$ARGUMENTS**

If the argument is a file path, read it. If it's a description, find the relevant artifact first. If no argument is given, ask the user what to review.

---

## The Pattern

```
┌─────────────────────────┐
│   Artifact Under Review │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │ Fan-Out │  (parallel, independent, narrow mandates)
    └────┬────┘
         │
   ┌─────┼─────┬─────┬─────┬─────┐
   ▼     ▼     ▼     ▼     ▼     ▼
  R1    R2    R3    R4    R5    R6
  │     │     │     │     │     │
  └─────┼─────┴─────┴─────┴─────┘
        │
   ┌────┴────┐
   │ Fan-In  │  (synthesize, deduplicate, prioritize)
   └────┬────┘
        │
   ┌────┴────┐
   │  Apply  │  (implement, commit)
   └─────────┘
```

## Why This Works

- Each evaluator has a **narrow mandate** — prevents blind spots from a single reviewer trying to evaluate everything
- Parallel execution means **no serial bottleneck** — all lenses run simultaneously
- Independent rubrics mean evaluators **cannot groupthink** — they don't see each other's findings
- Mandatory scoring with mandatory findings means **no hand-waving** — every score requires evidence
- Fan-in deduplication catches **overlapping concerns** across lenses and merges them

## Step 1: Fan-Out

Launch these subagents **in parallel** (all in a single message with multiple Task tool calls). Each subagent:
- Receives the full artifact
- Gets ONE rubric dimension (its narrow mandate)
- Must return: Score (1-5), Specific Findings (with line references), Concrete Recommendations

**Determine your rubric dimensions based on the artifact type.** Here are templates:

### For Documentation / Reference Material
| Subagent | Rubric | Mandate |
|----------|--------|---------|
| R1 | Convex Easy Wins | High-impact, low-effort fixes: missing defaults, wrong values, formatting gaps |
| R2 | Extending Capabilities | Advanced usage, composition patterns, edge cases, power-user features |
| R3 | Reducing Steps to Results | Quick references, decision tables, workflow patterns, inline error docs |
| R4 | Improvement-Integration Points | Limitations as opportunities, automation potential, drift detection |
| R5 | Accuracy & Source Fidelity | Cross-reference against source code/schemas, find documentation lies |
| R6 | Structural & Navigation | ToC, glossary, heading consistency, cross-references, metadata uniformity |

### For Code / Implementation
| Subagent | Rubric | Mandate |
|----------|--------|---------|
| R1 | Convex Easy Wins | Dead code, unused imports, trivial type fixes, obvious simplifications |
| R2 | Extending Capabilities | Missing error handling, uncovered edge cases, unexposed configuration |
| R3 | Reducing Steps to Results | Unnecessary abstractions, over-engineering, simpler alternatives |
| R4 | Improvement-Integration Points | Testability gaps, observability hooks, plugin points, API surface |
| R5 | Correctness & Safety | Logic errors, race conditions, injection vectors, resource leaks |
| R6 | Structural Quality | Naming consistency, module boundaries, dependency direction, cohesion |

### For Tests / Test Suites
| Subagent | Rubric | Mandate |
|----------|--------|---------|
| R1 | Convex Easy Wins | Missing assertions, unchecked return values, trivial coverage gaps |
| R2 | Extending Coverage | Untested branches, missing edge cases, integration gaps |
| R3 | Reducing Noise | Flaky tests, slow tests, redundant tests, unclear failure messages |
| R4 | Improvement-Integration Points | Missing test categories, automation opportunities, CI optimization |
| R5 | Correctness & Confidence | Tests that pass for wrong reasons, mocked-away real behavior |
| R6 | Structural Quality | Test organization, naming, setup/teardown patterns, helper reuse |

### For Architecture / Design Documents
| Subagent | Rubric | Mandate |
|----------|--------|---------|
| R1 | Convex Easy Wins | Missing diagrams, undefined terms, broken cross-references |
| R2 | Extending Capabilities | Unaddressed scaling scenarios, missing failure modes, evolution paths |
| R3 | Reducing Steps to Results | Decision rationale, trade-off matrices, rejected alternatives |
| R4 | Improvement-Integration Points | Migration paths, deprecation strategies, extension mechanisms |
| R5 | Feasibility & Accuracy | Assumptions vs reality, dependency availability, performance claims |
| R6 | Structural Quality | Consistency, completeness, ADR format compliance, audience clarity |

### Custom Rubrics
If the artifact doesn't fit the above, design 6 rubric dimensions that:
1. Cover **correctness** (is it right?)
2. Cover **completeness** (is anything missing?)
3. Cover **efficiency** (can it be simpler?)
4. Cover **extensibility** (can it grow?)
5. Cover **usability** (can someone use it?)
6. Cover **maintainability** (will it age well?)

## Step 2: Fan-In (Synthesize)

After all subagents return:

1. **Aggregate** into a summary table:
   ```
   | Dimension | Score | Top Finding | Top Recommendation |
   ```

2. **Deduplicate** — multiple rubrics often surface the same underlying issue from different angles. Merge them.

3. **Prioritize** using this order:
   - **Convex easy wins first** — maximum impact per effort
   - **Accuracy fixes** — wrong information is worse than missing information
   - **Step reduction** — efficiency improvements compound
   - **Capability extensions** — breadth improvements
   - **Structural quality** — polish
   - **Integration points** — forward-looking improvements last

4. **Classify** each finding:
   - **Critical** (score 1-2 in any dimension): fix immediately
   - **Major** (score 3 in accuracy/correctness): fix in this pass
   - **Minor** (score 3-4 in other dimensions): fix if time permits
   - **Enhancement** (score 4+ suggestions): note for future

## Step 3: Apply

1. Implement all Critical and Major fixes
2. Implement Minor fixes
3. Implement Enhancements that are genuinely low-effort
4. Commit with a detailed message listing:
   - Pre-evaluation aggregate score
   - Post-application expected score
   - What changed and why, organized by dimension

## Iteration

- If any dimension remains **below 3/5** after application, run a **focused follow-up** on that specific dimension only
- Diminishing returns set in after **2-3 rounds** — stop when all dimensions are 4+/5 or when each additional round yields fewer than 3 actionable findings
- First drafts typically score **2-3/5** — this is expected, not a failure
