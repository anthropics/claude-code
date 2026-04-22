# Merge Automation and Branding

This guide ties together the local history-preserving merge workflow and the Celestial Agent branding layer for the Ethos monorepo.

## What this branch adds

- `scripts/push-merge-runbook.sh`
- `docs/branding/celestial_agent_brand_kit.md`
- `assets/branding/celestial_agent/celestial_agent_logo_horizontal.svg`
- `assets/branding/celestial_agent/celestial_agent_mark_full.svg`

## Intended use

1. Run the merge helper locally from the destination repository.
2. Open the history-preserving merge PR into Ethos Aegis.
3. Preserve Veriflow as a named reasoning surface inside the merged repository.
4. Use the Celestial Agent brand assets as the trust-layer identity for encrypted policy packs, signed manifests, and local-first orchestration surfaces.

## Branding model after merge

- **Ethos Aegis** = system architecture and monorepo umbrella
- **Veriflow** = host-aware reasoning and CKAN intelligence layer
- **Claude Mythos** = runtime and prompt/scaffold identity
- **Celestial Agent** = encrypted policy-pack and trust-layer visual identity

## Why this split works

It lets the repository preserve technical clarity while still giving the secure runtime surfaces a premium, user-facing brand system.

## Limits

The GitHub connector can prepare scripts, docs, and assets, but the actual unrelated-history merge still has to be executed through git on a machine with repository access.
