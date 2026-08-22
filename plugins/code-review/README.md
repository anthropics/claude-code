# Code Review Plugin

Automated code review for pull requests (GitHub) and merge requests (GitLab) using multiple specialized agents with confidence-based scoring to filter false positives.

## Overview

The Code Review Plugin automates PR/MR review by launching multiple agents in parallel to independently audit changes from different perspectives. It supports both GitHub and GitLab (including self-hosted instances), automatically detecting the platform from the git remote. It uses confidence scoring to filter out false positives, ensuring only high-quality, actionable feedback is posted.

## Commands

### `/code-review`

Performs automated code review on a pull request (GitHub) or merge request (GitLab) using multiple specialized agents.

**What it does:**
1. Detects the platform (GitHub or GitLab) from the git remote
2. Checks if review is needed (skips closed, draft, trivial, or already-reviewed PR/MRs)
3. Gathers relevant CLAUDE.md guideline files from the repository
4. Summarizes the PR/MR changes
5. Launches 4 parallel agents to independently review:
   - **Agents #1 & #2**: Audit for CLAUDE.md compliance
   - **Agent #3**: Scan for obvious bugs in changes
   - **Agent #4**: Analyze git blame/history for context-based issues
6. Scores each issue 0-100 for confidence level
7. Filters out issues below 80 confidence threshold
8. Outputs review (to terminal by default, or as PR/MR comment with `--comment` flag)

**Usage:**
```bash
/code-review [--comment]
```

**Options:**
- `--comment`: Post the review as a comment on the PR/MR (default: outputs to terminal only)

**Example workflow:**
```bash
# On a PR/MR branch, run locally (outputs to terminal):
/code-review

# Post review as PR/MR comment:
/code-review --comment

# Claude will:
# - Auto-detect GitHub or GitLab from git remote
# - Launch 4 review agents in parallel
# - Score each issue for confidence
# - Output issues ≥80 confidence (to terminal or PR/MR depending on flag)
# - Skip if no high-confidence issues found
```

**Features:**
- **GitHub and GitLab support** with automatic platform detection (including self-hosted instances)
- Multiple independent agents for comprehensive review
- Confidence-based scoring reduces false positives (threshold: 80)
- CLAUDE.md compliance checking with explicit guideline verification
- Bug detection focused on changes (not pre-existing issues)
- Historical context analysis via git blame
- Automatic skipping of closed, draft, or already-reviewed PR/MRs
- Links directly to code with full SHA and line ranges

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

**Confidence scoring:**
- **0**: Not confident, false positive
- **25**: Somewhat confident, might be real
- **50**: Moderately confident, real but minor
- **75**: Highly confident, real and important
- **100**: Absolutely certain, definitely real

**False positives filtered:**
- Pre-existing issues not introduced in PR
- Code that looks like a bug but isn't
- Pedantic nitpicks
- Issues linters will catch
- General quality issues (unless in CLAUDE.md)
- Issues with lint ignore comments

## Installation

This plugin is included in the Claude Code repository. The command is automatically available when using Claude Code.

## Best Practices

### Using `/code-review`
- Maintain clear CLAUDE.md files for better compliance checking
- Trust the 80+ confidence threshold - false positives are filtered
- Run on all non-trivial pull requests / merge requests
- Review agent findings as a starting point for human review
- Update CLAUDE.md based on recurring review patterns

### When to use
- All pull requests / merge requests with meaningful changes
- PR/MRs touching critical code paths
- PR/MRs from multiple contributors
- PR/MRs where guideline compliance matters

### When not to use
- Closed or draft PR/MRs (automatically skipped anyway)
- Trivial automated PR/MRs (automatically skipped)
- Urgent hotfixes requiring immediate merge
- PR/MRs already reviewed (automatically skipped)

## Workflow Integration

### Standard review workflow (GitHub or GitLab):
```bash
# Create PR/MR with changes
# Run local review (outputs to terminal)
/code-review

# Review the automated feedback
# Make any necessary fixes

# Optionally post as PR/MR comment
/code-review --comment

# Merge when ready
```

### As part of CI/CD:
```bash
# Trigger on PR/MR creation or update
# Use --comment flag to post review comments
/code-review --comment
# Skip if review already exists
```

