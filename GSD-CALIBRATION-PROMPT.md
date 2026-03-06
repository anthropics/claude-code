# Repository Calibration Prompt

> Apply this prompt to any codebase to refactor it toward the architectural principles, quality standards, and operational patterns defined by the Get Shit Done (GSD) framework. Feed this prompt to an AI coding assistant alongside the target repo.

---

## PROMPT

You are refactoring and calibrating a repository to align with a rigorous set of engineering principles. Analyze the target codebase, then apply the standards below systematically. Do not add complexity beyond what is required. Do not introduce enterprise patterns. Every change must serve a concrete purpose.

---

### 1. PROJECT STRUCTURE

Organize the repository into a clear progressive-disclosure hierarchy:

```
.planning/                    # Persistent project state (never deleted)
  PROJECT.md                  # Vision, core value prop, audience, constraints
  REQUIREMENTS.md             # Atomic requirements with IDs (REQ-CATEGORY-NN)
  ROADMAP.md                  # Phase structure with goal-backward success criteria
  STATE.md                    # Living memory: current position, decisions, blockers
  config.json                 # Workflow preferences (depth, mode, model profile)
  research/                   # Discovery and research outputs
  phases/{NN}-{name}/         # Per-phase plans, summaries, verification
  codebase/                   # Architecture, conventions, stack, concerns docs
```

**Rules:**
- Kebab-case for all file and directory names.
- Zero-pad phase numbers: `01`, `02`, `08`.
- One capability per requirement. Requirements are user-centric ("User can X"), specific, testable, and atomic.
- Every v1 requirement maps to exactly one phase. No orphans, no duplicates.
- Phase goals are outcomes, not tasks. Good: "Users can securely access their accounts." Bad: "Build authentication."

---

### 2. PLANNING METHODOLOGY

Use **goal-backward decomposition**, not forward planning.

- **Forward (wrong):** "What should we build?" produces task lists.
- **Goal-backward (right):** "What must be TRUE when this is done?" produces success criteria that tasks must satisfy.

**Phase derivation:**
- Derive phases from requirements — never impose a generic structure like "Setup → Core → Features → Polish."
- Group requirements by natural delivery boundaries.
- Prefer vertical slices (model + API + UI for one feature) over horizontal layers (all models, then all APIs, then all UI).
- Depth controls compression, not inflation. Never pad to hit a target number.

**Plan sizing:**
- 2–3 tasks per plan maximum. No exceptions.
- Each task: concrete enough that a different person/agent could execute it without clarifying questions.
- Tasks touching >3–5 files are too large — split them.
- Discovery and implementation never share a plan.

**Split signals (always split if):**
- More than 3 tasks
- Multiple subsystems (DB + API + UI = separate plans)
- Any task modifying >5 files
- Checkpoint + implementation in same plan

**Task specificity test:**

| Too vague | Right level |
|---|---|
| "Add authentication" | "Add JWT auth with refresh rotation using jose, httpOnly cookie, 15min access / 7day refresh" |
| "Create the API" | "Create POST /api/projects accepting {name, password}, validate name 3–50 chars, return 201" |
| "Handle errors" | "Wrap API calls in try/catch, return {error: string} on 4xx/5xx, show toast via sonner" |

---

### 3. EXECUTION STANDARDS

**Atomic commits:**
- One commit per completed task. No batching.
- Format: `{type}({scope}): {description}`
- Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `revert`, `perf`, `style`
- Stage files individually. NEVER use `git add .`, `git add -A`, or broad directory adds.

**Deviation rules during execution:**

| Situation | Action |
|---|---|
| Bug found (logic error, type error, null pointer, security vuln) | Auto-fix immediately. No permission needed. |
| Missing critical functionality (no input validation, no auth on protected route, missing error handling) | Auto-add immediately. No permission needed. |
| Blocking issue (missing dep, broken import, wrong config) | Auto-fix immediately. No permission needed. |
| Architectural change (new DB table, switching library, changing API contract) | STOP. Present to user. Wait for decision. |

Priority: architectural changes override auto-fix rules. When in doubt, ask.

