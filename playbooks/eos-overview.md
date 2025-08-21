# EOS Overview (Quick)

- Runtime via eos/compose/core.podman.yml (Podman, rootless).
- Core agents: SESSION_LOG, CONFIGURATION, AUTH_SERVICE, CONTEXT_AGGREGATOR, DB_AGGREGATOR.
- Ports 3510–3517 reserved for EOS core.
- Each agent persists to its own Podman named volume (private SQLite).
- Agents stream deltas to DB_AGGREGATOR; later we export read-only snapshots to memory/snapshots/.

- Local state file per agent: `/app/data/state.db` (mounted via a Podman named volume).
