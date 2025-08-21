# 01-MS-service-CONFIGURATION (CONFIGURATION)

Role: Server
Port: 3511
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Central configuration/feature flags service.

Compose wiring (reference)
- Service: 01-MS-service-CONFIGURATION
- Ports: 3511:3511
- Volumes:
  - ../agents/01-MS-service-CONFIGURATION/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-configuration-state:/app/data