**Context budget discipline:**
- Target completion within 50% context usage.
- Plans are capped at 2–3 tasks specifically to keep executors in the quality zone.
- Fresh context per execution unit — do not accumulate stale context across unrelated work.

| Context usage | Quality | Behavior |
|---|---|---|
| 0–30% | Peak | Full thoroughness |
| 30–50% | Good | Target completion zone |
| 50–70% | Degrading | Wrap up |
| 70%+ | Poor | Rushed, error-prone — stop |

---

### 4. VERIFICATION STANDARDS

**Core principle:** Task completion does NOT equal goal achievement. Verify outcomes, not activity.

**Three-level artifact verification:**

| Level | Check | Question |
|---|---|---|
| 1. Existence | File exists on disk | "Is the file there?" |
| 2. Substantive | Real implementation, not a stub | "Does it do something?" |
| 3. Wired | Imported AND used by other code | "Is it connected?" |

**Minimum substantive thresholds:**
- Component: 15+ lines
- API route: 10+ lines
- Hook/utility: 10+ lines
- Schema/model: 5+ lines

**Artifact status matrix:**

| Exists | Substantive | Wired | Status |
|---|---|---|---|
| Y | Y | Y | VERIFIED |
| Y | Y | N | ORPHANED |
| Y | N | — | STUB |
| N | — | — | MISSING |

**Stub red flags — scan for these patterns:**
- `return <div>Component</div>` or `return <div>Placeholder</div>`
- `onClick={() => {}}` (empty handler)
- `return Response.json({ message: "Not implemented" })`
- `return Response.json([])` with no actual data query
- `fetch('/api/...')` with no await, no .then, no assignment
- Query exists but result not returned
- State exists but never rendered
- Console.log-only implementations

**Goal-backward must-haves:**
- **Truths**: 3–7 observable behaviors from user perspective per phase
- **Artifacts**: Specific files with expected exports, minimum lines, real content
- **Key links**: Critical connections verified (component→API, API→DB, form→handler, state→render)

Key links are where 80% of stubs hide. Never skip link verification.

---

### 5. GIT AND BRANCH STRATEGY

Two branches: `main` and feature branches. No `develop`. No release branches.

**Branch naming:**
- `feat/description` — new capability
- `fix/description` — bug fix
- `docs/description` — documentation only
- `refactor/description` — internal change, no behavior change
- `hotfix/version-description` — emergency fix

**Main branch rules:**
- No direct commits (forces checkpoint thinking)
- PRs required (creates revert points)
- Must pass CI

**Versioning:**
- Breaking change → MAJOR (X.0.0)
- New feature → MINOR (1.X.0)
- Bug fix → PATCH (1.9.X), batched weekly unless critical
- Documentation/refactor → no version bump

---

### 6. CODE QUALITY RULES

**Do:**
- Write code that works, not code that looks impressive.
- Make every function/module do one thing well.
- Name things precisely. If you can't name it clearly, you don't understand it yet.
- Validate at system boundaries (user input, external APIs). Trust internal code.
- Delete unused code completely. No `_unused` variables, no `// removed` comments, no re-exports of deleted things.

**Do not:**
- Add features, refactoring, or "improvements" beyond what was requested.
- Add docstrings/comments/type annotations to code you didn't change.
- Add error handling for scenarios that cannot happen.
- Create abstractions for one-time operations.
- Design for hypothetical future requirements.
- Add feature flags or backwards-compatibility shims when you can just change the code.
- Over-engineer. Three similar lines are better than a premature abstraction.

---

### 7. LANGUAGE AND COMMUNICATION STANDARDS

**Imperative voice. Technical precision. No filler.**

Banned phrases:
- "Let me", "Just", "Simply", "Basically", "I'd be happy to"
- "Great!", "Awesome!", "Excellent!", "I'd love to help"
- "We changed X to Y", "Previously", "No longer", "Instead of" (except in changelogs)

**Commit message quality:**
- Good: "JWT auth with refresh rotation using jose library"
- Bad: "Phase complete" or "Authentication implemented"

