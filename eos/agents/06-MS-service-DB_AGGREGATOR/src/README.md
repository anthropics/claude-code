# 06-MS-service-DB_AGGREGATOR (DB_AGGREGATOR)

Role: Server
Port: 3516
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Durable central store for deltas/events/context.

Compose wiring (reference)
- Service: 06-MS-service-DB_AGGREGATOR
- Ports: 3516:3516
- Volumes:
  - ../agents/06-MS-service-DB_AGGREGATOR/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-db_aggregator-state:/app/data
