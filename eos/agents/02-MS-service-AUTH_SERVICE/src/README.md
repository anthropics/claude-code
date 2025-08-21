# 02-MS-service-AUTH_SERVICE (AUTH_SERVICE)

Role: Server
Port: 3512
Config mount (ro): /app/config/agent.yaml
Local state: /app/data/state.db (Podman named volume)

Purpose: AuthN/AuthZ, JWKS issuer.

Compose wiring (reference)
- Service: 02-MS-service-AUTH_SERVICE
- Ports: 3512:3512
- Volumes:
  - ../agents/02-MS-service-AUTH_SERVICE/configs/agent.yaml:/app/config/agent.yaml:ro
  - eos-auth_service-state:/app/data
