# /etudes-dashboard — Cross-Project Status

Load the `etudes` skill and provide a unified view across all projects using Etudes.

1. Read `~/.etudes/projects.json` for the list of registered projects
2. For each project in the list:
   a. Check if the path still exists and has a `.etudes/` directory
   b. Read `.etudes/sprint-current.md` — count `[x]` (done) vs `[ ]` (remaining) tasks
   c. Read `.etudes/profile.md` — get project name, pattern, sprint cadence
   d. Read `.etudes/parking-lot.md` — count parked ideas
   e. Determine current sprint day from sprint file dates
3. If a registered project's path no longer exists, note it as "missing" but don't remove it

Display a unified dashboard:

```
Etudes Dashboard — [N] active projects

[project-name]/     Sprint N: [Name]     Day X/5    [progress bar] done/total tasks
  Next: "[next unchecked task]" (Xmin)

[project-name]/     Sprint N: [Name]     Day X/5    [progress bar] done/total tasks
  Next: "[next unchecked task]" (Xmin)

[project-name]/     No active sprint
  Last retro: [date] | Profile: [pattern]

Parking Lot (all projects): [N] ideas parked
  - [idea] (from [project], Day X)
  - [idea] (from [project], Day X)
```

After displaying, ask: "Want to check in on a specific project, or start a sprint for one that doesn't have one?"

$ARGUMENTS — If the user passes a project name (e.g., `/etudes-dashboard liminal`), show only that project's detailed status including full task list, parking lot, and profile.
