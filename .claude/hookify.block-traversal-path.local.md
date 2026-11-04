---
name: block-traversal-path
enabled: true
event: file
action: block
tool_matcher: Glob|Grep
conditions:
  - field: path
    operator: contains
    pattern: ".."
---

**Path traversal rejected**

The path contains `..` which is not allowed. Use an absolute path instead.

Example: `/mnt/mtwo/programs/project/src` not `../src`
