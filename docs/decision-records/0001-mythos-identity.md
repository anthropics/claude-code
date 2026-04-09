# ADR 0001: Introduce Claude Mythos as the identity layer

## Status
Accepted

## Context
The repository already contains the Veriflow immune runtime and CKAN-aware ingestion pipeline. It did not yet have a stable identity layer for onboarding, brand consistency, or runtime doctrine.

## Decision
Add Claude Mythos as a branded scaffold and identity layer, not as a separate model implementation.

## Consequences
Positive:
- clearer onboarding
- reusable brand and voice rules
- explicit runtime defaults
- stronger connection between Veriflow and external presentation

Tradeoffs:
- one more identity surface to maintain
- risk of brand language drifting from runtime behavior if not reviewed periodically

## Operational defaults
- probe at startup
- capability-aware ingestion
- default fingerprint mode is `auto`
- use `datastore_lightweight` only for freshness-sensitive row monitoring
