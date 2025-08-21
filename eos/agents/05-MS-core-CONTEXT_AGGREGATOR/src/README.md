# 05-MS-core-CONTEXT_AGGREGATOR (CONTEXT)

Role: Server
Port: 3517
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Curates/serves project memory and summaries.

Compose wiring (reference)
- Service: 05-MS-core-CONTEXT_AGGREGATOR
- Ports: 3517:3517
- Volumes:
  - ../agents/05-MS-core-CONTEXT_AGGREGATOR/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-context_aggregator-state:/app/data
