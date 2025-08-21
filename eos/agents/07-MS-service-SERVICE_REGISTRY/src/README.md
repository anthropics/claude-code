# 07-MS-service-SERVICE_REGISTRY (REGISTRY)

Role: Server
Port: 3515
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Tracks agent heartbeats & capabilities (service discovery).

Compose wiring (reference)
- Service: 07-MS-service-SERVICE_REGISTRY
- Ports: 3515:3515
- Volumes:
  - ../agents/07-MS-service-SERVICE_REGISTRY/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-service_registry-state:/app/data
