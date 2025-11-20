---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh api:*), Bash(gh issue comment:*)
description: Find duplicate GitHub issues
---

Find up to 3 likely duplicate issues for a given GitHub issue.

To do this, follow these steps precisely:

1. Use an agent to check if the Github issue (a) is closed, (b) does not need to be deduped (eg. because it is broad product feedback without a specific solution, or positive feedback), or (c) already has a duplicates comment that you made earlier. If so, do not proceed.
2. Use an agent to view a Github issue, and ask the agent to return a summary of the issue
3. Then, launch 5 parallel agents to search Github for duplicates of this issue, using diverse keywords and search approaches, using the summary from #1
4. Next, feed the results from #1 and #2 into another agent, so that it can filter out false positives, that are likely not actually duplicates of the original issue. If there are no duplicates remaining, do not proceed.
5. Finally, comment back on the issue with a list of up to three duplicate issues (or zero, if there are no likely duplicates)

Notes (be sure to tell this to your agents, too):

- Use `gh` to interact with Github, rather than web fetch
- Do not use other tools, beyond `gh` (eg. don't use other MCP servers, file edit, etc.)
- Make a todo list first
- For your comment, follow the following format precisely (assuming for this example that you found 3 suspected duplicates):

---

Found 3 possible duplicate issues:

1. <link to issue>
2. <link to issue>
3. <link to issue>

This issue will be automatically closed as a duplicate in 3 days.

- If your issue is a duplicate, please close it and 👍 the existing issue instead
- To prevent auto-closure, add a comment or 👎 this comment

🤖 Generated with [Claude Code](https://claude.ai/code)

---
