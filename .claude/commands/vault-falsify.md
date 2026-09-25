---
name: vault-falsify
description: Record a changed belief with reasoning
argument-hint: "<old-belief-note>"
---

<objective>
Explicitly record being wrong about something. Create a revision note documenting the old belief, the new belief, and what caused the change. Then update the falsification log.

This is not punishment — it's the most valuable operation in the vault. Over time, the falsification log reveals *how* you're wrong, not just *that* you're wrong. Consistent error patterns are more valuable than any individual correction.

Input: optional path to the old belief note.
Argument: $ARGUMENTS
</objective>

<process>

## Step 0: Read Conventions

<step name="read_conventions">
Read `vault/_meta/conventions.md`. Mandatory before any vault operation.
</step>

## Step 1: Identify Old Belief

<step name="identify_old_belief">
If `$ARGUMENTS` points to an existing vault note, read it. This is the belief that changed.

If not specified:
1. Ask the user what belief changed
2. Search vault positions and anti-library notes for the relevant note
3. If no existing note captures the old belief, document it inline in the revision note
</step>

## Step 2: Articulate New Belief

<step name="articulate_new_belief">
Ask the user (or determine from context):
1. What do you believe now instead?
2. What caused the change? (encounter, evidence, argument, contradiction)
3. Is the new belief itself settled or still working?

If a vault note already captures the new belief, link to it. If not, determine whether the new belief warrants its own position note.
</step>

## Step 3: Create Revision Note

<step name="create_revision">
Create a new note at `vault/revisions/YYYY-MM-DD-revised-on-{topic}.md`:

```yaml
---
type: revision
status: settled
created: {today}
last_touched: {today}
links_in: 0
links_out: {count}
origin: session
---
```

Body structure:
1. **What I believed before** — state the old belief clearly, link to old note if it exists
2. **What I believe now** — state the new belief clearly, link to new note if it exists
3. **What caused the change** — the encounter, evidence, or argument that triggered revision
4. **Why the old belief was wrong** — not just "I was wrong" but the reasoning error or missing evidence
5. **Error type** — categorize: premature certainty, missing evidence, wrong abstraction level, overgeneralization, anchoring bias, etc.

Tag as `#status/settled` and `#meta/revision`. Revision notes document history — they don't change.
</step>

## Step 4: Update Old Note

<step name="update_old_note">
If the old belief has an existing vault note:

1. Change its frontmatter `status` to `falsified`
2. Add a note at the top of the body: "**Falsified** — see [[revisions/YYYY-MM-DD-revised-on-{topic}]]"
3. Do NOT delete the old note. The history of what was believed is as valuable as what is believed now.
4. Update `last_touched` to today
</step>

## Step 5: Update Falsification Log

<step name="update_log">
Append an entry to `vault/falsifications/things-i-was-wrong-about.md`:

```markdown
### YYYY-MM-DD — {topic}

**Old belief:** {one sentence}
**New belief:** {one sentence}
**What caused the change:** {one sentence with link to encounter/evidence}
**Revision note:** [[revisions/YYYY-MM-DD-revised-on-{topic}]]
**Error type:** {category}
```

This log is append-only. Never edit or remove previous entries.
</step>

## Step 6: Meta-Pattern Check

<step name="meta_pattern_check">
Read the full falsification log. If 3+ entries exist:

1. Look for recurring error types — am I consistently making the same kind of mistake?
2. Look for domain clustering — are errors concentrated in a specific area?
3. Look for timing patterns — do errors happen more at the start of exploration or later?

If a meta-pattern is found:
- Note it in the `## Meta-Patterns` section of the falsification log
- Consider creating an atom note for the pattern (e.g., `atoms/my-anchoring-bias.md`)

If no meta-pattern yet, that's fine — patterns emerge from volume.
</step>

## Step 7: Report

<step name="report">
Present to the user:
- The revision note created (file path)
- What changed: old belief → new belief
- Error type identified
- Whether the old note was updated
- Whether any meta-patterns were detected
- Current falsification count
</step>

</process>

<rules>
## Hard Rules

1. **Read conventions first.** Always.
2. **Never delete old positions.** Mark them `#status/falsified` and link to the revision. The history is the point.
3. **The revision note must contain actual reasoning.** "I was wrong" is not a falsification — it's a confession. Document *why* the old belief was wrong and *what evidence* changed it.
4. **Categorize the error type.** Without categorization, meta-pattern extraction is impossible.
5. **The falsification log is append-only.** Never edit or remove previous entries.
6. **Date-prefix revision notes.** Format: `YYYY-MM-DD-revised-on-{topic}.md`.
7. **Update timestamps.** Every note modified gets its `last_touched` updated.
8. **This is the most valuable vault operation.** Treat it with the seriousness it deserves. A vault with zero falsifications is a vault that isn't being used honestly.
</rules>
