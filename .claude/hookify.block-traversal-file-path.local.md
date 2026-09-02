---
name: block-traversal-file-path
enabled: true
event: file
action: block
tool_matcher: Read|Write|Edit|MultiEdit
conditions:
  - field: file_path
    operator: contains
    pattern: ".."
---

**Path traversal rejected**

The file_path contains `..` which is not allowed. Use an absolute path instead.

Example: `/mnt/mtwo/programs/claude-code/src/file.ts` not `../src/file.ts`
