---
name: require-absolute-notebook-path
enabled: true
event: file
action: block
tool_matcher: NotebookEdit
conditions:
  - field: notebook_path
    operator: regex_match
    pattern: ^[^/]
---

**Relative path rejected**

All notebook_path values must be absolute (start with `/`).

Use the full path like `/mnt/mtwo/programs/project/notebook.ipynb`
