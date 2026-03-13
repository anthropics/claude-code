# Code Review Plugin

Automated code review for pull requests using multiple specialized agents with a validation step to filter false positives.

## Overview

The Code Review Plugin automates pull request review by launching multiple agents in parallel to independently audit changes from different perspectives. Each issue found is then independently validated by a separate agent, ensuring only high-confidence, actionable feedback is surfaced.

## Commands

### `/code-review`

Performs automated code review on a pull request using multiple specialized agents.

**What it does:**
1. Checks if review is needed (skips closed, draft, trivial, or already-reviewed PRs)
2. Gathers relevant CLAUDE.md guideline files from the repository
3. Summarizes the pull request changes
4. Launches 4 parallel agents to independently review:
   - **Agents #1 & #2**: Audit for CLAUDE.md compliance (parallel)
   - **Agent #3**: Scan for obvious bugs in the diff only
   - **Agent #4**: Analyze problems introduced by the changed code (security, logic errors)
5. Validates each issue from agents #3 and #4 with dedicated parallel subagents
6. Filters out issues that did not pass validation
7. Outputs review to terminal (or as inline PR comments with `--comment` flag)

**Usage:**
```bash
/code-review [--comment]
```

**Options:**
- `--comment`: Post the review as inline comments on the pull request (default: outputs to terminal only)

**Example workflow:**
```bash
# On a PR branch, run locally (outputs to terminal):
/code-review

# Post review as inline PR comments:
/code-review --comment

# Claude will:
# - Launch 4 review agents in parallel
# - Validate each flagged issue with a dedicated subagent
# - Output validated issues (to terminal or as PR inline comments)
# - Skip if no validated issues found
```

**Features:**
- Multiple independent agents for comprehensive review
- Dedicated validation step eliminates false positives
- CLAUDE.md compliance checking with explicit guideline verification
- Bug detection focused on changes (not pre-existing issues)
- Automatic skipping of closed, draft, or already-reviewed PRs
- Inline PR comments with links to exact code locations

**Review comment format:**
```markdown
## Code review

Found 3 issues:

1. Missing error handling for OAuth callback (CLAUDE.md says "Always handle OAuth errors")

https://github.com/owner/repo/blob/abc123.../src/auth.ts#L67-L72

2. Memory leak: OAuth state not cleaned up (bug due to missing cleanup in finally block)

https://github.com/owner/repo/blob/abc123.../src/auth.ts#L88-L95

3. Inconsistent naming pattern (src/conventions/CLAUDE.md says "Use camelCase for functions")

https://github.com/owner/repo/blob/abc123.../src/utils.ts#L23-L28
```

**False positives filtered:**
- Pre-existing issues not introduced in PR
- Code that looks like a bug but isn't
- Pedantic nitpicks
- Issues linters will catch
- General quality issues (unless in CLAUDE.md)
- Issues with lint ignore comments

## Required permissions

The plugin's subagents need the following tools to read repository files and interact with GitHub. If your project's `.claude/settings.json` uses a restrictive `permissions.allow` list, add these entries or the plugin will silently produce no output:

```json
{
  "permissions": {
    "allow": [
      "Bash(gh *)",
      "Bash(git *)",
      "Read",
      "Glob",
      "Grep"
    ]
  }
}
```

> **Note:** When tool permissions are denied, the plugin completes with a `success` status but produces no review output and no error message. If you run `/code-review` and get no output despite having a non-trivial PR, check your project's permission settings first.

## Installation

This plugin is included in the Claude Code repository. The command is automatically available when using Claude Code.

## Best Practices

### Using `/code-review`
- Maintain clear CLAUDE.md files for better compliance checking
- Trust the validation step — issues must be confirmed by a second agent before being surfaced
- Run on all non-trivial pull requests
- Review agent findings as a starting point for human review
- Update CLAUDE.md based on recurring review patterns

### When to use
- All pull requests with meaningful changes
- PRs touching critical code paths
- PRs from multiple contributors
- PRs where guideline compliance matters

