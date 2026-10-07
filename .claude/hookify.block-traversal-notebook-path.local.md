---
name: block-traversal-notebook-path
enabled: true
event: file
action: block
tool_matcher: NotebookEdit
conditions:
  - field: notebook_path
    operator: contains
    pattern: ".."
---

**Path traversal rejected**

The notebook_path contains `..` which is not allowed. Use an absolute path instead.

Example: `/mnt/mtwo/programs/project/notebook.ipynb` not `../notebook.ipynb`
