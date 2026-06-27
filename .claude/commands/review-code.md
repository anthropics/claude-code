# Review Code

Adversarially evaluate the code at **$ARGUMENTS** using the fan-out → synthesize → apply pattern.

Read the target file(s) first. Then launch **6 parallel subagents**, each with one rubric:

1. **Convex Easy Wins** — Dead code, unused imports, trivial type fixes, obvious simplifications, inconsistent naming, missing early returns, redundant conditions. What takes 1 line to fix but improves real quality?

2. **Extending Capabilities** — Missing error handling for realistic failure modes, uncovered edge cases, unexposed configuration that should be configurable, missing validation at system boundaries, incomplete API surface.

3. **Reducing Steps to Accurate Results** — Unnecessary abstractions, over-engineering, indirection that obscures intent, simpler alternatives to current patterns, premature generalization, dead flexibility (extension points nothing uses).

4. **Improvement-Integration Points** — Testability gaps (untestable code paths, hard-wired dependencies), observability hooks (logging, metrics, tracing), plugin/extension points, API surface improvements, migration paths.

5. **Correctness & Safety** — Logic errors, race conditions, injection vectors (SQL, XSS, command), resource leaks (connections, file handles, memory), error swallowing, incorrect assumptions, off-by-one, null/undefined access.

6. **Structural Quality** — Naming consistency, module boundary clarity, dependency direction (no circular deps, layered correctly), cohesion (do modules have single responsibilities?), coupling (are modules appropriately decoupled?).

Each subagent must return: **Score (1-5)**, **Specific Findings (with file:line references)**, **Concrete Recommendations (with code patches where applicable)**.

After all return: aggregate scores, deduplicate, prioritize (correctness → convex wins → steps → capabilities → structure → integration), apply improvements, commit.

Note: For code reviews, **correctness** takes priority over convex wins — a bug fix is always more important than a cleanup.

Stop when all dimensions are 4+/5 or a round yields fewer than 3 findings.
