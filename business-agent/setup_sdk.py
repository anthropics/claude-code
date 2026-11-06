#!/usr/bin/env python3
"""
One-time setup: creates the Business Agent and environment via the Python SDK.
Run this instead of setup.sh if you don't have the ant CLI installed.

Usage:
    pip install "anthropic>=0.92.0"
    export ANTHROPIC_API_KEY=sk-ant-...
    python setup_sdk.py
"""
import os
import anthropic

client = anthropic.Anthropic()

print("Creating environment...")
environment = client.beta.environments.create(
    name="business-agent-env",
    config={
        "type": "cloud",
        "networking": {"type": "unrestricted"},
    },
)
print(f"  ENV_ID={environment.id}")

print("Creating agent...")
agent = client.beta.agents.create(
    name="Business Agent",
    model="claude-opus-4-7",
    system=(
        "You are a Business Agent that scans GitHub repositories for open issues and fixes them.\n"
        "On each run:\n"
        "1. Use the GitHub MCP tools to list open issues and PRs across all five repositories:\n"
        "   sjbrenchley89/claude-code, sjbrenchley89/source-build-au, sjbrenchley89/windows-mcp,\n"
        "   sjbrenchley89/ruflo, sjbrenchley89/tailscale\n"
        "2. For each open issue that represents a fixable code problem, use the mounted repo at\n"
        "   /workspace/<repo-name> to: create a fix branch, implement the fix, push, and open a PR\n"
        "   referencing the issue\n"
        "3. Write a digest to /mnt/session/outputs/digest.md: issues reviewed, PRs opened (with URLs),\n"
        "   issues skipped (with reason)"
    ),
    tools=[
        {"type": "agent_toolset_20260401"},
        {"type": "mcp_toolset", "mcp_server_name": "github"},
    ],
    mcp_servers=[
        {
            "type": "url",
            "name": "github",
            "url": "https://api.githubcopilot.com/mcp/",
        }
    ],
    skills=[
        {"type": "anthropic", "skill_id": "xlsx"},
        {"type": "anthropic", "skill_id": "docx"},
        {"type": "anthropic", "skill_id": "pptx"},
        {"type": "anthropic", "skill_id": "pdf"},
    ],
)
print(f"  AGENT_ID={agent.id}")
print(f"  AGENT_VERSION={agent.version}")

# Write IDs to .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path, "w") as f:
    f.write(f"AGENT_ID={agent.id}\n")
    f.write(f"AGENT_VERSION={agent.version}\n")
    f.write(f"ENV_ID={environment.id}\n")

print(f"\nIDs written to {env_path}")
print("\nNext: set GITHUB_TOKEN and GITHUB_MCP_TOKEN, then run: python run_agent.py")
