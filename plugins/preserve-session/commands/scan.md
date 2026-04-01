---
description: Scan a directory for unregistered projects and bulk-initialize them
allowed-tools: Bash(bash:*)
---

Scan for unregistered projects and initialize them.

## Step 1 — Get the target directory

If the user specified a directory (e.g. "scan ~/dev"), use it directly.
Otherwise ask: "Which directory should I scan for unregistered projects?"

Expand `~` to the full home path before passing to the script.

## Step 2 — Run the scan

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scan.sh" <dir>
```

Show the numbered list to the user.

If no unregistered projects are found, stop here.

## Step 3 — Ask for selection

Ask the user which projects to initialize. Accept any of:
- Numbers: "1 3 5"
- "all" or "전부" → initialize everything in the list
- Natural language: "first three", "~/dev 하위 전부" → map to the corresponding paths

## Step 4 — Initialize selected projects

Resolve the selected numbers to their full paths from the list, then run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scan.sh" --init <path1> <path2> ...
```

Show the result to the user.
