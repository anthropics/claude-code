---
name: require-absolute-path
enabled: true
event: file
action: block
tool_matcher: Glob|Grep
conditions:
  - field: path
    operator: regex_match
    pattern: ^[^/]
---

**Relative path rejected**

All path values must be absolute (start with `/`).

Use the full path like `/mnt/mtwo/programs/project/src`
