# /etudes — Sprint Coach

Load the `etudes` skill and follow its instructions.

Check if `.etudes/` directory exists at the project root.

**If `.etudes/` does NOT exist:** This is a new user. Run the full intake flow from Phase 1 of the skill. Create the `.etudes/` directory and all state files during the process.

**If `.etudes/` exists:** Read `.etudes/profile.md` and `.etudes/sprint-current.md`. Determine where the user is in their sprint and show status:

- How many days into the sprint
- Which tasks are done vs remaining today
- Any parking lot items captured

Then ask: "What's the status? Ready for today's check-in, or do you need something else?"

$ARGUMENTS — If the user passes arguments (e.g., `/etudes I finished the header task`), treat it as a check-in update and process accordingly.
