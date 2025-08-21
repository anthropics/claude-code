# 40-MSC-pipeline-EXEC (EXEC)

Role: Server/Client
Port: 3522
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Executes pipeline tasks.

Compose wiring (reference)
- Service: 40-MSC-pipeline-EXEC
- Ports: 3522:3522
- Volumes:
  - ../agents/40-MSC-pipeline-EXEC/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-exec-state:/app/data
