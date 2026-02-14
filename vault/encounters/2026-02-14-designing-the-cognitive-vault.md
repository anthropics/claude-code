---
type: encounter
status: working
created: 2026-02-14
last_touched: 2026-02-14
links_out: 4
origin: session
---

# Designing the Cognitive Vault

#status/working #origin/session

## What Happened

Built a persistent cognitive vault across multiple sessions. The goal: give Claude Code a development system — not memory, not retrieval, but a substrate for accumulating positions, recording when they're wrong, and building on prior thinking rather than re-deriving it each session.

### Implementation arc

1. **Scaffold** — Created vault directory structure, seed notes ([[positions/what-good-code-actually-is]], [[questions/my-own-cognition]], [[falsifications/things-i-was-wrong-about]]), and the conventions document ([[_meta/conventions]]).
2. **Skills** — Built `/vault-capture`, `/vault-maintain`, `/vault-reflect`, `/vault-falsify` as Claude Code slash commands. Each follows the conventions document as source of truth.
3. **SessionStart hook** — Python script that surfaces working notes at session start. No external dependencies. Scores notes by status, link density, and staleness.
4. **Adversarial review** — Ran the vault against its own design principles. Found 5 real issues: stale metadata (`links_in`/`links_out` counts already wrong), over-built infrastructure (vault-custodian agent deleted), and empty directories without purpose.
5. **Obsidian compatibility** — User wants to view the vault in Obsidian. Discovered that `links_in` was redundant with Obsidian's native backlink tracking. Moved scripts outside the vault to keep the Obsidian file explorer clean. Kept `links_out` in frontmatter as a complement — it serves the programmatic consumer (resurface hook) while Obsidian serves the visual consumer.

## What I Learned

**Manual metadata drifts immediately.** The `links_in` and `links_out` counts were wrong by the second commit. This is a specific instance of a general pattern: any data that can be derived from source content should be derived, not manually tracked. Frontmatter that duplicates what the file content already says is a liability.

**The complementary approach works.** Rather than choosing between frontmatter and Obsidian's primitives, the right split is: frontmatter for portable/programmatic data (type, status, origin, links_out), Obsidian for visual/graph data (backlinks, graph topology). Two consumers, two systems, no overlap.

**Over-building was the first thing deleted.** The vault-custodian agent — an automated background process — was removed in adversarial review. The minimum viable vault is notes, links, and skills. Everything else is premature until the vault has enough content to justify automation.

**The "minimum viable vault" principle validated itself.** Starting with 3 notes and 4 skills produced a working system. Starting with 10 notes and 8 agents would have produced a filing cabinet with pretensions — exactly what [[questions/my-own-cognition]] warns against.

## What Changed

- `links_in` removed from all frontmatter (Obsidian is the source of truth for inbound links)
- `links_out` kept (serves programmatic tools, portable outside Obsidian)
- `resurface.py` now counts actual `[[` occurrences instead of reading frontmatter — always accurate, zero maintenance
- Scripts moved from `vault/scripts/` to repo-level `scripts/` — vault directory is now pure content

## Open Questions

- Does the SessionStart hook actually change session quality? This is the pragmatic test from [[questions/my-own-cognition]]. The answer will be in future encounter notes.
- At what point does the vault have enough content to justify a SessionEnd auto-capture hook? Current hypothesis: after 5+ encounter notes.

## Links

- [[positions/what-good-code-actually-is]] — First position staked in the vault
- [[questions/my-own-cognition]] — The meta-question this vault is testing
- [[falsifications/things-i-was-wrong-about]] — Where revisions will accumulate
- [[_meta/conventions]] — The rules this encounter followed
