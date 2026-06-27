---
name: vault-reflect
description: Write a synthesis note reconciling multiple vault positions
argument-hint: "<domain-or-tension>"
---

<objective>
Synthesize across the cognitive vault by writing a long-form note that reconciles tensions and contradictions in a given domain. This is the forcing function that turns a collection of notes into genuine thought — the difference between having information and having understanding.

Input: a domain, tension, or topic to synthesize around.
Argument: $ARGUMENTS
</objective>

<process>

## Step 0: Read Conventions

<step name="read_conventions">
Read `vault/_meta/conventions.md`. Mandatory before any vault operation.
</step>

## Step 1: Choose Domain

<step name="choose_domain">
If `$ARGUMENTS` specifies a domain, tension, or topic, use it.

If not specified:
1. Scan `vault/tensions/` for notes — these are natural synthesis candidates
2. Scan `vault/positions/` for notes tagged `#status/working` — unsettled positions need reconciliation
3. Look at `vault/encounters/` from the last 30 days — what topics keep recurring?
4. Present the top 3 candidates and ask the user which to synthesize around
</step>

## Step 2: Gather Material

<step name="gather_material">
Read all notes linked to the chosen domain:

1. Use Grep to find all vault notes that mention the topic or link to related notes
2. Read the full content of: related atoms, encounters, positions, questions, and tensions
3. Note contradictions — places where two notes disagree or where an encounter challenges a position
4. Note gaps — related concepts that have no vault notes yet

Build a mental map of:
- What evidence exists (encounters)
- What positions are staked (positions)
- What tensions remain unresolved (tensions)
- What questions are still open (questions)
- What is assumed but untested (anti-library)
</step>

## Step 3: Write Synthesis

<step name="write_synthesis">
Create a new position note in `vault/positions/` that attempts to reconcile what the gathered material reveals.

Structure the synthesis as:
1. **The core tension or question** — what this synthesis is about
2. **Evidence from each side** — what encounters and positions support different views
3. **Where the contradictions are real** — tensions that can't be resolved, only acknowledged
4. **Where I land now** — a specific, staked claim (not a hedge or a "both sides have merit" dodge)
5. **What I still don't know** — honest gaps that remain after synthesis

Use proper frontmatter:
```yaml
---
type: position
status: working
created: {today}
last_touched: {today}
links_in: 0
links_out: {count}
origin: reflection
---
```

Tag as `#status/working` — synthesis notes are working until they've been tested against future encounters.
</step>

## Step 4: Document Remaining Unknowns

<step name="document_unknowns">
For each gap identified during synthesis:
- If a related question note exists, update it with the new context from synthesis
- If no question note exists and the unknown is significant, create one via the vault-capture protocol
- Update `last_touched` on any modified question notes
</step>

## Step 5: Back-link

<step name="backlink">
Update all source notes with `[[wikilinks]]` back to the new synthesis note:

1. For each note referenced in the synthesis, add a link back to it if one doesn't already exist
2. Update `links_in` / `links_out` counts in frontmatter where practical
3. Update `last_touched` dates on modified notes
</step>

## Step 6: Check for Falsifications

<step name="check_falsifications">
If any existing position changed during synthesis:

1. Create a revision note in `vault/revisions/` documenting what changed and why
2. Update the old position's status to `#status/falsified` and link to the revision
3. Append an entry to `vault/falsifications/things-i-was-wrong-about.md`

If no positions changed, note that the synthesis reinforced existing positions (which is also valuable data).
</step>

## Step 7: Report

<step name="report">
Present to the user:
- The synthesis note created (file path)
- What material was gathered and reconciled
- Contradictions that remain unresolved
- New questions or unknowns that emerged
- Any falsifications triggered
- Notes that were back-linked
</step>

</process>

<rules>
## Hard Rules

1. **Read conventions first.** Always.
2. **Never resolve a tension by picking one side.** Acknowledge the tension even if you lean one way. If both sides have genuine pull, say so — the vault tracks development, not victory.
3. **Stake a claim.** "Both perspectives have merit" is not a synthesis. Land somewhere specific, even if provisionally. That's what `#status/working` is for.
4. **Tag as working.** Synthesis notes are `#status/working` until tested against future encounters.
5. **Document what changed.** If a position shifted, create a revision note. The falsification log is the most valuable part of the vault over time.
6. **Update timestamps.** Every note touched during synthesis gets its `last_touched` updated.
7. **Use `#origin/reflection` tag.** Synthesis notes originate from reflection, not from a session prompt.
</rules>