### When not to use
- Closed or draft PRs (automatically skipped)
- Trivial automated PRs (automatically skipped)
- Urgent hotfixes requiring immediate merge
- PRs already reviewed (automatically skipped)

## Workflow Integration

### Standard PR review workflow:
```bash
# Create PR with changes
# Run local review (outputs to terminal)
/code-review

# Review the automated feedback
# Make any necessary fixes

# Optionally post as inline PR comments
/code-review --comment

# Merge when ready
```

### As part of CI/CD:
```bash
# Trigger on PR creation or update
# Use --comment flag to post inline review comments
/code-review --comment
# Skip if review already exists
```

## Requirements

- Git repository with GitHub integration
- GitHub CLI (`gh`) installed and authenticated
- `mcp__github_inline_comment` MCP server configured (required for `--comment` to post inline comments)
- CLAUDE.md files (optional but recommended for guideline checking)

## Troubleshooting

### Review takes too long

**Issue**: Agents are slow on large PRs

**Solution**:
- Normal for large changes — agents run in parallel
- Multiple independent agents ensure thoroughness
- Consider splitting large PRs into smaller ones

### No review output or comment posted

**Issue**: `/code-review` runs but produces no terminal output or PR comment

**Solution**:
Check in order:

1. **Tool permissions denied** — If your project's `.claude/settings.json` has a restrictive `permissions.allow` list, the subagents may be silently blocked from reading files or running `git`/`gh` commands. See the [Required permissions](#required-permissions) section above. This is the most common cause of silent failures.
2. PR is closed (reviews skipped)
3. PR is draft (reviews skipped)
4. PR is trivial/automated (reviews skipped)
5. PR already has a Claude review (reviews skipped)
6. No issues passed validation (no output needed)

### Link formatting broken

**Issue**: Code links don't render correctly in GitHub

**Solution**:
Links must follow this exact format:
```
https://github.com/owner/repo/blob/[full-sha]/path/file.ext#L[start]-L[end]
```
- Must use full SHA (not abbreviated)
- Must use `#L` notation
- Must include line range with at least 1 line of context

### Inline comments not posted

**Issue**: `--comment` flag used but no inline comments appear on the PR

**Solution**:
- Ensure the `mcp__github_inline_comment` MCP server is configured in your `.mcp.json`
- Verify `gh` is authenticated: `gh auth status`
- Check that the PR exists and is open

### GitHub CLI not working

**Issue**: `gh` commands fail

**Solution**:
- Install GitHub CLI: `brew install gh` (macOS) or see [GitHub CLI installation](https://cli.github.com/)
- Authenticate: `gh auth login`
- Verify repository has GitHub remote

## Tips

- **Write specific CLAUDE.md files**: Clear guidelines = better reviews
- **Include context in PRs**: Helps agents understand intent
- **Check permissions first**: Silent failures are almost always a permissions issue
- **Review automatically**: Set up as part of PR workflow
- **Trust the validation step**: Issues must survive a second review before being surfaced

## Configuration

### Customizing review focus

Edit `commands/code-review.md` to add or modify agent tasks:
- Add security-focused agents
- Add performance analysis agents
- Add accessibility checking agents
- Add documentation quality checks

## Technical Details

### Agent architecture
- **2x CLAUDE.md compliance agents** (Sonnet): Redundancy for guideline checks, run in parallel
- **1x bug detector** (Opus): Focused on obvious bugs in the diff only
- **1x introduced-code analyzer** (Opus): Security issues, incorrect logic in changed code
- **Nx validation agents**: One per flagged issue from the bug/logic agents; filters false positives before output

### Validation system
Each issue flagged by agents #3 and #4 is passed to a dedicated validation subagent. The validator:
- Re-examines the specific issue independently
- Confirms the issue is real (e.g. variable actually undefined, CLAUDE.md rule actually violated)
- Drops the issue if it cannot be confirmed with high confidence

### GitHub integration
Uses `gh` CLI for:
- Viewing PR details and diffs
- Fetching repository data
- Posting summary comments

Uses `mcp__github_inline_comment` MCP server for:
- Posting inline comments on specific lines

## Author

Boris Cherny (boris@anthropic.com)

## Version

1.0.0
