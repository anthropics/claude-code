"""Orchestrator: Claude Agent SDK-based task delegation."""

import json
import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


def _load_config() -> dict:
    """Load orchestrator.yaml from the project root (parent of orchestrator/)."""
    config_path = Path(__file__).resolve().parent.parent / "orchestrator.yaml"
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f) or {}
    return {}


CONFIG = _load_config()
BASE = Path(CONFIG.get("root", str(Path(__file__).resolve().parent.parent)))
ARCHIVE_PATH = Path(CONFIG.get("archive", str(BASE / "ARCHIVE")))


def extract_json(text: str) -> dict:
    """Extract JSON object from text, handling markdown code fences and mixed text.

    Tries multiple strategies:
    1. Direct JSON parse
    2. Markdown code fence extraction
    3. Brace-matching (tries all top-level {} pairs, not just the first)
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

    # Strategy 3: Find all top-level {} pairs and try each
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

    # Try candidates from largest to smallest (largest is most likely the full response)
    for candidate in sorted(candidates, key=len, reverse=True):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    raise ValueError(f"No valid JSON found in response (length={len(text)})")


async def repair_json(raw_text: str, expected_keys: list[str] | None = None) -> dict | None:
    """Last-resort: use haiku to extract JSON from a malformed response."""
    from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

    keys_hint = ""
    if expected_keys:
        keys_hint = f"\nExpected top-level keys: {', '.join(expected_keys)}"

    system = (
        "You are a JSON extractor. Find and return the JSON object from the input text.\n"
        "- If the text contains JSON, extract it exactly\n"
        "- If JSON is malformed, infer intent and reconstruct valid JSON\n"
        "- Output ONLY pure JSON. No explanation, code fences, or quotes\n"
        f"{keys_hint}"
    )

    try:
        options = ClaudeAgentOptions(
            system_prompt=system,
            max_turns=1,
            permission_mode="bypassPermissions",
            model="haiku",
        )

        result_text = ""
        async for message in query(prompt=raw_text[:4000], options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if hasattr(block, "text"):
                        result_text = block.text.strip()
            elif isinstance(message, ResultMessage) and message.result:
                result_text = message.result.strip()

        if result_text:
            return extract_json(result_text)
    except Exception:
        logger.warning("repair_json failed", exc_info=True)

    return None
