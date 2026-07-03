# Worked Example

A single task carried through the full orchestration loop, illustrating team-size transparency, a metric with a pinned measurement method, confidence-scored worker reports, confidence-weighted review, a hypothetical rework message, and integration. Load this when the abstract loop in SKILL.md needs a concrete anchor. Includes contrasting sketches for task shapes beyond code sweeps at the end.

## Task

"Add a `--dry-run` flag to every script in `scripts/` that performs a destructive filesystem action (delete, overwrite, move)."

## 1. Understand and decompose

The orchestrator scouts `scripts/` directly and finds six scripts that call `os.remove`, `shutil.rmtree`, or overwrite files in place. Each script is self-contained (no shared state between scripts), so the decomposition is one unit per script — six units.

## 2. Design the team

Six independent units, no dependencies between them → parallel fan-out, one `team-worker` per script. Six exceeds the five-worker transparency threshold, so before deploying, the orchestrator tells the user in one line:

> Deploying 6 team-worker agents (Opus 4.8, max effort) in parallel, one per script in `scripts/` — proceeding.

## 3. Brief and deploy

Briefing for `scripts/purge_cache.py` (the other five follow the same template with different files):

```
## Objective
Add a --dry-run flag to scripts/purge_cache.py that causes it to log every
delete it would perform without executing any of them.

## Context
- Task-wide goal: add --dry-run to all 6 destructive scripts in scripts/,
  each handled by a separate worker.
- Relevant files: scripts/purge_cache.py (the only file this worker touches)
- Decisions already made: flag name is --dry-run everywhere for consistency;
  dry-run mode logs at the same call site it would have executed, not a
  separate code path, so behavior can't drift between the two modes.
- What other workers are doing: five siblings adding the same flag to five
  other scripts. No shared files.

## Scope boundaries
- In scope: scripts/purge_cache.py only.
- Out of scope: the other five scripts, any shared argument-parsing helper
  used by more than one script — flag that instead of editing it.
- Do not: change the cache-purge logic itself, only gate it.

## Acceptance criteria
1. Running with --dry-run performs zero filesystem deletes. Measurement
   method: run against a scratch fixture directory seeded with 5 dummy
   cache files, then diff the fixture directory's contents before and
   after — must be byte-identical (0 files removed).
2. Running without --dry-run behaves exactly as before (regression check):
   same fixture, same run, all 5 dummy files removed.
3. Every delete that would have happened is logged with the path.

## Report format
Use your standard format.
```

All six briefings are sent in a single message so the workers run concurrently.

## 4. Collect and review

Five reports come back clean. The `purge_cache.py` worker's report:

> **Outcome**: Done — flag added, all three criteria verified.
> **Work performed**: scripts/purge_cache.py:34 (arg parser), :58-61 (gate before `os.remove`).
> **Evidence**: Criterion 1 — ran with `--dry-run` against the seeded fixture, diffed before/after, byte-identical (confidence: 92 — pinned method followed exactly, reproducible). Criterion 2 — ran without the flag, all 5 dummy files removed as before (confidence: 95). Criterion 3 — log line emitted per file (confidence: 68 — checked stdout manually for the 5-file case, didn't test the zero-file or single-file edge case).
> **Risks and open questions**: criterion 3's confidence is capped because only the 5-file case was exercised.

*(This notification arrives in a fresh turn. Per "Staying Pinned Across Turns," the orchestrator re-invokes the `orchestrate` skill before reviewing, to reapply the Fable 5 / max-effort pin for this turn.)*

Applying the confidence-weighted review checklist: criteria 1 and 2 score above 76, so a spot-check is optional (the orchestrator skims the diff anyway, since it's cheap). Criterion 3 scores 68 — below the threshold — so the orchestrator verifies directly: runs the script against a fixture with zero matching files. The log call sits inside the same loop as the delete, so it correctly emits nothing — criterion 3 holds, but the orchestrator now has first-hand evidence instead of a capped-confidence claim.

## 5. Rework round (hypothetical — not part of this run)

This run had no rework: the direct check in step 4 found `purge_cache.py`'s zero-file case already correct. To illustrate what rework looks like, suppose instead the check had revealed a crash (the logging call assumed a non-empty list). The orchestrator would send rework to the same worker via SendMessage, quoting the exact failure: "Criterion 3, zero-file case: `scripts/purge_cache.py` raises `IndexError` at line 60 when no files match. Fix the empty case; re-verify with a zero-file fixture before re-reporting." This is one specific, checkable ask — not "make it more robust." The real narrative resumes below, unaffected by this aside.

## 6. Integrate and verify end-to-end

Review, integration, and delivery below all happen in the same turn as step 4 — no further async wait occurs, so the pin from that turn's re-invocation still covers them; a second re-invocation is only needed if a new turn starts first.

All six scripts accept `--dry-run` with the same flag name and logging shape (checked for consistency across the six reports — a seam an individual worker couldn't see). The orchestrator runs the project's existing test suite once across the whole batch to confirm nothing else broke, rather than trusting six isolated per-script runs to add up to a working whole.

## 7. Deliver

> Added `--dry-run` to all 6 destructive scripts in `scripts/`, each verified against a seeded fixture for both dry-run (zero deletes) and normal (unchanged) behavior. Deployed as 6 parallel team-workers; no rework needed — the one below-threshold claim was spot-checked directly and confirmed correct. Full test suite passes.

## Beyond Code Sweeps

The walkthrough above is a homogeneous, hermetic code sweep — identical-shape units, objective criteria, a scratch fixture, a test suite. Other task shapes need different handling:

**Pure research (no code changes).** Criteria can't be "diff the fixture" — they're source quality, claim verification, and coverage. Brief each worker with what counts as a credible source and how many independent sources a claim needs; the worker's "measurement method" for a criterion like "answer is well-supported" is naming which sources it checked and how they corroborate. Step 5's "run the full test suite" becomes: trace each part of the request through the returned findings and confirm every part is answered and internally consistent.

**Subjective or undefined-upfront criteria** ("make the onboarding feel polished," "improve the error messages"). Use Criteria Ratification (in this file's companion, `references/patterns.md`) before deploying: turn the subjective goal into the orchestrator's best concrete operationalization, echo it to the user, and only decompose once it's confirmed or corrected — guessing here is the single most expensive place to guess wrong, since it invalidates every downstream unit.

**External APIs or side effects.** The dry-run example above is safe to re-run and produces no side effects outside a scratch fixture; real external calls aren't. "Non-overlapping" needs to extend beyond files: two workers hitting the same API can collide on a shared rate-limit budget or non-idempotent writes with no file overlap at all. Partition by resource or quota, not just by file, and treat non-idempotent calls (an email send, a payment, a remote delete) as scope requiring explicit sequencing, never parallel workers guessing they won't collide.
