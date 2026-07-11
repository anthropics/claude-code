# Orchestration Patterns

Detailed templates and team shapes for the `orchestrate` skill. Load this file when designing a non-trivial team or writing worker briefings.

## Worker Briefing Template

Every assignment sent to a `team-worker` follows this structure. Fill every section — a missing section is a question the worker cannot ask.

```
## Objective
One paragraph: what this assignment produces and why the team needs it.

## Context
- Task-wide goal: <one sentence, so the worker's judgment calls align with the mission>
- Relevant files/locations: <paths the worker should start from>
- Decisions already made: <constraints the worker must not relitigate>
- What other workers are doing: <only what's needed to avoid collisions>

## Scope boundaries
- In scope: <files/areas this worker owns>
- Out of scope: <files/areas reserved for other workers or the orchestrator — do not edit>
- Do not: <redesign X, upgrade dependencies, reformat unrelated code, ...>

## Acceptance criteria
1. <observable, checkable criterion>
2. <...>
Each criterion must be verifiable from the report plus the artifacts. For any load-bearing criterion, name the exact command or observation that decides pass/fail — not just for metrics. An unpinned metric (a count, a word count, a percentage) lets the worker and the orchestrator compute two different, equally defensible numbers; an unpinned non-metric criterion lets them verify it two different ways and disagree just as easily. Either way, a real pass turns into a false rework round — the single most expensive event in this loop, since rework re-runs a full worker turn at Opus 4.8 max effort.

## Report format
Use your standard format (see the `team-worker` agent definition — it is the canonical spec), unless this assignment needs a different structure — state that explicitly and describe it here.
```

Briefing quality checklist before sending:
- [ ] Could a competent engineer with no other context complete this from the briefing alone?
- [ ] Does every acceptance criterion have an obvious verification method?
- [ ] Does every load-bearing criterion pin its exact pass/fail check, not only metric criteria?
- [ ] Are the facts asserted in Context/Decisions verified directly against the code, not just recalled from earlier scouting? A false premise costs a full worker turn to discover downstream.
- [ ] Are scope boundaries explicit enough that two parallel workers cannot collide?
- [ ] Is the context section facts-only (no vague "improve quality" directives)?

## Criteria Ratification

When acceptance criteria are invented by the orchestrator rather than quoted from the user's request, or the task's success is inherently subjective ("make it feel polished," "improve the error messages"), echo the criteria to the user in one line before deploying: "Here is what I will treat as done — correct me before I spend the team." Ask via AskUserQuestion, or end the turn after echoing — the checkpoint only works if the user can actually reply before the team runs; echoing and deploying in the same turn defeats it. Skip this for tasks whose criteria are objective and drawn directly from the request — the checkpoint exists to catch a misread target while it's still free to fix, not to add a confirmation round-trip to every task.

## Team Shapes

### Parallel fan-out (default)

Independent units, one worker each, all spawned in a single message.

Use when: units share no files and no data dependencies.

```
Agent(subagent_type: team-worker, prompt: <briefing A>)   ┐
Agent(subagent_type: team-worker, prompt: <briefing B>)   ├─ one message
Agent(subagent_type: team-worker, prompt: <briefing C>)   ┘
→ collect reports → review each → integrate
```

### Sequenced stages

Unit B needs unit A's *accepted* output. Deploy A; review and accept; fold A's results into B's briefing; deploy B. Never brief B on A's unreviewed claims.

### Discovery waves

For unknown-size work ("find all the places that...", "audit for..."), run waves of finder-workers with different angles (by directory, by naming convention, by call graph, by git history). Dedupe results between waves. Stop after a wave adds nothing new — a fixed worker count misses the tail.

### Review panel

For high-stakes acceptance (a risky migration, a security-sensitive change), spawn 2–3 reviewer-workers with distinct lenses (correctness, security, does-it-reproduce) on the same artifact before the orchestrator's own review. Prompt each to actively refute the work, not to approve it. Disagreement between reviewers is signal — investigate it, don't average it.

### Worktree-isolated parallel edits

When a clean file split is impossible and workers must edit overlapping areas concurrently, spawn each with `isolation: "worktree"`. Each worker gets its own git worktree; the orchestrator merges the results and owns conflict resolution, then deletes each worker's worktree and branch — auto-cleanup only removes worktrees left unchanged. Prefer redesigning the split — merging is orchestrator time that briefing discipline would have saved.

## Large Fan-outs with the Workflow Tool

When the environment provides the Workflow tool and the team exceeds what hand-spawning manages well (roughly 8+ similar units), drive the fan-out from a script. `agentType: 'team-worker'` makes workflow workers resolve to the same pinned definition (Opus 4.8, max effort):

```javascript
export const meta = {
  name: 'orchestrated-fanout',
  description: 'Deploy team-workers over a work list, review each report',
  phases: [{ title: 'Execute' }, { title: 'Review' }],
}
const results = await pipeline(
  args.units,                                   // one briefing string per unit
  u => agent(u, { agentType: 'team-worker', phase: 'Execute' }),
  (report, u, i) => agent(
    `Adversarially review this worker report against its briefing. Briefing:\n${u}\n\nReport:\n${report}\n\nReturn PASS or a list of specific failures.`,
    { phase: 'Review' },                        // inherits the orchestrator's own model — decide deliberately, don't leave it implicit
  ).then(verdict => ({ unit: i, report, verdict })),
)
// a falsy slot is a unit whose agent() died — surface it for Failure Handling, never silently drop it
const dropped = results.flatMap((r, i) => (r ? [] : [i]))
return { reviewed: results.filter(Boolean), dropped }
```

