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
Each criterion must be verifiable from the report plus the artifacts. For any criterion that is a metric (a count, a word count, a percentage), pin the exact measurement method (e.g., "word count via `wc -w` on the body, frontmatter excluded") — an unpinned metric lets the worker and the orchestrator compute two different, equally defensible numbers and turns a real pass into a false rework round.

## Report format
Use your standard format (see `.claude/agents/team-worker.md` — that file is the canonical spec), unless this assignment needs a different structure — state that explicitly and describe it here.
```

Briefing quality checklist before sending:
- [ ] Could a competent engineer with no other context complete this from the briefing alone?
- [ ] Does every acceptance criterion have an obvious verification method?
- [ ] Does every metric criterion pin its exact measurement method?
- [ ] Are scope boundaries explicit enough that two parallel workers cannot collide?
- [ ] Is the context section facts-only (no vague "improve quality" directives)?

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

When a clean file split is impossible and workers must edit overlapping areas concurrently, spawn each with `isolation: "worktree"`. Each worker gets its own git worktree; the orchestrator merges the results and owns conflict resolution. Prefer redesigning the split — merging is orchestrator time that briefing discipline would have saved.

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
    { phase: 'Review' },
  ).then(verdict => ({ unit: i, report, verdict })),
)
return results.filter(Boolean)
```

The orchestrator still performs final review and integration on the returned results — the script parallelizes execution and first-pass review; it does not replace orchestrator judgment.

## Orchestrator Review Checklist

Apply to every worker report before accepting it:

- [ ] **Criteria**: every acceptance criterion addressed, each with concrete evidence (command + output, test result, observed behavior) — not assertions.
- [ ] **Scope**: the diff/artifacts stay inside the assigned boundaries; no drive-by edits.
- [ ] **Confidence-weighted spot-check**: verify directly anything the worker scored below 76; above that, spot-check is optional but still worth doing on the single most load-bearing claim.
- [ ] **Seams**: does this unit's output still fit the units already accepted (interfaces, naming, assumptions)?
- [ ] **Risks**: every risk or open question in the report either resolved now or carried into the final delivery — never dropped.

Rework message format: quote the failed criterion, state what was observed vs. required, and restate the acceptance bar. Specific rework converges in one round; vague rework ("improve this") does not.

## Failure Handling

- **Worker returns null / dies**: if it died mid-edit in a shared tree, inspect and clean the partial state first; then re-spawn with the same briefing plus any salvaged partial findings.
- **Worker went out of scope**: revert the out-of-scope edits, accept the in-scope work if it stands alone, and tighten the boundary language in future briefings.
- **Two workers collided**: stop, resolve the tree state, then re-sequence — collisions mean the decomposition was wrong, not the workers.
- **Repeated rework failures (2+ rounds)**: stop delegating that unit; the briefing or the decomposition is the problem. Re-scout, re-plan, re-brief fresh.
