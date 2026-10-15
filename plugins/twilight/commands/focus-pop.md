---
description: Pop the top focus-stack entry (gated on plan checkboxes; --force overrides)
argument-hint: [--force]
allowed-tools: Bash
---

Pop the top of the focus stack, gated on evidence in the plan:

1. Read the top entry: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" show | head -1` (strip the trailing date).
2. Run the gate: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" gate <entry>` —
   or `gate --force <entry>` if and only if the user passed `--force`.
3. If the gate fails, REFUSE the pop and show the unmet plan items it printed. A
   model belief that the work is done is not evidence; the plan checkboxes are.
4. If the gate passes: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" pop`,
   then show the new stack state and name what work now resumes.
