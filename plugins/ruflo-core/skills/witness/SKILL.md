---
name: witness
description: Sign, verify, and track fix-marker regressions over time using a deterministic Ed25519 witness manifest. Works in any project — clone the toolkit, run init, register fixes, regen on each release.
argument-hint: "init|regen|verify|history [...]"
allowed-tools: Bash(node *), Read, Write, Edit
---

# Witness — cryptographic fix-regression tracking

The witness toolkit lets you ship every release with a *signed* manifest
that lists every documented fix in your codebase along with a sha256 +
marker substring. Anyone with the same git commit can re-derive the
public key and verify the signature without a committed private key.

A temporal history (JSONL) tracks how the fix population evolves across
releases — so when a regression appears, you can pinpoint *the commit
that introduced it*, not just "it's broken now."

This skill works two ways:
1. **Inside ruflo** — used by ruflo's own CI to gate publishes (see
   `.github/workflows/v3-ci.yml` job `witness-verify`).
2. **In your own project** — copy `plugins/ruflo-core/scripts/witness/`
   into your repo, run `init.mjs`, register your fixes in
   `witness-fixes.json`, and call `regen.mjs` from your release pipeline.

## Quick start (any project)

```bash
# One-time bootstrap — creates verification.md.json,
# verification-history.jsonl, and witness-fixes.json template
node plugins/ruflo-core/scripts/witness/init.mjs --root .

# Edit witness-fixes.json: add { id, desc, file, marker } per fix.
# A "marker" is a distinctive substring that MUST appear in `file`
# while the fix is present. If someone reverts the fix, the marker
# disappears and `verify` reports it as `regressed`.

# Regenerate the manifest (signs with Ed25519 from current gitCommit)
npm i @noble/ed25519
node plugins/ruflo-core/scripts/witness/regen.mjs \
  --manifest verification.md.json \
  --history verification-history.jsonl \
  --fixes witness-fixes.json

# Verify markers are present in the live tree
node plugins/ruflo-core/scripts/witness/verify.mjs \
  --manifest verification.md.json
```

## Temporal queries (ADR-103)

```bash
# Latest snapshot vs. previous
node plugins/ruflo-core/scripts/witness/history.mjs \
  --history verification-history.jsonl summary

# For each currently-regressed fix, find the commit that introduced it
node plugins/ruflo-core/scripts/witness/history.mjs \
  --history verification-history.jsonl regressions

# Status timeline for a specific fix
node plugins/ruflo-core/scripts/witness/history.mjs \
  --history verification-history.jsonl timeline --id F1

# Machine-readable for CI
node plugins/ruflo-core/scripts/witness/history.mjs \
  --history verification-history.jsonl summary --json
```

`summary` exits non-zero if any fix newly regressed since the last
snapshot — drop it in CI as a soft pre-merge gate.

## Anti-patterns

- **Hand-editing `verification.md.json`** — always regenerate via `regen.mjs`,
  otherwise the signature breaks.
- **Markers that are too generic** (`'function'`, `'import'`) — pick something
  unique enough that `grep` doesn't false-positive against unrelated code.
- **Skipping the history append** — without `--history`, you lose the
  ability to bisect when a regression was introduced.
- **Committing one without the other** — `verification.md.json` and
  `verification-history.jsonl` belong in the same commit; the JSONL is
  what lets future you verify the signed manifest is the latest in the line.

## Files

- `scripts/witness/lib.mjs` — shared regenerate / history logic.
- `scripts/witness/regen.mjs` — CLI: sign + append history.
- `scripts/witness/history.mjs` — CLI: query the temporal log.
- `scripts/witness/init.mjs` — CLI: bootstrap into a fresh project.
- `scripts/witness/verify.mjs` — CLI: validate signature + markers.

## In ruflo's CI

`v3-ci.yml` job `witness-verify` runs after the behavioral smoke tests
and before `publish`. Failure modes:

| Failure | Cause |
|---|---|
| `signatureValid: no` | manifest hand-edited; re-run regen |
| `regressed: > 0` | a documented fix lost its marker since issuance |
| `missing: > 0` | a cited dist file no longer exists; rebuild or remove the entry |
