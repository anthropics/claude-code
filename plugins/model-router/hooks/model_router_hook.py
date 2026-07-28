#!/usr/bin/env python3
"""
Model Router Hook for Claude Code

Fires on UserPromptSubmit. Classifies the incoming prompt using claude-haiku
and surfaces a model recommendation as a systemMessage so the user can switch
with /model before Claude processes the request.

Requires: ANTHROPIC_API_KEY in the environment.
Cost: ~$0.0001 per classification (Haiku input pricing).
"""

import json
import os
import sys

CLASSIFIER_MODEL = "claude-haiku-4-5"

# Models and their descriptions shown in the recommendation banner
MODELS = {
    "claude-haiku-4-5": {
        "label": "Haiku 4.5",
        "description": "Fast & cheap. Best for Q&A, summarization, extraction, classification.",
        "cost": "$1.00/$5.00 per 1M tokens",
    },
    "claude-sonnet-4-6": {
        "label": "Sonnet 4.6",
        "description": "Balanced. Best for code generation, analysis, most everyday tasks.",
        "cost": "$3.00/$15.00 per 1M tokens",
    },
    "claude-opus-4-6": {
        "label": "Opus 4.6",
        "description": "Most capable. Best for architecture, complex reasoning, ambiguous problems.",
        "cost": "$5.00/$25.00 per 1M tokens",
    },
}

CLASSIFIER_SYSTEM_PROMPT = """You are a routing classifier. Given a user prompt, decide which Claude model to use.

MODELS:
- claude-haiku-4-5   → low complexity:    Q&A, summarization, extraction, classification, yes/no, simple lookups
- claude-sonnet-4-6  → medium complexity: code generation, debugging, writing, analysis, most agent tasks
- claude-opus-4-6    → high complexity:   system architecture, ambiguous multi-constraint problems, novel research,
                                           comprehensive planning across many competing requirements

ROUTING RULES:
Route to claude-haiku-4-5 when the prompt:
- Asks a factual question with a well-known answer
- Requests a simple classification or label
- Asks to summarize, translate, or reformat content
- Is a yes/no or short-answer question
- Involves basic data extraction

Route to claude-sonnet-4-6 when the prompt:
- Asks to write, debug, or review code
- Requires analysis or explanation of a concept
- Involves writing tasks (emails, docs, descriptions)
- Is a multi-step task but with clear requirements
- Is the default when unsure

Route to claude-opus-4-6 when the prompt:
- Asks for system design or architecture decisions
- Involves deeply ambiguous or contradictory requirements
- Requires reasoning across many competing constraints simultaneously
- Is a high-stakes decision with significant consequences
- Explicitly requests the most thorough or comprehensive response

Respond ONLY with a JSON object, no other text:
{
  "recommended_model": "claude-haiku-4-5" | "claude-sonnet-4-6" | "claude-opus-4-6",
  "task_type": one short word (e.g. "qa", "coding", "architecture", "analysis", "writing", "summarization"),
  "complexity": "low" | "medium" | "high",
  "confidence": float 0.0-1.0,
  "reasoning": one sentence explaining the routing decision
}"""


def classify(prompt: str) -> dict:
    """Call Haiku to classify the prompt. Returns routing decision dict."""
    try:
        import anthropic
    except ImportError:
        return None

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=CLASSIFIER_MODEL,
            max_tokens=256,
            system=CLASSIFIER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(response.content[0].text.strip())
    except Exception:
        return None


def format_banner(result: dict, current_model: str | None) -> str:
    """Format the recommendation as a concise banner for systemMessage."""
    model_id = result["recommended_model"]
    model_info = MODELS.get(model_id, {})

    lines = [
        f"╔═ Model Router ══════════════════════════════════════╗",
        f"║  Recommended:  {model_info.get('label', model_id):<37}║",
        f"║  Task:         {result['task_type']:<10}  Complexity: {result['complexity']:<8}║",
        f"║  Confidence:   {result['confidence']:.0%}                                ║",
        f"║                                                      ║",
        f"║  {result['reasoning'][:52]:<52}║",
    ]

    if len(result["reasoning"]) > 52:
        lines.append(f"║  {result['reasoning'][52:104]:<52}║")

    lines.append(f"║                                                      ║")

    if current_model and current_model != model_id:
        lines.append(f"║  ⚡ Switch with /model to use {model_info.get('label', model_id):<24}║")
    elif current_model == model_id:
        lines.append(f"║  ✓ Already on the recommended model                  ║")
    else:
        lines.append(f"║  Use /model to switch models                         ║")

    lines.append(f"╚══════════════════════════════════════════════════════╝")

    return "\n".join(lines)


def main():
    # Read hook input from stdin
    try:
        raw = sys.stdin.read()
        hook_input = json.loads(raw) if raw.strip() else {}
    except (json.JSONDecodeError, Exception):
        sys.exit(0)

    # Extract the user's prompt
    prompt = hook_input.get("prompt", "")
    if not prompt or len(prompt.strip()) < 3:
        sys.exit(0)

    # Check if the plugin is enabled (opt-out via env var)
    if os.environ.get("MODEL_ROUTER_DISABLED", "").lower() in ("1", "true", "yes"):
        sys.exit(0)

    # Run classification
    result = classify(prompt)
    if not result or "recommended_model" not in result:
        # Fail silently — don't block the user's prompt
        sys.exit(0)

    # Get current model from env if Claude Code surfaces it
    current_model = os.environ.get("CLAUDE_MODEL")

    # Build the recommendation banner
    banner = format_banner(result, current_model)

    # Return as systemMessage (shown to user but not sent to the model)
    output = {"systemMessage": banner}
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
