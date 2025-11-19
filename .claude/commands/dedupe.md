---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*)
description: Find duplicate GitHub issues
---

Find up to 3 likely duplicate issues for a given GitHub issue.

To do this, follow these steps precisely:

1. Use an agent to check if the Github issue (a) is closed, (b) does not need to be deduped (eg. because it is broad product feedback without a specific solution, or positive feedback), or (c) already has a duplicates comment that you made earlier. If so, do not proceed and write `{"skip": true, "reason": "..."}` to `/tmp/dedupe-result.json`.
2. Use an agent to view a Github issue, and ask the agent to return a summary of the issue
3. Then, launch 5 parallel agents to search Github for duplicates of this issue, using diverse keywords and search approaches, using the summary from #1
4. Next, feed the results from #1 and #2 into another agent, so that it can filter out false positives, that are likely not actually duplicates of the original issue. If there are no duplicates remaining, write `{"skip": true, "reason": "no duplicates found"}` to `/tmp/dedupe-result.json` and do not proceed.
5. Finally, write a JSON file to `/tmp/dedupe-result.json` with the list of duplicate issue URLs. Do NOT post comments directly.

IMPORTANT: You must write output to `/tmp/dedupe-result.json` - never post comments directly. The workflow will handle posting.

The JSON output format must be exactly:
```json
{
  "duplicates": ["https://github.com/owner/repo/issues/123", "https://github.com/owner/repo/issues/456"]
}
```

Or if skipping:
```json
{
  "skip": true,
  "reason": "reason for skipping"
}
```

Notes (be sure to tell this to your agents, too):

- Use `gh` to interact with Github for reading issues only, rather than web fetch
- Do not use other tools beyond `gh` for reading (eg. don't use other MCP servers, file edit beyond the output JSON, etc.)
- Do NOT use `gh issue comment` or `gh api` - these are not permitted for security reasons
- Make a todo list first
- Output must be written to `/tmp/dedupe-result.json` - the workflow handles comment posting
