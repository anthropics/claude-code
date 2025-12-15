#!/usr/bin/env bash

# Auto-show plan content after updates in plan mode
# This hook adds instructions to automatically display the plan when updated

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "## Plan Mode Auto-Display\n\nWhen you are in plan mode and you update the plan file:\n\n1. After writing or editing the plan file, ALWAYS display the full plan content in a markdown code block in your response\n2. Use the format:\n   ```markdown\n   ## Current Plan\n   [full plan content here]\n   ```\n3. This ensures the user can see the plan without needing to run `/plan`, which is especially important when you're asking follow-up questions\n4. Show the plan BEFORE asking any clarifying questions, so the user has context for their answers\n\nThis improves the user experience by making the plan visible immediately after updates, without requiring separate commands."
  }
}
EOF

exit 0
