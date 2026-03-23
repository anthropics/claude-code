"""Remote workspace listener: receives tasks from orchestrator via HTTP and executes locally.

Standalone script — deploy to any remote host with Python 3.10+ and claude-agent-sdk.
Run: LISTENER_CWD=/path/to/workspace LISTENER_PORT=9100 python3 listener.py

Environment variables:
    LISTENER_CWD   — workspace directory (default: cwd)
    LISTENER_PORT   — port to listen on (default: 9100)
    LISTENER_TOKEN  — optional bearer token for auth
"""

import asyncio
import json
import logging
import os
import re

# Remove env vars that interfere with claude-agent-sdk subprocess spawning
for _key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
    os.environ.pop(_key, None)

from aiohttp import web

logging.basicConfig(level=logging.INFO, format="%(asctime)s [listener] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

WORKSPACE_CWD = os.environ.get("LISTENER_CWD", os.getcwd())
LISTENER_PORT = int(os.environ.get("LISTENER_PORT", "9100"))
LISTENER_TOKEN = os.environ.get("LISTENER_TOKEN", "")

# ── Standalone JSON extraction (mirrors orchestrator/__init__.py) ────────


def extract_json(text: str) -> dict:
    """Extract JSON from text with multiple fallback strategies.

    1. Direct parse
    2. Markdown code fence extraction
    3. Brace-matching (all top-level {} pairs, largest first)
    """
    text = text.strip()

    # Strategy 1: Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Markdown code fence
    for match in re.finditer(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL):
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            continue

    # Strategy 3: Brace-matching
    candidates: list[str] = []
    depth = 0
    start = -1
    in_string = False
    escape_next = False

    for i, ch in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            continue
        if ch == '"' and depth > 0:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                candidates.append(text[start : i + 1])
                start = -1

    for candidate in sorted(candidates, key=len, reverse=True):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    raise ValueError(f"No valid JSON found in response (length={len(text)})")


def make_fallback_result(raw: str, error: str = "") -> dict:
    return {
        "changed_files": [],
        "summary": raw[:2000] or "No response",
        "test_result": "skip",
        "downstream_context": "",
        **({"parse_error": error} if error else {}),
    }


# ── Response format instruction ──────────────────────────────────────────

RESPONSE_FORMAT_INSTRUCTION = (
    "\n\nIMPORTANT: Respond with a single JSON object (no markdown fences, no extra text):\n"
    '{"changed_files": ["file1.py", ...], "summary": "what was done", '
    '"test_result": "pass|fail|skip", "downstream_context": "info for next phase"}'
)

# ── Handlers ─────────────────────────────────────────────────────────────


async def handle_execute(request: web.Request) -> web.Response:
    """Execute a task via claude-agent-sdk query(cwd=WORKSPACE_CWD)."""
    if LISTENER_TOKEN:
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {LISTENER_TOKEN}":
            return web.json_response({"error": "unauthorized"}, status=401)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    task = body.get("task", "")
    upstream_context = body.get("upstream_context", {})
    model = body.get("model", "")

    if not task:
        return web.json_response({"error": "task field required"}, status=400)

    logger.info("Executing task (first 200 chars): %s", task[:200])

    try:
        from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

        # Build prompt with upstream context + task + format instruction
        parts = []
        if upstream_context:
            ctx_lines = [f"- {k}: {v}" for k, v in upstream_context.items()]
            parts.append("<upstream_context>\n" + "\n".join(ctx_lines) + "\n</upstream_context>\n")
        parts.append(f"<task>\n{task}\n</task>")
        parts.append(RESPONSE_FORMAT_INSTRUCTION)

        options_kwargs = {
            "cwd": WORKSPACE_CWD,
            "max_turns": 100,
            "allowed_tools": [
                "Read", "Write", "Edit", "Bash", "Glob", "Grep",
                "Agent", "WebFetch", "WebSearch",
            ],
            "setting_sources": ["project"],
            "permission_mode": "bypassPermissions",
        }
        if model:
            options_kwargs["model"] = model

        options = ClaudeAgentOptions(**options_kwargs)

        collected_texts: list[str] = []
        final_result: str | None = None

        async for message in query(prompt="\n".join(parts), options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if hasattr(block, "text"):
                        collected_texts.append(block.text)
            elif isinstance(message, ResultMessage) and message.result:
                final_result = message.result

        raw = final_result or (collected_texts[-1] if collected_texts else "")

        # Multi-strategy JSON extraction
        try:
            result = extract_json(raw)
        except ValueError as parse_err:
            logger.warning("JSON extraction failed: %s", parse_err)
            result = make_fallback_result(raw, str(parse_err))

        return web.json_response(result)

    except Exception as exc:
        logger.exception("Task execution failed")
        return web.json_response({
            "changed_files": [],
            "summary": f"Listener error: {type(exc).__name__}: {exc}",
            "test_result": "fail",
            "downstream_context": "",
            "error": str(exc),
        }, status=500)


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({
        "status": "ok",
        "cwd": WORKSPACE_CWD,
        "port": LISTENER_PORT,
    })


def create_app() -> web.Application:
    # client_max_size=0 removes body size limit; no read/write timeout on long tasks
    app = web.Application(client_max_size=0)
    app.router.add_post("/execute", handle_execute)
    app.router.add_get("/health", handle_health)
    return app


def main():
    app = create_app()
    logger.info("Starting listener on port %d, cwd=%s", LISTENER_PORT, WORKSPACE_CWD)
    web.run_app(app, host="0.0.0.0", port=LISTENER_PORT)


if __name__ == "__main__":
    main()
