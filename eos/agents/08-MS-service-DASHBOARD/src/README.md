# 08-MS-service-DASHBOARD (DASHBOARD)

Role: Server
Port: 3000
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Web UI for EOS status and controls.

Compose wiring (reference)
- Service: 08-MS-service-DASHBOARD
- Ports: 3000:3000
- Volumes:
  - ../agents/08-MS-service-DASHBOARD/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-dashboard-state:/app/data