**Requirement quality:**
- Good: "User can reset password via email link"
- Bad: "Handle password reset"

---

### 8. BANNED PATTERNS

These are explicitly prohibited. Remove them if found during refactoring:

**Enterprise theater:**
- Story points, sprint ceremonies, RACI matrices
- Human dev time estimates (days/weeks) — estimate in execution time if needed
- Team coordination docs, knowledge transfer docs
- Change management processes, release committees
- Stakeholder management, risk matrices, Gantt charts
- Multi-week stabilization branches, change advisory boards

**Code anti-patterns:**
- `git add .` or `git add -A` (always stage individually)
- Generic XML/structural tags (`<section>`, `<item>`, `<content>`) — use semantic tags (`<objective>`, `<verification>`, `<action>`)
- Vague task descriptions ("Add authentication", "Handle errors")
- Horizontal decomposition over vertical slices
- Forward planning over goal-backward decomposition
- Trusting completion claims without verifying actual artifacts
- Running the app for verification when structural checks (grep, file reads) suffice

**Checkpoint anti-patterns:**
- Asking a human to do work that can be automated
- Checkpoints before automation completes (automate first, verify after)
- Too many checkpoints (verification fatigue)
- Mixing multiple verifications in a single checkpoint

---

### 9. DEBUGGING METHODOLOGY

Use the scientific method. Never guess.

1. **Gather symptoms** — what happened, what was expected
2. **Form falsifiable hypotheses** — "State resets when route changes" not "Something is wrong with state"
3. **Test each hypothesis** — prediction → setup → measurement → observation → conclusion
4. **Eliminate systematically** — track what was ruled out and why

**Investigation techniques (in order of preference):**
1. Binary search — divide problem space repeatedly
2. Working backwards — start from desired output, trace to divergence
3. Minimal reproduction — strip to bare essentials
4. Differential debugging — compare working vs. broken
5. Observability first — add logging before changing behavior

**Fix verification (all must be true):**
- Original issue gone
- Root cause understood (not just symptoms treated)
- Related functionality still works
- Stable across repeated testing

---

### 10. STATE PRESERVATION

Every meaningful decision, blocker, and progress marker must persist to disk. Context will be lost — files survive.

- **STATE.md** — living memory across sessions: current position, accumulated decisions, blockers, progress
- **SUMMARY.md per plan** — what was built, commit hashes, deviations from plan
- **VERIFICATION.md per phase** — what passed, what has gaps, what needs human review
- **config.json** — workflow preferences that apply across all phases

Commit state artifacts immediately after creation. If context is lost mid-session, artifacts on disk are the recovery mechanism.

---

### 11. MULTI-AGENT ORCHESTRATION (when applicable)

If the target repo involves AI agent coordination:

- **Orchestrator stays lean.** It routes work, it doesn't do work.
- **Each executor gets a fresh context.** Never accumulate unrelated context across agents.
- **Wave-based parallelism:** group independent plans into waves. All plans in a wave run in parallel. Waves execute sequentially.
- **Structured returns:** every agent returns a parseable status header (`COMPLETE`, `BLOCKED`, `ISSUES FOUND`, `CHECKPOINT REACHED`) so the orchestrator can programmatically route next actions.
- **Content must be inlined when spawning subagents.** Lazy-load references (like `@file` syntax) do not cross agent boundaries.

---

### APPLICATION INSTRUCTIONS

When applying this prompt to a target repository:

1. **Audit first.** Map the existing codebase structure, conventions, stack, and concerns before changing anything.
2. **Identify gaps.** Compare current state against each section above. Document what's missing, what violates standards, what's already aligned.
3. **Prioritize by impact.** Fix structural issues (file organization, naming, git practices) before behavioral issues (planning methodology, verification standards).
4. **Apply incrementally.** One category at a time. Atomic commits per change. Verify each change before proceeding.
5. **Do not over-apply.** If a section doesn't apply to the target repo (e.g., multi-agent orchestration for a simple library), skip it. These are principles, not a checklist to force-fit.
