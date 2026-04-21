# Ethos Aegis × Claude Mythos

Veriflow Immune System for host-aware, verification-first reasoning over CKAN-backed and normalized data.

## Mythos distribution layer

This repository combines:
- Ethos Aegis as the defensive systems framework
- Claude Mythos as the identity and operating contract layer
- Veriflow as the formula-and-answer engine
- CKAN-aware ingestion, probing, and caching

### Runtime defaults
- probe capabilities on startup
- cache host capability matrices
- select ingestion path automatically per CKAN host
- use `fingerprint_mode="auto"` for most hosts
- use `datastore_lightweight` only when row freshness matters more than probe cost

### Quick links
- [Claude Mythos operating contract](../CLAUDE_MYTHOS.md)
- [Brand kit](../brand/claude-mythos-brand-kit.md)
- [GitHub partner branding kit](../brand/github-partner-branding-kit.md)
- [Interactive control panel](../interactive/mythos_control_panel.html)
- [Startup example](../examples/mythos_startup.py)

**Principle:** Trust the verified path.
