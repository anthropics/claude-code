import os
import time
import anthropic

AGENT_ID = os.environ["AGENT_ID"]
ENV_ID = os.environ["ENV_ID"]
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]          # PAT: Contents read+write, for repo cloning/push
GITHUB_MCP_TOKEN = os.environ["GITHUB_MCP_TOKEN"]  # OAuth token for GitHub MCP server
# To get GITHUB_MCP_TOKEN: GitHub Settings -> Developer settings -> OAuth Apps ->
# create app with scopes: repo, issues, pull_requests -> use the resulting OAuth access token

REPOS = [
    "https://github.com/sjbrenchley89/claude-code",
    "https://github.com/sjbrenchley89/source-build-au",
    "https://github.com/sjbrenchley89/windows-mcp",
    "https://github.com/sjbrenchley89/ruflo",
    "https://github.com/sjbrenchley89/tailscale",
]

client = anthropic.Anthropic()


def stream_until_idle(session_id: str, kickoff_text: str) -> None:
    with client.beta.sessions.events.stream(session_id=session_id) as stream:
        client.beta.sessions.events.send(
            session_id=session_id,
            events=[{"type": "user.message", "content": [{"type": "text", "text": kickoff_text}]}],
        )
        for event in stream:
            if event.type == "agent.message":
                for block in event.content:
                    if block.type == "text":
                        print(block.text, end="", flush=True)
            elif event.type == "session.status_terminated":
                break
            elif event.type == "session.status_idle":
                if event.stop_reason.type != "requires_action":
                    break


def run():
    # Vault — create fresh each run (vault_ids not updatable after session create)
    vault = client.beta.vaults.create(name="business-agent-run-vault")
    client.beta.vaults.credentials.create(
        vault_id=vault.id,
        display_name="GitHub MCP",
        auth={
            "type": "mcp_oauth",
            "mcp_server_url": "https://api.githubcopilot.com/mcp/",
            "access_token": GITHUB_MCP_TOKEN,
            # Omit refresh block if GITHUB_MCP_TOKEN is a long-lived token
        },
    )

    session = client.beta.sessions.create(
        agent=AGENT_ID,
        environment_id=ENV_ID,
        title="Business Agent scheduled run",
        resources=[
            {
                "type": "github_repository",
                "url": repo,
                "authorization_token": GITHUB_TOKEN,
                "checkout": {"type": "branch", "name": "main"},
            }
            for repo in REPOS
        ],
        vault_ids=[vault.id],
    )
    print(f"Watch: https://platform.claude.com/workspaces/default/sessions/{session.id}")

    # Smoke-test: verify GitHub MCP is reachable before spending tokens on the real task
    print("\n-- Smoke test --")
    stream_until_idle(
        session.id,
        "Confirm you can reach GitHub via MCP and list the names of the 5 repositories "
        "in sjbrenchley89. Do not start the main task yet.",
    )

    # Main task
    print("\n\n-- Main task --")
    stream_until_idle(
        session.id,
        "Run the full task: scan all 5 repos for open issues, fix fixable ones by opening "
        "PRs, and write the digest to /mnt/session/outputs/digest.md",
    )

    # Download outputs (brief indexing lag after session goes idle)
    time.sleep(3)
    print("\n\n-- Outputs --")
    files = client.beta.files.list(
        scope_id=session.id,
        betas=["managed-agents-2026-04-01"],
    )
    for f in files.data:
        print(f"  {f.filename} ({f.size_bytes} bytes)")
        client.beta.files.download(f.id).write_to_file(f.filename)


if __name__ == "__main__":
    run()
