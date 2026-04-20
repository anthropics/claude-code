# Cognitive Infrastructure

This repository includes a persistent cognitive vault at `vault/`. The vault is a knowledge graph for tracking positions, questions, encounters, and changes of mind over time. It is not a memory system — it is a development system. See conventions for the full ontology and rules.

## Vault Conventions
@vault/_meta/conventions.md

## Active Positions
@vault/positions/what-good-code-actually-is.md

## Open Questions
@vault/questions/my-own-cognition.md

## Vault Health
@vault/_meta/vault-health.md

## Available Vault Skills

- `/vault-capture` — Create a new vault note from the current session (atom, tension, encounter, position, question, anti-library)
- `/vault-maintain` — Run maintenance: orphan scan, staleness check, pattern extraction, anti-library audit, falsification review
- `/vault-reflect` — Write a synthesis note reconciling multiple vault positions or tensions
- `/vault-falsify` — Record a changed belief with reasoning, update falsification log
