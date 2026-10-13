---
description: "Comprehensive PR review using specialized agents"
argument-hint: "[review-aspects] [--comment] [--sequential]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Agent"]
---

# Comprehensive PR Review

Run a comprehensive pull request review using multiple specialized agents, each focusing on a different aspect of code quality.

**Arguments:** "$ARGUMENTS"

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional. Do not test tools or make exploratory calls.
- Only call a tool if it is required. Every tool call should have a clear purpose.

## Step 1: Parse Arguments

Parse "$ARGUMENTS" for:
- **Review aspects**: `comments`, `tests`, `errors`, `types`, `code`, `simplify`, `all` (default: `all`)
- **Flags**: `--comment` (post findings as inline PR comments if supported by the platform), `--sequential` (run agents one at a time instead of in parallel)

## Step 2: Pre-flight Check

Launch a haiku agent to check if any of the following are true:
- The current branch has no changes compared to the base branch
- If a PR/MR exists (detect using available CLI tools such as `gh`, `glab`, or git remote URL inspection): is it closed?
- If `--comment` flag is set but no PR/MR exists: stop (comments require a PR/MR)
- If a PR/MR exists and `--comment` flag is set: check existing comments for a "## PR Review" header to avoid posting duplicate reviews.

If any blocking condition is true, stop and explain why.

Note: Still review AI-generated PRs.

## Step 3: Gather Context

