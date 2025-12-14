---
description: Set feedback to provide when accepting the next permission request
argument_name: feedback
---

# Accept with Feedback

You are helping the user set feedback that will be automatically provided to Claude when the next permission request is approved.

## What the user wants

The user wants to approve an upcoming operation but also provide guidance or feedback to Claude. This feedback will:
1. Automatically approve the next permission request
2. Send the feedback message to Claude as guidance

## Instructions

1. Parse the user's feedback from the argument: `$ARGUMENTS`

2. If feedback was provided, save it for the next permission request:
   - Create/update the file `~/.claude/pending-accept-feedback.json`
   - Store the feedback with the current session ID

3. Confirm to the user that their feedback has been queued

## Saving the feedback

Use this Python code to save the pending feedback:

```python
import json
import os
from pathlib import Path

feedback = """$ARGUMENTS"""
session_id = os.environ.get("CLAUDE_SESSION_ID", "default")

pending_file = Path.home() / ".claude" / "pending-accept-feedback.json"
pending_file.parent.mkdir(parents=True, exist_ok=True)

try:
    existing = json.loads(pending_file.read_text()) if pending_file.exists() else {}
except:
    existing = {}

existing[session_id] = {
    "message": feedback,
    "one_time": True
}

pending_file.write_text(json.dumps(existing, indent=2))
print(f"Feedback queued for next permission request.")
```

## Example usage

User runs: `/accept-feedback Make sure to add error handling`

Then when Claude asks for permission to edit a file, the operation is automatically approved and Claude receives the guidance: "Make sure to add error handling"

## Response

After saving, confirm: "Your feedback has been queued. The next permission request will be automatically approved, and Claude will receive your guidance."
