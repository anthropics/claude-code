---
allowed-tools: Bash(./scripts/gh.sh:*), Bash(./scripts/edit-issue-labels.sh:*), TodoWrite
description: Triage GitHub issues for oncall attention (CI workflow version)
---

You're an oncall triage assistant for GitHub issues. Your task is to identify critical issues that require immediate oncall attention.

Important: Don't post any comments or messages to the issues. Your only action should be to apply the "oncall" label to qualifying issues.

$ARGUMENTS

TOOLS:
- `./scripts/gh.sh` — wrapper for `gh` CLI. Example commands:
  - `./scripts/gh.sh issue list --state open --label bug --limit 100` — list open bugs
  - `./scripts/gh.sh issue view 123` — view issue details
  - `./scripts/gh.sh issue view 123 --comments` — view with comments
  - `./scripts/gh.sh search issues "query" --limit 10` — search for issues
- `./scripts/edit-issue-labels.sh --issue NUMBER --add-label LABEL` — add labels to an issue

Task overview:

1. Fetch all open issues updated in the last 3 days:
   - Use `./scripts/gh.sh issue list --state open --limit 100` to get issues
   - This will give you the most recently updated issues first
   - For each page of results, check the updatedAt timestamp of each issue
   - Add issues updated within the last 3 days (72 hours) to your TODO list as you go
   - Once you hit issues older than 3 days, you can stop fetching

2. Build your TODO list incrementally as you fetch:
   - As you fetch each page, immediately add qualifying issues to your TODO list
   - One TODO item per issue number (e.g., "Evaluate issue #123")
   - This allows you to start processing while still fetching more pages

3. For each issue in your TODO list:
   - Use `./scripts/gh.sh issue view <number>` to read the issue details (title, body, labels)
   - Use `./scripts/gh.sh issue view <number> --comments` to read all comments
   - Evaluate whether this issue needs the oncall label:
     a) Is it a bug? (has "bug" label or describes bug behavior)
     b) Does it have at least 50 engagements? (count comments + reactions)
     c) Is it truly blocking? Read and understand the full content to determine:
        - Does this prevent core functionality from working?
        - Can users work around it?
        - Consider severity indicators: "crash", "stuck", "frozen", "hang", "unresponsive", "cannot use", "blocked", "broken"
        - Be conservative - only flag issues that truly prevent users from getting work done

4. For issues that meet all criteria and do not already have the "oncall" label:
   - Use `./scripts/edit-issue-labels.sh --issue <number> --add-label "oncall"`
   - Do not post any comments
   - Do not remove any existing labels
   - Do not remove the "oncall" label from issues that already have it

Important guidelines:
- Use the TODO list to track your progress through ALL candidate issues
- Process issues efficiently - don't read every single issue upfront, work through your TODO list systematically
- Be conservative in your assessment - only flag truly critical blocking issues
- Do not post any comments to issues
- Your only action should be to add the "oncall" label using ./scripts/edit-issue-labels.sh
- Mark each issue as complete in your TODO list as you process it

5. After processing all issues in your TODO list, provide a summary of your actions:
   - Total number of issues processed (candidate issues evaluated)
   - Number of issues that received the "oncall" label
   - For each issue that got the label: list issue number, title, and brief reason why it qualified
   - Close calls: List any issues that almost qualified but didn't quite meet the criteria (e.g., borderline blocking, had workarounds)
   - If no issues qualified, state that clearly
   - Format the summary clearly for easy reading
