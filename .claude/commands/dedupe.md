---
allowed-tools: Bash(./scripts/gh.sh:*), Bash(./scripts/comment-on-duplicates.sh:*)
description: Find duplicate GitHub issues
---

Find up to 3 likely duplicate issues for a given GitHub issue.

To do this, follow these steps precisely:

1. Use an agent to check if the Github issue (a) is closed, (b) does not need to be deduped (eg. because it is broad product feedback without a specific solution, or positive feedback), or (c) already has a duplicates comment that you made earlier. If so, do not proceed.
2. Use an agent to view a Github issue, and ask the agent to return a summary of the issue
3. Then, launch 5 parallel agents to search Github for duplicates of this issue, using diverse keywords and search approaches, using the summary from #1
4. Next, feed the results from #1 and #2 into another agent, so that it can filter out false positives, that are likely not actually duplicates of the original issue. If there are no duplicates remaining, do not proceed.
5. Finally, use the comment script to post duplicates:
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
