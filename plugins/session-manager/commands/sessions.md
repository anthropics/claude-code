---
allowed-tools: Bash(pwd:*), Bash(ls:*), Bash(stat:*)
description: List available Claude Code sessions for the current working directory
---

## Your task

1. Run `pwd` to get the current working directory
2. Convert the path to the Claude project directory format by replacing all `/` with `-` and removing the leading `-` (e.g. `/Users/foo/myproject` → `Users-foo-myproject`)
3. Run `ls $HOME/.claude/projects/<encoded-path>/*.jsonl 2>/dev/null` to list session files
4. For each `.jsonl` file found, run `stat -f "%Sm" -t "%Y-%m-%d %H:%M" <file>` (macOS) to get the last modified time
5. Display the results in this format:

```
Available Claude Code sessions for <cwd>:

  <session-id>  (last modified: <timestamp>)
  ...

To resume a session, run:
  claude --resume <session-id>
```

If no session files are found, tell the user there are no saved sessions for this directory.
