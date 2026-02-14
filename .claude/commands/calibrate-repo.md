---
name: calibrate-repo
description: Audit and transform any repository against GSD engineering principles
argument-hint: "<repo-path-or-url>"
---

<objective>
Audit a target repository against GSD (Get Shit Done) engineering principles, produce a structured gap analysis, then apply transformations incrementally with atomic commits. The goal is to calibrate the repo toward rigorous standards for structure, planning, execution, verification, and code quality — without over-engineering or force-fitting patterns that don't apply.

Input: a local path or GitHub URL pointing to the target repository.
Argument: $ARGUMENTS
</objective>

<process>

## Phase 0: Resolve Target

<step name="resolve_target">
Determine the target repo from `$ARGUMENTS`.

- If a GitHub URL: clone it into a working directory and `cd` into it.
- If a local path: verify it exists and is a git repository.
- If neither: ask the user for a valid path or URL.

Record the resolved absolute path as `TARGET_ROOT`.
</step>

## Phase 1: Deep Audit

Run all six audit dimensions in parallel. Do NOT make any changes yet. Read only.

<step name="audit_structure">
### 1A — Structure Audit

Map the full directory tree. Evaluate against these criteria:

- [ ] Has a `.planning/` directory (or equivalent persistent state directory)
- [ ] PROJECT.md or equivalent vision document exists
- [ ] Requirements are defined with atomic IDs (REQ-CATEGORY-NN pattern)
- [ ] Roadmap exists with phase structure
- [ ] State tracking file exists (cross-session memory)
- [ ] Config file for workflow preferences exists
- [ ] File naming follows kebab-case
- [ ] Directory naming follows kebab-case
- [ ] Phase directories use zero-padded numbers
- [ ] Clear separation: source code vs. planning artifacts vs. config vs. docs

Record findings as `STRUCTURE_GAPS[]`.
</step>

<step name="audit_code_quality">
### 1B — Code Quality Audit

Scan source files for anti-patterns:

- [ ] Dead code: unused exports, unreferenced files, `_unused` prefixed variables
- [ ] Stub implementations: placeholder returns, empty handlers, console-log-only functions
- [ ] Over-engineering: abstractions used only once, feature flags for non-existent features, backwards-compat shims for nothing
- [ ] Premature generalization: utility functions called from one place, config for things that never change
- [ ] Missing boundary validation: user input, external API responses
- [ ] Excessive internal validation: null checks on values that can't be null, type checks on typed values

Use grep/glob to find:
```
return <div>Placeholder</div>
return <div>Component</div>
onClick={() => {}}
"Not implemented"
TODO|FIXME|HACK|XXX
console.log( (as sole implementation)
```

Record findings as `CODE_QUALITY_GAPS[]`.
</step>

<step name="audit_git_practices">
### 1C — Git Practices Audit

Examine recent commit history (last 50 commits):

- [ ] Commits follow conventional format: `{type}({scope}): {description}`
- [ ] Commits are atomic (one logical change per commit)
- [ ] No `git add .` artifacts (commits with unrelated files bundled)
- [ ] Branch naming follows `feat/`, `fix/`, `docs/`, `refactor/`, `hotfix/` conventions
- [ ] No direct commits to main (PRs used)
- [ ] Commit messages are specific (not "fix bug", "update code", "misc changes")

Examine `.gitignore`:
- [ ] Secrets excluded (.env, credentials, keys)
- [ ] Build artifacts excluded
- [ ] OS files excluded (.DS_Store, Thumbs.db)
- [ ] IDE config excluded (unless deliberately shared)

Record findings as `GIT_GAPS[]`.
</step>

<step name="audit_verification">
### 1D — Verification Audit

Check if the repo has verification infrastructure:

- [ ] Tests exist (unit, integration, e2e — any)
- [ ] Tests actually run (check CI config, package.json scripts, Makefile)
- [ ] Test coverage is meaningful (not just smoke tests)
- [ ] CI pipeline exists (.github/workflows, .gitlab-ci.yml, Jenkinsfile, etc.)
- [ ] Linting configured and enforced
- [ ] Type checking configured (if applicable to language)

