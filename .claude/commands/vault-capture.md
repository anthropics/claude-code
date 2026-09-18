---
name: vault-capture
description: Capture an idea from the current session as a vault note
argument-hint: "[type] [title]"
---

<objective>
Create a new note in the cognitive vault from the current session context. The vault is a persistent knowledge graph at `vault/` — not a memory system, a development system.

Input: optional note type and title.
Argument: $ARGUMENTS
</objective>

<process>

## Step 1: Read Conventions

<step name="read_conventions">
Read `vault/_meta/conventions.md` to ensure format compliance. This is not optional — do it every time.
</step>

## Step 2: Determine Note Type

<step name="determine_type">
If `$ARGUMENTS` specifies a type, use it. Valid types:

- **atom** — Single irreducible concept. Goes in `vault/atoms/`.
- **tension** — Two ideas pulling against each other. Goes in `vault/tensions/`.
- **encounter** — Specific situation where something was applied or learned. Goes in `vault/encounters/`.
- **position** — Staked claim — what I believe and why. Goes in `vault/positions/`.
- **question** — Active unknown being worked through. Goes in `vault/questions/`.
- **anti-library** — Assumption not yet verified. Goes in `vault/anti-library/`.

If not specified, ask the user which type fits. Revisions and falsifications have their own skills (`/vault-falsify`).
</step>

## Step 3: Determine Title

<step name="determine_title">
If `$ARGUMENTS` specifies a title, use it. Otherwise, ask the user for the core idea in one sentence, then derive a kebab-case filename.

- Encounters and revisions get date-prefixed filenames: `YYYY-MM-DD-description.md`
- All other types: `description.md`
</step>

## Step 4: Generate Frontmatter

<step name="generate_frontmatter">
Create YAML frontmatter:

```yaml
---
type: {type}
status: working
created: {today's date YYYY-MM-DD}
last_touched: {today's date YYYY-MM-DD}
links_out: 0
origin: session
---
```

Always tag as `#status/working` unless the user explicitly says the idea is settled.
</step>

## Step 5: Write Body

<step name="write_body">
Write type-appropriate content:

- **Atom**: Definition, key properties, relationship to other concepts. Dense and precise.
- **Tension**: Name both poles. Explain why they pull against each other. State current stance if any.
- **Encounter**: Date, context, what happened, what it connected to, what changed or surprised.
- **Position**: The claim stated clearly. Supporting evidence from encounters. Known weaknesses. What would change your mind.
- **Question**: What you don't know. Why it matters. Current hypotheses. Related notes.
- **Anti-library**: The assumption. Why it hasn't been tested. How you would test it.

Write substantively. A position note that says "good code is readable" is worthless. A position note that stakes a specific, falsifiable claim with reasoning is the entire point.
</step>

## Step 6: Link to Existing Notes

<step name="link_existing">
Scan `vault/` for related notes:

1. Use Glob to list all `vault/**/*.md` files
2. Use Grep to search for keywords from the new note's topic across existing notes
3. Add `[[wikilinks]]` in the body to related notes
4. If a concept needs a note that doesn't exist yet, link to the intended path anyway (e.g., `[[atoms/concept-name]]`). Broken links are discovered by `/vault-maintain`.
5. Update the `links_out` count in frontmatter to match the actual number of `[[wikilinks]]` in the note

Every note must link to at least one other note. If it can't be linked to anything, either create an atom for its core concept or reconsider whether the note is worth keeping.
</step>

## Step 7: Save and Confirm

<step name="save">
Write the file to `vault/{type-directory}/{filename}.md`.

Display:
- The file path created
- The links added (both existing and TODO)
- A reminder: "Use `/vault-maintain` periodically to connect orphans and review staleness."
</step>

</process>

<rules>
## Hard Rules

1. **Read conventions first.** Always read `vault/_meta/conventions.md` before creating a note.
2. **No orphans.** Every note must link to at least one other note.
3. **Tag uncertainty.** New notes are `#status/working` unless the user says otherwise.
4. **Date-prefix encounters and revisions.** Format: `YYYY-MM-DD-description.md`.
5. **Use `[[wikilinks]]` for cross-references.** Not markdown links, not bare text.
6. **Write substantively.** A note that restates conventional wisdom without a specific claim is not worth creating.
7. **Don't create revisions or falsifications here.** Use `/vault-falsify` for those — they have a specific protocol.
</rules>