## Requirements

- Git repository with a GitHub or GitLab remote
- **For GitHub**: GitHub CLI (`gh`) installed and authenticated
- **For GitLab**: GitLab CLI (`glab`) installed and authenticated
- CLAUDE.md files (optional but recommended for guideline checking)

The plugin automatically detects the platform from the git remote URL. For self-hosted instances, it probes the API to distinguish between GitHub Enterprise and GitLab CE/EE.

## Troubleshooting

### Review takes too long

**Issue**: Agents are slow on large PRs

**Solution**:
- Normal for large changes - agents run in parallel
- 4 independent agents ensure thoroughness
- Consider splitting large PRs into smaller ones

### Too many false positives

**Issue**: Review flags issues that aren't real

**Solution**:
- Default threshold is 80 (already filters most false positives)
- Make CLAUDE.md more specific about what matters
- Consider if the flagged issue is actually valid

### No review comment posted

**Issue**: `/code-review` runs but no comment appears

**Solution**:
Check if:
- PR/MR is closed (reviews skipped)
- PR/MR is draft (reviews skipped)
- PR/MR is trivial/automated (reviews skipped)
- PR/MR already has review (reviews skipped)
- No issues scored ≥80 (no comment needed)

### Link formatting broken

**Issue**: Code links don't render correctly

**Solution**:
Links must follow the exact format for the detected platform:

GitHub:
```
https://github.com/owner/repo/blob/[full-sha]/path/file.ext#L[start]-L[end]
```

GitLab:
```
https://gitlab.com/owner/repo/-/blob/[full-sha]/path/file.ext#L[start]-[end]
```
- Must use full SHA (not abbreviated)
- Must use `#L` notation
- Must include line range with at least 1 line of context
- GitLab uses `/-/blob/` and omits the second `L` in ranges

### GitHub CLI not working

**Issue**: `gh` commands fail

**Solution**:
- Install GitHub CLI: `brew install gh` (macOS) or see [GitHub CLI installation](https://cli.github.com/)
- Authenticate: `gh auth login`
- Verify repository has GitHub remote

### GitLab CLI not working

**Issue**: `glab` commands fail

**Solution**:
- Install GitLab CLI: `brew install glab` (macOS) or see [GLab installation](https://gitlab.com/gitlab-org/cli#installation)
- Authenticate: `glab auth login`
- Verify repository has GitLab remote

## Tips

- **Write specific CLAUDE.md files**: Clear guidelines = better reviews
- **Include context in PR/MRs**: Helps agents understand intent
- **Use confidence scores**: Issues ≥80 are usually correct
- **Iterate on guidelines**: Update CLAUDE.md based on patterns
- **Review automatically**: Set up as part of PR/MR workflow
- **Trust the filtering**: Threshold prevents noise

## Configuration

### Adjusting confidence threshold

The default threshold is 80. To adjust, modify `commands/code-review.md`:
```markdown
Filter out any issues with a score less than 80.
```

Change `80` to your preferred threshold (0-100).

### Customizing review focus

Edit `commands/code-review.md` to add or modify agent tasks:
- Add security-focused agents
- Add performance analysis agents
- Add accessibility checking agents
- Add documentation quality checks

## Technical Details

### Agent architecture
- **2x CLAUDE.md compliance agents**: Redundancy for guideline checks
- **1x bug detector**: Focused on obvious bugs in changes only
- **1x history analyzer**: Context from git blame and history
- **Nx confidence scorers**: One per issue for independent scoring

### Scoring system
- Each issue independently scored 0-100
- Scoring considers evidence strength and verification
- Threshold (default 80) filters low-confidence issues
- For CLAUDE.md issues: verifies guideline explicitly mentions it

### Platform integration

**GitHub** — uses `gh` CLI for:
- Viewing PR details and diffs
- Fetching repository data
- Reading git blame and history
- Posting review comments (via `gh pr comment` and `mcp__github_inline_comment`)

**GitLab** — uses `glab` CLI for:
- Viewing MR details and diffs
- Fetching repository data
- Reading git blame and history
- Posting review comments (via `glab mr note` and `glab api` for inline discussions)

## Author

Boris Cherny (boris@anthropic.com)

## Version

1.0.0
