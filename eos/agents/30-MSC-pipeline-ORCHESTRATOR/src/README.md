# 30-MSC-pipeline-ORCHESTRATOR (ORCHESTRATOR)

Role: Server/Client
Port: 3521
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Plans pipeline DAG runs, coordinates EXEC.

Compose wiring (reference)
- Service: 30-MSC-pipeline-ORCHESTRATOR
- Ports: 3521:3521
- Volumes:
  - ../agents/30-MSC-pipeline-ORCHESTRATOR/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-orchestrator-state:/app/data
