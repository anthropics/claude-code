# Claude Mythos × Veriflow Scaffold Guide

## Goal
This scaffold layers a Mythos identity onto the existing Veriflow immune system so the repository has a consistent operational contract, brand vocabulary, and onboarding surface.

## Stack
- Ethos Aegis core
- Veriflow immune system
- CKAN capability probing
- capability-aware ingestion
- deterministic validation
- formula selection and answer generation

## Recommended startup defaults
- `probe_on_startup=True`
- `fingerprint_mode="auto"`
- use `datastore_lightweight` only when row-level freshness matters more than probe cost

## Expected output shape
```json
{
  "host_profile": "schema-rich+datastore",
  "ckan_version": "2.11.x",
  "ingestion_path": "datastore",
  "formula": "ctr = clicks / impressions",
  "limitations": ["sampled row signature used"]
}
```

## Brand position
Claude Mythos is not a separate model implementation here. It is a branded scaffold and operating identity wrapped around the current Veriflow immune runtime.

## Suggested next repo additions
- examples/mythos_startup.py
- assets/brand/wordmark.svg
- docs/decision-records/0001-mythos-identity.md
- tests/test_mythos_brand_contract.py
