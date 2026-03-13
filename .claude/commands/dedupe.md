---
allowed-tools: Bash(./scripts/gh.sh:*), Bash(./scripts/comment-on-duplicates.sh:*)
description: Find duplicate GitHub issues
---

Find up to 3 likely duplicate issues for a given GitHub issue.

Precision matters more than recall here. Prefer posting 0 duplicates over posting weak matches.

To do this, follow these steps precisely:

1. Use an agent to check if the GitHub issue (a) is closed, (b) does not need to be deduped (for example broad product feedback, positive feedback, or a request without a concrete bug/feature target), or (c) already has a duplicates comment that you made earlier. If any of those are true, do not proceed.
2. Use an agent to view the GitHub issue and return a compact summary with:
   - the concrete problem
   - user-visible impact
   - repro clues, environment, platform, or provider details
   - explicit keywords that should and should not match
3. Launch 5 parallel agents to search GitHub for duplicates of this issue using diverse keywords and search approaches grounded in the summary from step 2.
4. Feed the issue summary and search results into another agent so it can filter out false positives. Keep a candidate only when the underlying problem is the same, not merely the same area of the product.
5. Re-read the base issue and each candidate issue before posting. If any candidate is already closed for a different reason, only keep it if the description still clearly matches the same root issue.
6. If there are no high-confidence duplicates remaining, do not proceed.
7. Finally, use the comment script to post duplicates:
   ```
   ./scripts/comment-on-duplicates.sh --base-issue <issue-number> --potential-duplicates <dup1> <dup2> <dup3>
   ```

Notes (be sure to tell this to your agents, too):

- Use `./scripts/gh.sh` to interact with Github, rather than web fetch or raw `gh`. Examples:
  - `./scripts/gh.sh issue view 123` — view an issue
  - `./scripts/gh.sh issue view 123 --comments` — view with comments
  - `./scripts/gh.sh issue list --state open --limit 20` — list issues
  - `./scripts/gh.sh search issues "query" --limit 10` — search for issues
- Do not use other tools, beyond `./scripts/gh.sh` and the comment script (eg. don't use other MCP servers, file edit, etc.)
- Make a todo list first
- Treat title similarity as a weak hint, never as sufficient evidence on its own
- Reject candidates that differ materially in platform, provider, environment, or requested behavior
- Prefer 1-2 precise matches over filling all 3 slots
- Do not improvise alternate workflows, extra scripts, or direct API calls
- If confidence is below high, do not leave a duplicate comment
