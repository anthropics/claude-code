# Merge Integration Guide

This document records the intended merge path for bringing `veriflow-Sovereign-Lattice` into `Ethos-Aegis-Agentic-Immune-Veriflow` while preserving commit history.

## Purpose

- consolidate related project surfaces into one repository
- preserve repository history instead of copying files manually
- simplify contributor onboarding and shared CI
- keep Ethos Aegis, Veriflow, and Mythos work discoverable in one place

## Merge model

The destination repository is:
- `GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow`

The source repository is:
- `GoodshytGroup/veriflow-Sovereign-Lattice`

The histories are unrelated, so the integration should be performed as a history-preserving merge rather than a file copy.

## Expected outcome

After the merge, the destination repository should contain:
- the existing Ethos Aegis runtime surface
- the Veriflow reasoning surface
- the prompt, schema, and policy-pack assets needed for agentic development

## Integration notes

- resolve root-level collisions intentionally
- preserve docs that explain where each surface originated
- prefer explicit directories for imported project surfaces when conflicts appear
- reconcile CI in stages instead of forcing every legacy surface green at once
- keep project-native documentation ahead of generic fork content

## History note

Because unrelated histories are being joined, history navigation across the merge boundary will need the merge commit as an anchor for later inspection.

## Recommended follow-up after merge

- repair the repo landing page
- reconcile overlapping workflows
- keep plugin cleanup separate from runtime repair work
- document the merged architecture in one project-native overview
