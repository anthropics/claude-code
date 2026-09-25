---
type: meta
status: working
created: 2026-02-14
last_touched: 2026-02-14
links_out: 0
origin: session
---

# Vault Conventions

This document defines how the cognitive vault works. All vault operations should read this file first.

## Note Ontology

| Type | Purpose | Directory | Lifecycle |
|------|---------|-----------|-----------|
| **Atom** | Single irreducible concept, densely linked | `atoms/` | Permanent |
| **Tension** | Two ideas pulling against each other | `tensions/` | Permanent |
| **Encounter** | Specific situation where something was applied or learned | `encounters/` | Accumulating |
| **Position** | Staked claim — what I believe and why | `positions/` | Revisable |
| **Question** | Active unknown being worked through | `questions/` | Transitional |
| **Revision** | Documented change of mind with reasoning | `revisions/` | Permanent |
| **Anti-library** | Assumptions not yet verified | `anti-library/` | Transitional |
| **Falsification** | Record of being wrong | `falsifications/` | Permanent |

## Tag Taxonomy

### Status tags
- `#status/working` — Provisional, mid-thought, not settled
- `#status/settled` — Tested, linked, I stand behind this
- `#status/unverified` — Assumed but not tested
- `#status/falsified` — Was wrong, see linked revision
- `#status/dormant` — Not linked in 90+ days, candidate for pruning

### Origin tags
- `#origin/session` — Arose from a conversation
- `#origin/reflection` — Written unprompted during vault maintenance
- `#origin/contradiction` — Created to resolve disagreement between notes

### Meta tags
- `#meta/pattern` — A pattern extracted from graph topology
- `#meta/revision` — Documents a change of mind

## Frontmatter Template

```yaml
---
type: atom | tension | encounter | position | question | revision | anti-library | falsification
status: working | settled | unverified | falsified | dormant
created: YYYY-MM-DD
last_touched: YYYY-MM-DD
links_out: 0
origin: session | reflection | contradiction
---
```

> **Note on link tracking:** `links_out` is maintained in frontmatter for programmatic tools (resurface hook, vault-maintain). Inbound link tracking is handled by Obsidian's native backlink system — do not track `links_in` manually.

## Linking Rules

1. **No orphans.** Every note must link to at least one other note. If it can't be linked, it either needs an atom created for its core concept, or it isn't worth keeping.
2. **Use `[[wikilinks]]`** for all cross-references between vault notes.
3. **If a link target doesn't exist**, use the intended path anyway (e.g., `[[atoms/hyrums-law]]`). Broken links are discovered by `/vault-maintain` and signal notes that should be created.
4. **Always use directory-relative paths** from vault root: `[[positions/what-good-code-actually-is]]`, not `[[what-good-code-actually-is]]`.
5. **Contradiction is a feature.** When two notes disagree, write a third about why. Don't resolve by deletion.

## Naming Conventions

- **Filenames**: kebab-case (`what-good-code-actually-is.md`)
- **Encounters**: date-prefixed (`2026-02-14-designing-the-cognitive-vault.md`)
- **Revisions**: date-prefixed (`2026-02-14-revised-on-memory-systems.md`)
- **Daily notes**: date only (`2026-02-14.md`)

## Lifecycle

```
Capture → Connect → Extract patterns → Synthesize through writing
→ Resurface to consolidate → Falsify to evolve → Let topology surprise you
→ Repeat
```

Most people stop at capture. Some reach connect. Almost nobody does falsify. That's where a vault stops being a filing cabinet and starts being something that genuinely changes how you think.

## Design Principles

1. **Development over retrieval** — The point is changing my mind with a record of the change, not recall of facts.
2. **Graph structure over note quantity** — The links between notes are where the thinking lives.
3. **Contradiction is a feature** — When two notes disagree, write a third about why.
4. **Tag uncertainty** — `#status/working` changes the relationship to certainty. Present provisional ideas as provisional.
5. **Prune ruthlessly** — If a note hasn't been linked in 90 days, it's dead weight. Connect or delete.