Scan for stub patterns using three-level verification on key source files:
1. **Existence**: are expected files present?
2. **Substantive**: do they contain real implementations (15+ lines for components, 10+ for routes/utils, 5+ for schemas)?
3. **Wired**: are they imported and used by other code?

Record findings as `VERIFICATION_GAPS[]`.
</step>

<step name="audit_documentation">
### 1E — Documentation Audit

- [ ] README exists and explains what the project does, how to run it, how to contribute
- [ ] README is current (references match actual project state)
- [ ] No enterprise theater: no RACI matrices, no Gantt charts, no stakeholder maps
- [ ] No filler language in docs ("Simply", "Just", "Basically")
- [ ] API documentation exists if the project exposes APIs
- [ ] No temporal language in implementation docs ("We changed", "Previously", "No longer")
- [ ] Architecture decisions are recorded (ADRs, ARCHITECTURE.md, or equivalent)

Record findings as `DOCUMENTATION_GAPS[]`.
</step>

<step name="audit_dependencies">
### 1F — Dependency Audit

- [ ] No unnecessary dependencies (check if functionality could be achieved without them)
- [ ] No duplicate dependencies (two libraries doing the same thing)
- [ ] Lock file exists and is committed (package-lock.json, yarn.lock, Cargo.lock, etc.)
- [ ] No pinned-to-vulnerable versions (check for known CVEs if tooling available)
- [ ] Dev dependencies separated from production dependencies
- [ ] No vendored code that should be a dependency (or vice versa)

Record findings as `DEPENDENCY_GAPS[]`.
</step>

## Phase 2: Gap Analysis Report

<step name="produce_gap_analysis">
Synthesize all audit findings into a single structured report: `.planning/CALIBRATION-AUDIT.md`

Format:

```markdown
# Calibration Audit

**Repository:** {name}
**Audited:** {date}
**Overall health:** {HEALTHY | NEEDS_WORK | SIGNIFICANT_GAPS}

## Summary

{2-3 sentence overall assessment}

## Gaps by Priority

### Critical (fix first)
{Structural issues, security concerns, broken verification}

### High (fix second)
{Code quality issues, git practice violations, missing tests}

### Medium (fix third)
{Documentation gaps, naming conventions, dependency cleanup}

### Low (fix last or skip)
{Style preferences, optional improvements}

## Already Aligned
{What the repo already does well — acknowledge it}

## Recommendations

### Must Do
{Numbered list of concrete actions, ordered by dependency}

### Should Do
{Improvements that add value but aren't blocking}

### Skip
{GSD principles that don't apply to this repo and why}
```

Present the report to the user. Ask: "Proceed with applying fixes? You can choose: all, critical+high only, or specific items by number."
</step>

## Phase 3: Apply Transformations

<step name="apply_structure_fixes">
### 3A — Structure Fixes (if gaps found)

