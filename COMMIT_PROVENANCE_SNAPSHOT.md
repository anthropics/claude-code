# Commit Provenance Snapshot

## Commit Metadata
- **Full SHA:** `5af0b38a926f20deab326d06e250058fb709fc85`
- **Author:** Boris Cherny
- **Author Email:** `boris@anthropic.com`
- **Commit Date:** `2025-08-09T01:26:48Z`
- **Commit Message:**

  ```text
  Add Statsig event logging to GitHub issue workflows

  - Log events when issues are closed as duplicates in auto-close script
  - Log events when duplicate comments are added via dedupe workflow
  - Log events when new issues are created
  - Follow existing pattern from code review reactions workflow

  🤖 Generated with [Claude Code](https://claude.ai/code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

## Change Summary
- **Files Changed:** 4
- **Total Additions:** 162
- **Total Deletions:** 0
- **Changed Files:**
  - `.github/workflows/auto-close-duplicates.yml`
  - `.github/workflows/claude-dedupe-issues.yml`
  - `.github/workflows/log-issue-events.yml`
  - `scripts/auto-close-duplicates.ts`

## Notes
This commit adds Statsig event logging to issue-related GitHub workflows so duplicate closures, dedupe comments, and new issue creation events are tracked consistently with related workflow code.
