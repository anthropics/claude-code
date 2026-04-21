# PhaseForm Encrypted Policy Packs

This guide defines the repository's preferred structure for encrypted signed agent policy packs.

## Goals

- Keep the agent blueprint confidential at rest.
- bind creator attribution into the manifest.
- make tampering detectable.
- support replayable versioning across pack revisions.
- keep execution limited to a local permissioned workspace.

## Supported pack formats

### Split pack

- `agent_spec.enc`
- `agent_manifest.json`
- `agent_manifest.sig`

### Single-file JSON pack

A `.enc` file may also contain a JSON object with:

- `manifest`
- `ciphertext_b64`
- `nonce_b64`
- `salt_b64`
- `signature_b64`

Runtime tooling should support both forms.

## Canonical manifest fields

```json
{
  "schema_version": "1.0",
  "creator": "TDD",
  "version": "0.1.0",
  "public_key_b64": "...",
  "spec_hash_sha256": "...",
  "ciphertext_hash_sha256": "...",
  "content_type": "agent_spec",
  "nonce_b64": "...",
  "salt_b64": "..."
}
```

## Security rules

1. Never embed a default passphrase in source code.
2. Require the passphrase through environment or secure prompt entry.
3. Verify Ed25519 signatures before decryption.
4. Verify both ciphertext and plaintext hashes when present.
5. Quarantine invalid or partially written packs.
6. Decrypt only into controlled local workspace state.
7. Treat standards references as requirements alignment, not certification claims.

## Repository conventions

- place incoming encrypted payloads in `vault/`
- place split-pack manifests in `manifests/`
- write validated plaintext only into `decrypted/`
- move invalid inputs into `quarantine/`
- keep private keys out of the repository

## Recommended runtime flow

1. Watch `vault/` for new `.enc` files.
2. Wait for file writes to stabilize.
3. Attempt single-file JSON pack parsing.
4. Fallback to split-pack loading when appropriate.
5. Verify signature and integrity hashes.
6. Decrypt AES-GCM payload.
7. Write decrypted JSON to `decrypted/`.
8. Hand off the verified spec to the local orchestrator.

## Non-goals

- unrestricted or universal-access automation
- hidden access paths
- bypassing approvals or least-privilege boundaries
