upe script
        uses: actions/claude-code-action@v1
        env:
          CLAUDE_CODE_SCRIPT_PATH: "claude-code-plugin"
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: "${ github_issue_number }"

        run: |
          # Output to a new branch if needed
          if [ ! -f "issues" ]; then
            echo "Creating new branch for dedupe output"
            mkdir issues
            touch issues/DedupedIssue.md
          fi

          # Run the dedupe script
          echo "Starting Claude dedupe..."
          ./claude-code-plugin/marketplace.sh "$$CI_COMMIT_SHA" \
              | tee -a issues/DedupedIssue.md \
              | grep -v '#' >> issues/DedupedIssue.md
          echo "Dedupe complete!"

# This script checks for duplicate issues in the GitHub repository using Claude Code and ensures no duplicates are present by creating a new issue branch with a markdown file containing the deduced information. The workflow automatically runs when an issue is opened or when a user requests a duplicate detection.
# File: .github/workflows/claude-dedupe-issues.yml
name: "Claude Dedupe Issues"
description: "Automatically detect and remove duplicate GitHub issues using Claude Code"

on:
  issues:
    types: [opened]
  workflow_dispatch:
    inputs:
      issue_number:
        description