---
name: prevent-drag-drop-image-hang
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: read_file|read\s+.*\.(png|jpg|jpeg|gif|webp|bmp|tiff|ico|heic|heif)
  - field: command
    operator: contains
    pattern: /var/folders|/tmp/|/private/var/folders
---

🖼️ **Drag-and-drop image detected from macOS temporary location**

This appears to be a drag-and-drop image from macOS that may cause Claude Code to hang. The file path suggests this is a temporary thumbnail that macOS creates before fully saving the file.

**To fix this issue:**
1. Wait for the image to fully save to your Desktop or Downloads folder
2. Then drag the saved file instead of the floating thumbnail
3. Or use the file path directly after the file is completely saved

**Alternative solutions:**
- Take a screenshot that saves directly to Desktop (Cmd+Shift+3)
- Use iTerm2 instead of Terminal.app if available
- Copy the image to clipboard and paste with Cmd+V

Operation blocked to prevent session freeze.