The orchestrator still performs final review and integration on the returned results (recovering any `dropped` units per Failure Handling) — the script parallelizes execution and first-pass review; it does not replace orchestrator judgment. The review phase doubles the agent-call count (2N for N units); it's optional — for cost-sensitive fan-outs, drop it and rely on the orchestrator's own review of each returned report instead. When a unit does arrive with a PASS from this phase, the checklist's Criteria bullet may lean on that verdict; Scope and Load-bearing verification still run in full — they exist to catch exactly what an automated pass misses. One hard rule: any `agent()` call that performs execution work must pin `agentType: 'team-worker'` — an unpinned call is acceptable only for lightweight review like the one above, never for work, or it silently runs at an ungoverned model tier.

## Orchestrator Review Checklist

Apply to every worker report before accepting it:

- [ ] **Criteria**: every acceptance criterion addressed, each with concrete evidence (command + output, test result, observed behavior) — not assertions. Check that the evidence actually entails the claim: the command output matches what's asserted, cited file:line and artifacts exist as described, and numbers in the report don't contradict each other. A plausible-looking claim is not the same as a true one.
- [ ] **Scope (mechanical)**: for units that edited files, run `git diff --name-only` once per tree (once per worktree when isolated, once total for a shared tree) and partition the changed paths against each unit's briefed in-scope set — any path no unit owns is an automatic violation, no judgment required. Cross-check against each worker's own "Deviations from briefing" and "Work performed" fields — in a shared tree, the pooled diff alone can't attribute a path to a specific worker. Reserve manual reading for whether the in-scope edits are correct, not whether they're in scope.
- [ ] **Load-bearing verification**: verify directly (1) the single most load-bearing claim — the one that, if false, means the unit failed — regardless of its confidence score, since a confidently-wrong claim is exactly what a confidence-only trigger misses; and (2) any other claim that is both load-bearing and scored below 76. A sub-76 claim that gates nothing may be carried as residual risk instead of re-verified. Verifying a pinned-metric claim means re-running the exact stated command.
- [ ] **Seams**: does this unit's output still fit the units already accepted? See the Seam-Failure Checklist below.
- [ ] **Risks**: every risk or open question in the report either resolved now or carried into the final delivery — never dropped, including the worker's own single highest-value-check-not-run pointer.

Rework message format: quote the failed criterion, state what was observed vs. required, and restate the acceptance bar. Specific rework converges in one round; vague rework ("improve this") does not.

## Seam-Failure Checklist

Concrete failure modes to check during "Integrate and verify end-to-end," beyond running the test suite:
- **Interface/format mismatches** between units — one unit's output doesn't match what another assumed.
- **Convention drift** — the same concept implemented inconsistently because two workers made independent stylistic choices.
- **Duplicated or conflicting logic** introduced independently by two units solving overlapping sub-problems.
- **Aggregate-level invariants** — each unit is fine alone, but the combined set violates a global limit (total runtime, combined output size, a shared rate limit).
- **Omission** — the decomposition dropped a needed unit entirely; every deployed unit and the test suite pass, but something the user asked for was never assigned to anyone. Catch this by re-reading the original request against the integrated result, not by re-running per-unit checks.

With no test suite (research, docs, config, or other non-code artifacts), "exercise the complete flow" means tracing the request end-to-end through the produced artifacts and confirming each asked-for element exists and is internally consistent.

## Failure Handling

Any break in the happy path — missing output, a policy violation, non-convergence, or post-hoc failure — means stop and re-diagnose the plan rather than mechanically continuing. The entries below are the common instances, not an exhaustive list; handle an unlisted failure by the same principle.

- **Worker returns null / dies**: re-spawn with the same briefing plus any salvaged partial findings — at most once, whatever the cause; if it died mid-edit in a shared tree, inspect and clean the partial state before re-spawning. If the re-spawned worker dies again on the same briefing, treat it like repeated rework failure: stop, diagnose whether the unit is too large or the briefing itself triggers the crash, and re-decompose or shrink it before any further attempt.
- **Worker hangs (running but never completes)**: neither done nor dead — check its progress via the environment's task monitor; if it's looping or stalled, cancel it (e.g. TaskStop) and then handle it as a death.
- **Worker went out of scope**: revert the out-of-scope edits, accept the in-scope work if it stands alone, and tighten the boundary language in future briefings.
- **Two workers collided**: stop, resolve the tree state, then re-sequence — collisions mean the decomposition was wrong, not the workers.
- **Repeated rework failures (2+ rounds)**: stop delegating that unit; the briefing or the decomposition is the problem. Re-scout, re-plan, re-brief fresh.
- **Worker reports blocked (false premise or impossible criterion)**: this needs a decision, not a retry — sending it back as ordinary rework won't help since nothing was done wrong. Investigate the worker's stated evidence yourself, then either correct the false premise or infeasible criterion and re-brief, escalate to the user if the correction requires input only they can give, or accept the unit can't be done as scoped and adjust the decomposition.
- **User reports the delivered result doesn't work, post-delivery**: the highest-priority failure — the user is the final acceptance authority and the whole delivery just failed. It arrives in a fresh turn, so re-invoke the skill first to reapply the pin. Then diagnose in order: (1) *Intent* — the wrong thing was built (a misread request, a bad assumption). Don't patch the symptom; re-scout intent with the user, then re-decompose from the corrected intent — the old decomposition is invalid. (2) *Integration* — units were individually fine but jointly wrong, and end-to-end verification missed it. Reproduce the exact failing flow and return to that step. (3) *Unit* — one unit is defective. Rework it via the standard rework path, with the user's failing case as the new acceptance criterion. In every case, add the failing scenario as a permanent acceptance criterion so re-delivery can't regress it.
