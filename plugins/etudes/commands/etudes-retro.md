# /etudes-retro — Sprint Retrospective

Load the `etudes` skill and follow its retro instructions.

1. Read `.etudes/profile.md` for context
2. Read `.etudes/sprint-current.md` — count completed `[x]` vs incomplete `[ ]` tasks
3. Read `.etudes/parking-lot.md` — gather all captured ideas
4. Run `git log` for the sprint period to see actual commits and code changes
5. Create `.etudes/retros/` directory if it doesn't exist

Walk through the retro:
- What shipped? (cross-reference sprint tasks with git commits)
- What was skipped or avoided? Why?
- What patterns showed up during the sprint?
- Parking lot review: which ideas still matter vs distractions?
- What should change in the next sprint?

Write the retro to `.etudes/retros/sprint-[N].md`.

If the user wants another sprint, generate Sprint [N+1] with adjustments based on the retro. Update `.etudes/sprint-current.md` with the new sprint. Clear `.etudes/parking-lot.md` for the new sprint.
