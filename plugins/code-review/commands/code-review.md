---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*), mcp__github_inline_comment__create_inline_comment
description: Code review a pull request
---

Provide a code review for the given pull request.

## Steps

1. **Pre-check (haiku agent)**: Check if any of the following are true. If so, stop and do not proceed:
   - The pull request is closed or is a draft
   - The pull request does not need code review (e.g. automated PR, trivial change)
   - Claude has already commented on this PR (check `gh pr view <PR> --comments` for comments left by claude)

   Note: Still review Claude-generated PRs.

2. **Get CLAUDE.md files (haiku agent)**: Return a list of file paths for all relevant CLAUDE.md files:
   - The root CLAUDE.md file, if it exists
   - Any CLAUDE.md files in directories containing modified files

3. **Review the PR**: Launch 2 agents in parallel. Each returns a list of issues with: file path, line number(s), description, and fix.

   **Agent 1: Bug detector (Opus)**
   Review the diff carefully, line by line. Find bugs that will cause incorrect behavior at runtime.

   **Agent 2: CLAUDE.md compliance (Sonnet)**
   Check changes against CLAUDE.md rules. Only flag clear violations where you can quote the exact rule being broken. Only consider CLAUDE.md files that are ancestors of the modified file. If no CLAUDE.md files exist, return an empty list.

   **For both agents:**
   - Give them the PR title and description for context
   - Flag only issues you are CONFIDENT about
   - One strong signal is better than several weak ones

4. **Deduplicate and merge**: Collect all issues from both agents. Remove duplicates (same file + same line range + same issue). If the same bug is reported twice, keep only one.

5. **Post summary comment**: Use `gh pr comment` to post:
   - "## Code review" header
   - Total number of unique issues found
   - Brief one-line summary of each issue
   - Or if no issues: "No issues found. Checked for bugs and CLAUDE.md compliance."

6. **Post inline comments**: For each unique issue, use `mcp__github_inline_comment__create_inline_comment`:
   - `path`: the file path
   - `line` (and `startLine` for ranges): select the buggy lines so the user sees them
   - `body`: Brief description of the issue. For small fixes (1-3 lines), include:
     ```suggestion
     corrected code here
     ```
     For larger fixes, describe the solution approach instead.

   **IMPORTANT: Only post ONE comment per unique issue. Do not post duplicate comments.**

## What to flag (high signal)

- Objective bugs that will cause incorrect behavior at runtime
- Clear CLAUDE.md violations where you can quote the exact rule

## What NOT to flag (false positives)

- Pre-existing issues not introduced by this PR
- Style preferences not required by CLAUDE.md
- Issues a linter would catch
- Subjective concerns or "maybes"
- General code quality concerns (test coverage, etc.) unless required by CLAUDE.md

## Notes

- Use `gh pr diff` and `gh pr view` to fetch PR information
- Create a todo list before starting
