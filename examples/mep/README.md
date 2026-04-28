# MEP — Meat Puppet Elimination Protocol

A self-enforcing asynchronous state relay for AI sessions across machines.

**The problem:** Claude Code sessions are stateless. When you switch machines, you re-explain everything. Every switch costs 5–15 minutes of context reconstruction. You become the message bus.

**MEP eliminates that.** Three files, zero new infrastructure, works with Git you already have.

---

## How It Works

MEP has four components:

1. **`CLAUDE.md`** — Loaded automatically at session start. Contains the session protocol. The agent reads its own instructions and enforces the protocol on itself. No external daemon, no server, no runtime.

2. **`handoff.md`** — A structured shift-change document. Not conversation history. The baton. Three fields: what happened, what's pending, what to watch out for. Newest entry on top.

3. **Git** — The transport layer. Encrypted in transit, versioned, conflict-resolution built in. `git pull` on start, `git push` on end.

4. **Self-enforcement** — The agent reads, follows, and executes the protocol. Your only job: open a session and start talking.

---

## Quick Start

```bash
# 1. Copy CLAUDE.md to your repo root
cp examples/mep/CLAUDE.md /path/to/your-repo/

# 2. Copy handoff.md to your repo
cp examples/mep/handoff.md /path/to/your-repo/handoff.md

# 3. Edit CLAUDE.md — replace the placeholder section with your project identity

# 4. Commit and push
git add CLAUDE.md handoff.md && git commit -m "MEP: initialize" && git push

# 5. Start a Claude Code session — protocol is active
claude
```

---

## Session Flow

**On start:** Claude pulls the repo, reads `handoff.md`, reports what's pending in 2–3 lines.

**On end:** Say `/eol` (or "done", "wrap up", "heading out"). Claude writes the handoff entry, commits, and pushes. "End of Line."

**If there's a conflict:** Claude re-reads both versions, identifies which entry is newer by date, resolves the merge, and pushes. No human needed — the file's structure (newest-first, named sections) provides enough information for autonomous resolution.

---

## Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Drop-in session protocol — copy to your repo root |
| `handoff.md` | Blank baton template |

---

## Why Git

We tested five alternatives during MEP's development:

| Transport | Problem |
|-----------|---------|
| Local SAN files | Machine-local only |
| Google Docs | No version history, merge conflicts unresolvable |
| iCloud | No structured diff, unpredictable sync |
| OneDrive | Same as iCloud |
| SMB/UMB file shares | Non-deterministic file locking — no workaround |

Git won because **structure enables autonomous reasoning.** When a merge conflict occurs, the agent can reason about the correct resolution from the file's structure without human instruction. Unstructured transports can't be autonomously merged.

GitHub as transport also gives you encryption at rest, 2FA, access control, and a full audit log — all built in, zero management overhead.

---

## Production Proof

**April 3, 2026:** PR #12 in the MEP reference implementation had a merge conflict in `handoff.md`. Main branch was 15 commits ahead. The initial EOL sequence failed.

Without human intervention, the Claude session re-read the file, identified the newest-first rule from existing entries, diagnosed the positioning error, wrote the correct resolution, rebased onto main, and force-pushed. The session completed autonomously.

This is the protocol's intended depth: not just carrying context between sessions, but autonomously handling the operational fallout when branches diverge.

---

## Full Specification

The complete MEP specification, formal handoff schema (BNF), NUKA-LOG authorship template, and Claude Code skill (`/mep start|end|status`) are at:

**[github.com/NukaSoft/mep-protocol](https://github.com/NukaSoft/mep-protocol)**

Licensed AGPL-3.0.

---

*Designed by Pierre Hulsebus & Skippy the Magnificent, NukaSoft.AI*
