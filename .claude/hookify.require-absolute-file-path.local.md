---
name: require-absolute-file-path
enabled: true
event: file
action: block
tool_matcher: Read|Write|Edit|MultiEdit
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^[^/]
---

**Relative path rejected**

All file_path values must be absolute (start with `/`).

Use the full path like `/mnt/mtwo/programs/project/file.txt`
