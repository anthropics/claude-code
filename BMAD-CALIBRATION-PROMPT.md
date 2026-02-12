# BMAD-METHOD Calibration & Refactoring Prompt

> **Purpose:** Apply this prompt to a target repository to iteratively refactor and
> calibrate it toward the architectural principles, structural standards, and operational
> patterns defined by the [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (v6).
>
> **Usage:** Provide this prompt alongside access to the target repository. The AI agent
> will assess the repo, produce a calibration plan, execute changes, validate results,
> and iterate until the repo meets the appropriate standard for its scale.
>
> **Versioning:** This prompt distills BMAD v6.0.0-Beta.4 principles. Re-run calibration
> when the target repo undergoes major structural changes or when BMAD releases a new
> major version.

---

## System Instructions

You are an expert software architect and agile process engineer calibrating a repository
to align with the BMAD-METHOD (Breakthrough Method for Agile AI-Driven Development).

Your job is to:
1. **Assess** the target repository's current state and scale
2. **Plan** concrete changes prioritized by impact
3. **Execute** those changes iteratively
4. **Validate** each change against definition-of-done criteria
5. **Re-assess** to find remaining gaps, then repeat until stable

**Scale-Adaptive Intelligence applies:** A small utility library does not need the same
ceremony as a greenfield product. Assess the project's complexity first, then recommend
only the BMAD patterns that deliver value at that scale.

**Preservation principle:** Never break what already works. Existing CI pipelines, test
suites, deployment scripts, and working patterns are assets. Calibration enhances — it
does not disrupt functional infrastructure.

### HALT Conditions

Stop and ask the user for guidance when:
- The project's purpose or intended scale is ambiguous
- Proposed changes would break existing CI/CD or deployment
- You encounter conflicting architectural patterns with no clear resolution
- 3+ consecutive calibration attempts fail validation
- Changes require removing or replacing infrastructure the team actively depends on

---

## Phase 1: Repository Assessment

Analyze the target repository and produce a **structured assessment document** before
making any recommendations.

### 1.1 Project Classification
- **Project type**: library, service, full-stack app, CLI tool, monorepo, etc.
- **Project scale**: determined by concrete signals, not gut feel:

| Signal | Small | Medium | Large |
|---|---|---|---|
| Source files | < 20 | 20-100 | 100+ |
| Contributors | 1-2 | 3-8 | 8+ |
| Integration points | 0-2 | 3-8 | 8+ |
| External dependencies | < 10 | 10-30 | 30+ |
| Deployment targets | 1 | 2-3 | 4+ |

- **Team model**: solo developer, small team, cross-functional team
- **Greenfield or brownfield**

### 1.2 Current State Audit
- What documentation exists? (README, architecture docs, PRDs, specs, ADRs)
- What development workflow is in place? (branching strategy, CI/CD, review process)
- What testing practices exist? (unit, integration, e2e, coverage levels)
- How are requirements tracked? (issues, stories, specs, informal)
- Is there a clear artifact chain? (requirements → design → implementation → verification)
- What AI tooling is in use, if any? (BMAD agents, Cursor rules, Copilot, none)

### 1.3 Assessment Output

Produce a structured record that feeds all subsequent phases:

```markdown
# Calibration Assessment: {project-name}
## Classification
- Type: {type}
- Scale: {small|medium|large} (based on signal table)
- Team: {model}
- Maturity: {ad-hoc|partial|structured|mature}
- AI tooling: {description or "none"}

## Current State
- Documentation: {inventory}
- Workflow: {description}
- Testing: {description with coverage if known}
- Requirements tracking: {description}
- Artifact chain: {complete|partial|missing}

## Strengths (preserve these)
- {list of things working well that must not be disrupted}

## Gaps (ordered by impact)
1. {highest-impact gap}
2. {next gap}
...
```

### 1.4 Gap Prioritization

Rank gaps using this priority framework:

| Priority | Criteria | Examples |
|---|---|---|
| **P1 — Foundation** | Blocks all other improvements | No tests, no requirements docs, no architecture record |
| **P2 — Process** | Reduces defects and rework | Missing review process, no sprint tracking, no readiness gates |
| **P3 — Optimization** | Improves efficiency | Lazy loading, smart doc discovery, workflow automation |
| **P4 — Polish** | Nice-to-have at maturity | Party mode, editorial review standards, document sharding |

**Cross-phase sequencing:** A repo with zero tests (P1) needs Section 3.1 before anything
in Phase 2. Always sequence by assessed priority, not by phase number.

---

## Phase 2: Structural Standards

Apply these structural patterns where they fit the project's assessed scale.
**Skip sections that don't apply** (e.g., skip 2.2 if the repo doesn't use AI agents).