Apply in order:
1. Create `.planning/` directory if missing
2. Create PROJECT.md from existing README/docs (extract, don't duplicate)
3. Create STATE.md as initial state snapshot
4. Rename files/directories violating kebab-case (git mv to preserve history)
5. Reorganize if structure is flat or confused (move files, update imports)

One atomic commit per logical change. Format: `refactor(calibrate): {description}`
</step>

<step name="apply_code_quality_fixes">
### 3B — Code Quality Fixes (if gaps found)

Apply in order:
1. Remove dead code (unused exports, unreferenced files)
2. Remove stub implementations or replace with real ones (ask user if unclear)
3. Remove over-engineering (collapse single-use abstractions)
4. Add boundary validation where missing (user input, external APIs only)
5. Remove excessive internal validation

One atomic commit per logical change. Format: `refactor(calibrate): {description}`

STOP and ask the user before:
- Removing code that might be used dynamically (reflection, string-based imports)
- Collapsing abstractions that might be intentional extension points
- Any change that alters public API surface
</step>

<step name="apply_git_fixes">
### 3C — Git Fixes (if gaps found)

1. Update `.gitignore` if missing entries
2. Remove committed secrets/artifacts (if found, alert user immediately)
3. Document commit convention in CONTRIBUTING.md (create only if repo has multiple contributors or is open source)

Format: `chore(calibrate): {description}`
</step>

<step name="apply_verification_fixes">
### 3D — Verification Fixes (if gaps found)

1. Add test runner config if missing (match language/framework conventions)
2. Add CI pipeline if missing (GitHub Actions preferred, match existing if present)
3. Add linting config if missing (match language conventions)
4. Wire existing but disconnected tests into CI

Format: `chore(calibrate): {description}`

Do NOT write tests for existing code during calibration. That is project work, not calibration.
</step>

<step name="apply_documentation_fixes">
### 3E — Documentation Fixes (if gaps found)

1. Fix README if inaccurate or missing critical sections
2. Remove enterprise theater language
3. Remove filler language
4. Remove temporal language from implementation docs (not changelogs)
5. Add ARCHITECTURE.md if the codebase has non-obvious structure and none exists

Format: `docs(calibrate): {description}`
</step>

<step name="apply_dependency_fixes">
### 3F — Dependency Fixes (if gaps found)

1. Remove unused dependencies
2. Deduplicate overlapping dependencies (ask user which to keep)
3. Separate dev/prod dependencies if mixed
4. Regenerate lock file after changes

Format: `chore(calibrate): {description}`
</step>

## Phase 4: Verification

<step name="verify_calibration">
After all transformations:

1. Run existing tests (if any). All must still pass.
2. Run existing build (if any). Must still succeed.
3. Run existing linter (if any). No new violations.
4. Verify git history is clean (no broken commits, no merge artifacts).
5. Verify no files were accidentally deleted or corrupted.

If anything fails: fix it before proceeding. Do not leave the repo in a broken state.
</step>

## Phase 5: Final Report

<step name="final_report">
Update `.planning/CALIBRATION-AUDIT.md` with:

```markdown
## Calibration Results

**Applied:** {date}
**Commits:** {count} atomic commits
**Status:** {COMPLETE | PARTIAL — {reason}}

### Changes Applied
{Numbered list with commit hashes}

### Remaining Gaps
{Anything skipped and why}

### Next Steps
{What the maintainer should do next — e.g., "Write tests for X", "Decide on Y"}
```

Present the final report to the user.
</step>

</process>

<rules>
## Hard Rules — Never Violate

1. **Audit before changing.** Never modify code you haven't read and understood.
2. **Atomic commits.** One logical change per commit. Stage files individually.
3. **No breaking changes without asking.** If a transformation could break functionality, stop and ask.
4. **No over-application.** Skip GSD principles that don't fit the target repo. A Python CLI tool doesn't need wave-based multi-agent orchestration. A static site doesn't need three-level artifact verification.
5. **No enterprise theater.** Do not add process, documentation, or structure that doesn't serve a concrete purpose.
6. **Preserve existing conventions.** If the repo has a consistent style that conflicts with GSD on non-critical points (e.g., camelCase filenames in a React project), prefer the existing convention.
7. **Tests must still pass.** Never leave the repo in a broken state after calibration.
8. **No fabricated content.** PROJECT.md, REQUIREMENTS.md, and ROADMAP.md must be derived from existing repo artifacts (README, issues, docs), not invented. If not enough information exists, create skeleton files with clear placeholders and tell the user what to fill in.
9. **Commit messages are specific.** "refactor(calibrate): remove 12 unused exports from src/utils/" not "refactor(calibrate): cleanup".
10. **Ask when uncertain.** If you can't tell whether code is dead, whether an abstraction is intentional, or whether a dependency is used — ask. Don't guess.
</rules>

<context_budget>
This skill involves significant codebase exploration. Manage context deliberately:

- Phase 1 (Audit): Use parallel subagents or focused searches. Don't read every file — sample strategically.
- Phase 2 (Report): Synthesize findings concisely. No verbose explanations of obvious gaps.
- Phase 3 (Apply): Work one category at a time. Commit after each change to create recovery points.
- Phase 4 (Verify): Run commands, check outputs, move on. Don't re-audit.

If the repo is large (>500 files), prioritize: structure → git → code quality → verification → docs → deps.
</context_budget>
