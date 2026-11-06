#!/usr/bin/env bash
# Run once — saves AGENT_ID and ENV_ID to .env
set -euo pipefail

AGENT_ID=$(ant beta:agents create < business-agent.agent.yaml --transform id -r)
ENV_ID=$(ant beta:environments create < business-agent.environment.yaml --transform id -r)

echo "AGENT_ID=$AGENT_ID" >> .env
echo "ENV_ID=$ENV_ID" >> .env
echo "Setup complete. IDs written to .env"
echo "  AGENT_ID=$AGENT_ID"
echo "  ENV_ID=$ENV_ID"

# To update agent after editing the YAML (creates a new version):
# ant beta:agents update --agent-id "$AGENT_ID" < business-agent.agent.yaml
