# /etudes-checkin — Daily Check-In

Load the `etudes` skill and follow its active coaching instructions.

1. Read `.etudes/profile.md` for the user's coaching mode and tone
2. Read `.etudes/sprint-current.md` for the current sprint state
3. Determine current sprint day based on dates
4. Check `git log --since="yesterday"` for recent commits (evidence of work)

Ask: "What's done? What's left on Day [X]?"

Process the response per the Active Coaching section of the skill:
- Mark completed tasks with `[x]` in `.etudes/sprint-current.md`
- If new ideas come up, redirect to `/etudes-park`
- If re-planning detected, name the pattern and redirect
- If user is stuck, zoom to the single smallest task

$ARGUMENTS — If the user passes arguments (e.g., `/etudes-checkin finished tasks 1 and 2, stuck on 3`), process directly without asking.
