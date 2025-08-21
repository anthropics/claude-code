# 00-MS-core-SESSION_LOG (SESSION_LOG)

Role: Server
Port: 3510
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: Central receiver/indexer for session/event logs (OFTX).

Compose wiring (reference)
- Service: 00-MS-core-SESSION_LOG
- Ports: 3510:3510
- Volumes:
  - ../agents/00-MS-core-SESSION_LOG/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-session_log-state:/app/data
