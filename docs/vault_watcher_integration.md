# Vault Watcher Integration

This document describes how a local watcher should load encrypted signed policy packs into a controlled orchestrator.

## Runtime directories

```text
project_root/
├── vault/
├── manifests/
├── decrypted/
├── quarantine/
├── keys/
└── vault_watcher.py
```

## Environment requirements

- `PHASEFORM_PASSPHRASE` must be set before startup.
- private keys must remain local and out of version control.
- no embedded default passphrase should exist in source.

## Expected behavior

1. Detect new `.enc` files in `vault/`.
2. Wait until the file is stable.
3. Try single-file JSON pack parsing.
4. If that fails, look for matching split-pack manifest and signature files.
5. Verify Ed25519 signature before decryption.
6. Verify ciphertext and plaintext hashes when present.
7. Write valid decrypted specs to `decrypted/`.
8. Move invalid packs to `quarantine/`.
9. Hand the verified spec to the local orchestrator.

## Orchestrator handoff contract

A local handoff function should accept a decrypted agent spec and convert it into runtime state.

Example responsibilities:
- validate schema version
- validate policy surface
- enforce least-privilege permissions
- register the spec as active runtime policy
- emit an audit event

## Suggested follow-up

- add a local spec editor
- add a pack validator CLI
- add sample single-file and split-pack test fixtures
