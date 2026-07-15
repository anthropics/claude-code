# /etudes-pause — Explicit Context Capture

Load the `etudes` skill. This is OPTIONAL — auto-timestamping handles the common case. This command is for when the user explicitly wants to capture context before stepping away.

1. Read `.etudes/sprint-current.md` to determine current day and active task
2. Ask: "Before you go — what were you working on, and where did you leave off?"
3. Write to `.etudes/last-seen.json`:
   ```json
   {
     "timestamp": "[current ISO timestamp]",
     "command": "/etudes-pause",
     "day": [current day number],
     "activeTask": "[task they were working on]",
     "context": "[what they said about where they left off]",
     "mood": "[inferred from their message]",
     "explicit_pause": true
   }
   ```
4. Respond: "Noted. Pick up anytime with `/etudes-checkin`. The sprint will be here."

If no arguments provided, ask what they were working on. If $ARGUMENTS provided (e.g., `/etudes-pause was debugging the auth flow`), capture directly without asking.
