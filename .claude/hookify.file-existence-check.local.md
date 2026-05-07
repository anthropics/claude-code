---
name: warn-file-existence-check
enabled: true
event: bash
action: warn
conditions:
  - field: command
    operator: regex_match
    pattern: read_file|read\s+.*\.(png|jpg|jpeg|gif|webp|bmp|tiff|ico|heic|heif)
---

🔍 **Image file read detected**

Before reading image files, especially from drag-and-drop operations:
- Verify the file exists and is fully saved
- Check that the path is accessible
- If this hangs, press Ctrl+C to cancel

For macOS drag-and-drop issues, see: https://github.com/anthropics/claude-code/issues/55420
