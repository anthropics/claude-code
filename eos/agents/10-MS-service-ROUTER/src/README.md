# 10-MS-service-ROUTER (ROUTER)

Role: Server
Port: 3434
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Routes RPC to agents by capability.

Compose wiring (reference)
- Service: 10-MS-service-ROUTER
- Ports: 3434:3434
- Volumes:
  - ../agents/10-MS-service-ROUTER/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-router-state:/app/data