Run these in parallel:
- `git diff --name-only` against the base branch (query the PR/MR for the base ref if one exists, otherwise diff against the repo's default branch) to get changed files
- `git diff` (same base) to get the full diff content
- If a PR/MR exists: get the title and description using available platform CLI tools

If `git diff --name-only` returns no files, stop immediately: "No changes found between the current branch and the base branch. Nothing to review."

## Step 4: Discover Project Standards

Before launching review agents, gather project conventions once so agents don't duplicate this work:

- Read all CLAUDE.md files in the repo root and in directories containing changed files
- Read CONTRIBUTING.md if present
- Identify the project's language(s) and framework(s) from the changed files
- Check for linter/formatter configs (e.g., `.eslintrc`, `pyproject.toml`, `.editorconfig`, `rustfmt.toml`)
- Note the test framework and test file conventions from existing test files

Compile a brief **project standards summary** to pass to all agents.

## Step 5: Determine Applicable Agents

From the changed files, determine which review agents to run:
- **code-reviewer**: Always applicable
- **pr-test-analyzer**: If test files changed, OR if non-test source files changed without corresponding test changes
- **comment-analyzer**: If files contain comment/doc changes (check diff for `+.*//`, `+.*/\*`, `+.*#`, `+.*"""`, `+.*///`)
- **silent-failure-hunter**: If diff contains error handling patterns (`catch`, `except`, `rescue`, `try`, `Result::Err`, `.catch(`, `on_error`, `fallback`)
- **type-design-analyzer**: If diff contains type definitions (`type `, `interface `, `struct `, `class `, `enum `, `dataclass`, `TypedDict`, `Schema`)

If user requested specific aspects, only run those regardless of applicability detection.

## Step 6: Launch Review Agents

Launch the applicable review agents. Default is parallel for speed; sequential only if user passed the `--sequential` flag.

Each agent receives via its prompt:
- The **project standards summary** from Step 4
- The list of changed files
- The PR title and description (if available)

**Agent model assignments** (already configured in agent frontmatter):
- code-reviewer: opus (high effort) — CLAUDE.md compliance + bug detection
- pr-test-analyzer: sonnet — test coverage analysis
- comment-analyzer: sonnet — comment accuracy
- silent-failure-hunter: sonnet — error handling audit
- type-design-analyzer: sonnet — type design quality
- code-simplifier: opus (high effort) — invoked separately, not part of `all`

**Do NOT run code-simplifier in this step** unless the user explicitly requested `simplify`. Code-simplifier is not included in `all` — it must be invoked separately (e.g., `/pr-review-toolkit:review-pr simplify`) after addressing review findings.

## Step 7: Validate Findings

For each issue found by the review agents in Step 6, launch parallel validation subagents:

- For each **bug or logic issue**: Launch an opus agent to verify the issue is real by reading the actual code (not just the diff). The agent should confirm the bug exists and is not a false positive.
- For each **project standards violation**: Launch a haiku agent to verify the cited rule exists in the project standards from Step 4 and applies to the file in question.

## Step 8: Filter False Positives

Distinguish between validation outcomes:
- **Explicitly rejected**: The validation agent confirmed the issue is not real — remove it.
- **Validated**: The validation agent confirmed the issue is real — keep it.
- **Inconclusive or failed**: The validation agent errored, timed out, or returned ambiguous results — keep the issue and mark it as "[Unverified] Manual review recommended."

Also remove any issue that:
- Is a pre-existing issue (existed before this PR's changes)
- Is a pedantic nitpick a senior engineer would not flag
- Is a code style concern not explicitly required by project standards
- Is something a linter would catch (do not run linters to verify)
- Is silenced in code via lint-ignore comments or equivalent
- Depends on specific inputs or runtime state to manifest
- Is speculative ("could potentially" without concrete evidence)

**We only want HIGH SIGNAL issues.** If you are not certain an issue is real, do not include it. False positives erode trust.

## Step 9: Output Results

Output a summary to the terminal:

```markdown
# PR Review Summary

## Critical Issues (X found)
- [agent-name] file:line — Issue description

## Important Issues (X found)
- [agent-name] file:line — Issue description

## Suggestions (X found)
- [agent-name] file:line — Suggestion

## Strengths
- What's well-done in this PR

## Recommended Action
1. Fix critical issues first
2. Address important issues
3. Consider suggestions
4. Re-run `/pr-review-toolkit:review-pr` after fixes
```

If no issues were found, state: "No issues found. Checked for bugs, project standards compliance, and code quality."

If `--comment` was NOT provided, stop here.

## Step 10: Draft Comments (only with --comment flag)

Before posting, draft the full list of comments you plan to leave. Review the draft to ensure:
- Each comment is actionable and specific
- No duplicate issues
- Suggestions are committable only if committing them fully resolves the issue
- Tone is constructive

Do not output this draft to the user. This is a self-review gate.

## Step 11: Post PR Comments (only with --comment flag)

Detect the hosting platform from the git remote URL and available CLI tools (`gh` for GitHub, `glab` for GitLab, etc.).

If `--comment` is provided and NO issues were found, post a summary comment on the PR/MR:

```
## PR Review

No issues found. Checked for bugs, project standards compliance, and code quality.
```

If `--comment` is provided and issues WERE found, prefer the platform's inline/review comment API to post findings on specific lines. For example, on GitHub:

```
gh api repos/{owner}/{repo}/pulls/{number}/reviews --input - <<EOF
{
  "event": "COMMENT",
  "body": "## PR Review Summary\n\n{summary text}",
  "comments": [
    {"path": "file.py", "line": 42, "body": "Issue description..."},
    {"path": "file.py", "line": 100, "body": "Another issue..."}
  ]
}
EOF
```

For each issue, create a comment entry with:
- `path`: The file path relative to repo root
- `line`: The specific line number from the finding
- `body`: Brief description of the issue. For small self-contained fixes, include a suggestion block if the platform supports it. For larger fixes, describe the approach without inline code.

Inline comments give each finding its own resolve button and threaded discussion context. If the platform does not support inline review comments, fall back to a single summary comment.

**Post only ONE comment per unique issue. Do not post duplicates.**

## Available Review Aspects

| Aspect | Agent | What it checks |
|--------|-------|---------------|
| `code` | code-reviewer | CLAUDE.md compliance, bugs, style |
| `tests` | pr-test-analyzer | Test coverage, critical gaps |
| `comments` | comment-analyzer | Comment accuracy, rot, completeness |
| `errors` | silent-failure-hunter | Silent failures, empty catches, bad fallbacks |
| `types` | type-design-analyzer | Type encapsulation, invariants |
| `simplify` | code-simplifier | Code clarity (runs separately, after review) |
| `all` | All applicable | Default behavior |

