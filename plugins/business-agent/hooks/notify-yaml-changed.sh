#!/usr/bin/env bash
# PostToolUse hook: warn when business-agent.agent.yaml is edited without deploying.
# Input: TOOL_INPUT env var (JSON) containing the file path that was edited.

set -euo pipefail

# Only act on edits to the agent YAML
file_path=$(echo "${TOOL_INPUT:-}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path','') or d.get('path',''))" 2>/dev/null || true)

if [[ "$file_path" != *"business-agent.agent.yaml" ]]; then
  exit 0
fi

echo "business-agent.agent.yaml was edited. To deploy changes to the platform, run:" >&2
echo "  /business-agent:update" >&2
echo "or manually: source business-agent/.env && ant beta:agents update --agent-id \"\$AGENT_ID\" < business-agent/business-agent.agent.yaml" >&2

# Exit 1 = non-blocking: message is shown but Claude continues
exit 1