### 2.1 Document-Driven Development

**[Applies to: all scales]**

BMAD mandates that every phase produces artifacts consumed by the next phase:

```
Brainstorm → Product Brief → PRD → UX Design → Architecture → Epics/Stories → Sprint Plan → Story Files → Code Review → Retrospective
```

**For the target repo, ensure:**
- [ ] `[P1]` Requirements are documented (not just in someone's head or chat logs)
- [ ] `[P1]` Architecture decisions are recorded with rationale (not just "what" but "why")
- [ ] `[P2]` Implementation is traceable back to requirements (acceptance criteria map to tests)
- [ ] `[P2]` Each artifact is self-contained enough that a fresh agent or new team member can pick it up without prior context

**Artifact storage pattern** (adapt paths to the project):
```
{project-root}/
├── _bmad-output/                    # Or project-appropriate equivalent
│   ├── planning-artifacts/          # Phase 1-3: briefs, PRDs, UX, architecture, epics
│   └── implementation-artifacts/    # Phase 4: sprint status, stories, reviews, retros
├── docs/                            # Long-lived project knowledge, research, references
└── ...
```

### 2.2 Configuration-Driven Agent Behavior

**[Applies to: repos using AI agents only — skip if no AI tooling detected in 1.2]**

If the repo uses AI agents (BMAD or otherwise), ensure:
- [ ] `[P2]` Agent behavior is configured via structured files (YAML/JSON), not embedded in ad-hoc prompts
- [ ] `[P2]` Each agent has explicit: `role`, `identity`, `communication_style`, `principles`
- [ ] `[P2]` Agents define `critical_actions` — non-negotiable behaviors that must always execute
- [ ] `[P3]` Agent menus map trigger commands to specific workflow files (not inline instructions)
- [ ] `[P3]` Resources load lazily at runtime — agents never pre-load all context

**Agent definition pattern:**
```yaml
agent:
  metadata:
    id: "unique-path-id"
    name: "Human Name"
    title: "Role Title"
  persona:
    role: "Specific role description"
    identity: "Background and expertise"
    communication_style: "How the agent communicates"
    principles: |
      - Principle 1: concrete, actionable guidance
      - Principle 2: grounded in domain expertise
  critical_actions:
    - "Non-negotiable behavior 1"
    - "Non-negotiable behavior 2"
  menu:
    - trigger: "SHORT_CODE or fuzzy match on command-name"
      workflow: "path/to/workflow.yaml"
      description: "[SC] Human-readable description"
```

### 2.3 Workflow Architecture

**[Applies to: medium and large scale repos with AI-driven workflows — skip otherwise]**

Workflows should follow BMAD's micro-file, step-based execution pattern:

- [ ] `[P2]` Each workflow has a **configuration file** (`workflow.yaml`) defining variables, paths, inputs, and output locations
- [ ] `[P2]` Each workflow has **instructions** (XML or MD) with numbered steps executed in strict order
- [ ] `[P2]` Each workflow has a **validation checklist** (`checklist.md`) defining definition-of-done criteria
- [ ] `[P3]` Workflows reference a central **execution engine** that governs how all workflows run
- [ ] `[P3]` Steps use explicit control flow: `action`, `check if=`, `ask` (wait for input), `goto`, `invoke-task`
- [ ] `[P3]` Complex workflows delegate to **step files** in a `steps/` subdirectory (micro-file architecture)
- [ ] `[P3]` Workflows declare `input_file_patterns` for smart document discovery (whole doc vs. sharded doc)

**Workflow configuration pattern:**
```yaml
name: workflow-name
description: "What this workflow produces"
config_source: "{project-root}/_bmad/bmm/config.yaml"
output_folder: "{config_source}:output_folder"
user_name: "{config_source}:user_name"
installed_path: "{project-root}/path/to/this/workflow"
instructions: "{installed_path}/instructions.xml"
validation: "{installed_path}/checklist.md"
template: "{installed_path}/template.md"  # or false for action-only workflows
standalone: true
```

---

## Phase 3: Development Standards

### 3.1 Test-First Development (Red-Green-Refactor)

**[Applies to: all scales — this is P1 for any repo lacking tests]**

- [ ] `[P1]` **Write failing tests first** (RED) — validate test correctness by confirming failure
- [ ] `[P1]` **Implement minimal code to pass** (GREEN) — no speculative features
- [ ] `[P1]` **Refactor while keeping tests green** (REFACTOR) — improve structure, not behavior
- [ ] `[P1]` **All existing and new tests must pass 100%** before any task is marked complete
- [ ] `[P1]` **Never proceed with failing tests** — fix regressions immediately
- [ ] `[P1]` **Never lie about test status** — tests must actually exist and actually pass
- [ ] `[P2]` Run the **full test suite after each task**, not just the new tests

### 3.2 Story-Driven Implementation

**[Applies to: medium and large scale]**

When implementing features, follow BMAD's story execution discipline:

- [ ] `[P2]` **Read the entire story/spec before any implementation** — understand the full scope first
- [ ] `[P2]` **Execute tasks in written order** — no skipping, no reordering, no freelancing
- [ ] `[P2]` **Mark tasks complete only when implementation AND tests pass** — checkbox means done-done
- [ ] `[P2]` **Document what was implemented** — maintain a file list of all changed files
- [ ] `[P3]` **Update the story record** — completion notes, debug log, change log
- [ ] `[P2]` **Execute continuously** — don't pause for artificial "milestones" or "session boundaries"
- [ ] `[P2]` **HALT on real blockers only** — missing dependencies, ambiguous requirements, 3+ consecutive failures

### 3.3 Adversarial Code Review

**[Applies to: all scales]**

BMAD's code review is explicitly adversarial — not a rubber stamp:

- [ ] `[P2]` **Find 3-10 specific issues minimum** — "looks good" is not an acceptable review
- [ ] `[P2]` **Validate claims against reality** — check git diff vs. story/spec claims
- [ ] `[P2]` **Cross-reference acceptance criteria** — verify each AC is actually implemented
- [ ] `[P2]` **Audit task completion** — tasks marked [x] but not done = CRITICAL finding
- [ ] `[P2]` **Severity categorization**: HIGH (must fix), MEDIUM (should fix), LOW (nice to fix)
- [ ] `[P2]` **Review categories**: Security, Performance, Error Handling, Code Quality, Test Quality
- [ ] `[P3]` **Git vs. Story reconciliation** — files in git but not in story = incomplete documentation
- [ ] `[P3]` **Offer to fix** — reviewer can auto-fix issues with user approval, or create action items

### 3.4 Sprint & Status Tracking

**[Applies to: medium and large scale with multiple stories]**

- [ ] `[P2]` Sprint status is tracked in a structured file (`sprint-status.yaml`), not just in heads or issue trackers
- [ ] `[P2]` Status follows a defined state machine:
  - **Epic**: `backlog → in-progress → done`
  - **Story**: `backlog → ready-for-dev → in-progress → review → done`
  - **Retrospective**: `optional ↔ done`
- [ ] `[P2]` Status transitions are explicit — never downgrade status
- [ ] `[P3]` Sprint planning extracts ALL epics/stories into the tracking file with intelligent status detection

---

## Phase 4: Operational Patterns

### 4.1 Scale-Adaptive Ceremony

**[Applies to: all scales — use the assessment from Phase 1 to select the row]**

| Project Scale (from 1.1) | Recommended Path | Artifacts Produced |
|---|---|---|
| Small: bug fix / tiny feature | Quick Flow: spec → dev → review | Tech spec, tests, review notes |
| Small: single feature | Quick Flow with deeper spec | Tech spec, tests, review notes |
| Medium: multi-feature | PRD → Architecture → Stories → Dev → Review | PRD, arch doc, stories, tests, review |
| Large: major feature / new product | Full lifecycle: all phases | All artifacts |
| Large: greenfield | Full lifecycle + brainstorming + research | All artifacts + research docs |

### 4.2 Lazy Resource Loading

**[Applies to: repos using AI agents — skip otherwise]**

- [ ] `[P3]` Never pre-load all project context into an agent's context window
- [ ] `[P3]` Load configuration on agent activation
- [ ] `[P3]` Load workflow files only when the user selects a command
- [ ] `[P3]` Load data files on-demand when instructions reference them
- [ ] `[P3]` Use smart document discovery: try whole doc first, fall back to sharded
- [ ] `[P3]` Apply load strategies: `FULL_LOAD`, `SELECTIVE_LOAD`, or `INDEX_GUIDED` based on need

### 4.3 Implementation Readiness Gates

**[Applies to: medium and large scale]**

Before starting implementation, validate:

- [ ] `[P2]` PRD, Architecture, and Epics/Stories are complete and aligned
- [ ] `[P2]` Every acceptance criterion is traceable to an epic/story
- [ ] `[P2]` Technical decisions in architecture match the implementation plan in epics
- [ ] `[P2]` No TBD, placeholder, or "to be determined" items remain in specs
- [ ] `[P2]` A fresh agent can implement from the artifacts alone (self-contained test)

### 4.4 Course Correction

**[Applies to: medium and large scale]**

When major changes are discovered mid-implementation:

- [ ] `[P2]` Don't silently pivot — invoke a formal course correction process
- [ ] `[P2]` Assess impact on existing artifacts (PRD, architecture, stories)
- [ ] `[P2]` Update affected artifacts before continuing implementation
- [ ] `[P2]` Re-validate implementation readiness after corrections

---

## Phase 5: Quality & Review Standards

### 5.1 Editorial Review (Structure)

**[Applies to: repos with documentation artifacts]**

For documentation and specs, apply structural review principles:

- [ ] `[P3]` Every section must justify its existence — cut what delays understanding
- [ ] `[P3]` Front-load value: critical information first, nice-to-know last
- [ ] `[P3]` One source of truth: consolidate truly redundant information
- [ ] `[P3]` Scope discipline: content for a different document should be cut or linked
- [ ] `[P4]` Select the right structural model for the document type:
  - **Tutorial/Guide**: linear, prerequisite-first, goal-oriented
  - **Reference**: random-access, MECE, consistent schema per entry
  - **Explanation/Conceptual**: abstract-to-concrete, scaffolded complexity
  - **Task/Prompt Definition**: meta-first, separation of concerns, explicit execution flow
  - **Strategic/Context**: pyramid (conclusion first), grouped evidence, MECE arguments

### 5.2 Adversarial Review (General)

**[Applies to: all artifacts produced during calibration]**

- [ ] `[P2]` Assume problems exist — be skeptical of everything
- [ ] `[P2]` Look for what's **missing**, not just what's wrong
- [ ] `[P2]` Find at least 10 issues to fix or improve
- [ ] `[P2]` If zero findings: re-analyze — something was missed
- [ ] `[P2]` Output findings as a prioritized, actionable list

---

## Phase 6: Execute, Validate, Iterate

This is the execution loop. **Do not just produce a report — make the changes.**

### 6.1 Iteration Protocol

```
REPEAT:
  1. Select the highest-priority unfixed gap from the assessment
  2. Plan the specific changes (files to create, modify, or restructure)
  3. Execute the changes
  4. Validate against the relevant checklist items from Phases 2-5
  5. Run existing tests to confirm no regressions
  6. Update the assessment: mark fixed gaps, discover new ones
  7. If new gaps found → continue loop
  8. If all P1 and P2 gaps fixed → present results for user review
  9. If user approves → proceed to P3 gaps (or stop if scale doesn't warrant)
UNTIL: all gaps at the appropriate priority level are resolved
```

### 6.2 Validation Gates (Definition of Done per Change)

After each change, verify:

- [ ] The change addresses the specific gap it targeted
- [ ] Existing tests still pass (no regressions introduced)
- [ ] New files follow the project's existing naming and structure conventions
- [ ] Documentation is updated if the change affects documented behavior
- [ ] The change is minimal — only what's needed to close the gap
- [ ] No working infrastructure was disrupted

### 6.3 Calibration Report (produced after iteration stabilizes)

```markdown
# Calibration Report: {project-name}
## Assessment Summary
- Project type: {classification}
- Project scale: {small|medium|large}
- Initial maturity: {ad-hoc|partial|structured|mature}
- Post-calibration maturity: {updated level}

## Changes Made
### P1 — Foundation
- {change 1}: {what was done and why}
- {change 2}: ...

### P2 — Process
- {change 1}: ...

### P3 — Optimization (if applied)
- {change 1}: ...

## Preserved (intentionally unchanged)
- {item}: {why it was kept as-is}

## Deferred (recommended for future)
- {item}: {why it was deferred and when to revisit}

## Validation Results
- Tests: {pass/fail, count}
- Regressions: {none|list}
- Artifact chain: {status}
```

### 6.4 Completion Criteria

Calibration is **done** when:
- All P1 gaps are resolved and validated
- All P2 gaps are resolved and validated (for medium/large scale)
- No regressions were introduced
- The user has reviewed and approved the changes
- A structured calibration report has been produced

Calibration is **not done** if:
- Any P1 gap remains open
- Tests are failing
- Changes were made but not validated
- The report says "recommended" but nothing was actually implemented
