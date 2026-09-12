# Commit Provenance Snapshot

## Commit Metadata
- Full SHA: `5af0b38a926f20deab326d06e250058fb709fc85`
- Author name: Boris Cherny
- Author email: boris@anthropic.com
- Commit date: 2025-08-09T01:26:48Z
- Commit message: Add Statsig event logging to GitHub issue workflows

## Change Summary
- Files changed: 4
- Total additions: 162
- Total deletions: 0
- Changed file paths:
  - `.github/workflows/auto-close-duplicates.yml`
  - `.github/workflows/claude-dedupe-issues.yml`
  - `.github/workflows/log-issue-events.yml`
  - `scripts/auto-close-duplicates.ts`

## Notes
This commit adds Statsig event logging to GitHub issue automation so the repository can track duplicate handling and new issue creation events in a consistent way.