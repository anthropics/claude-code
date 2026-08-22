#!/usr/bin/env python3
"""
Credential Guard Hook for Claude Code

Scans file content for hardcoded credentials before writes reach disk.
Blocks the write and warns the user when a known credential pattern is detected.

Exit codes:
  0 — allow the tool to proceed
  2 — block the tool (PreToolUse convention)
"""

import json
import os
import re
import sys
from datetime import datetime

# ---------------------------------------------------------------------------
# Credential patterns
#
# Each entry has:
#   name        — stable identifier for dedup / allowlisting
#   label       — human-readable name shown in warnings
#   pattern     — compiled regex (applied to content)
#   suggestion  — remediation hint
#
# Patterns are ordered roughly by specificity (provider-specific first,
# generic high-entropy last) so the first match is the most informative.
# ---------------------------------------------------------------------------

CREDENTIAL_PATTERNS = [
    # ── GitHub ────────────────────────────────────────────────────────────
    {
        "name": "github_pat",
        "label": "GitHub Personal Access Token",
        "pattern": re.compile(r"ghp_[A-Za-z0-9]{36,}"),
        "suggestion": "Use $GH_TOKEN or $GITHUB_TOKEN environment variable",
    },
    {
        "name": "github_fine_grained_pat",
        "label": "GitHub Fine-Grained PAT",
        "pattern": re.compile(r"github_pat_[A-Za-z0-9_]{30,}"),
        "suggestion": "Use $GH_TOKEN or $GITHUB_TOKEN environment variable",
    },
    {
        "name": "github_oauth",
        "label": "GitHub OAuth Access Token",
        "pattern": re.compile(r"gho_[A-Za-z0-9]{36,}"),
        "suggestion": "Use $GITHUB_TOKEN environment variable",
    },
    {
        "name": "github_app_token",
        "label": "GitHub App Token",
        "pattern": re.compile(r"(?:ghu|ghs|ghr)_[A-Za-z0-9]{36,}"),
        "suggestion": "Use $GITHUB_TOKEN environment variable",
    },
    # ── AWS ───────────────────────────────────────────────────────────────
    {
        "name": "aws_access_key",
        "label": "AWS Access Key ID",
        "pattern": re.compile(r"(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])"),
        "suggestion": "Use $AWS_ACCESS_KEY_ID environment variable or AWS credential profiles",
    },
    {
        "name": "aws_secret_key",
        "label": "AWS Secret Access Key",
        "pattern": re.compile(r"(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])"),
        "guard": lambda content, m: _near_aws_context(content, m),
        "suggestion": "Use $AWS_SECRET_ACCESS_KEY environment variable or AWS credential profiles",
    },
    # ── Anthropic / OpenAI / AI providers ─────────────────────────────────
    {
        "name": "anthropic_api_key",
        "label": "Anthropic API Key",
        "pattern": re.compile(r"sk-ant-[A-Za-z0-9_-]{20,}"),
        "suggestion": "Use $ANTHROPIC_API_KEY environment variable",
    },
    {
        "name": "openai_api_key",
        "label": "OpenAI API Key",
        "pattern": re.compile(r"sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}"),
        "suggestion": "Use $OPENAI_API_KEY environment variable",
    },
    {
        "name": "openai_api_key_proj",
        "label": "OpenAI Project API Key",
        "pattern": re.compile(r"sk-proj-[A-Za-z0-9_-]{20,}"),
        "suggestion": "Use $OPENAI_API_KEY environment variable",
    },
    # ── Stripe ────────────────────────────────────────────────────────────
    {
        "name": "stripe_secret_key",
        "label": "Stripe Secret Key",
        "pattern": re.compile(r"(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}"),
        "suggestion": "Use $STRIPE_SECRET_KEY environment variable",
    },
    # ── Slack ─────────────────────────────────────────────────────────────
    {
        "name": "slack_token",
        "label": "Slack Token",
        "pattern": re.compile(r"xox[bporas]-[A-Za-z0-9-]{10,}"),
        "suggestion": "Use $SLACK_TOKEN environment variable",
    },
    {
        "name": "slack_webhook",
        "label": "Slack Webhook URL",
        "pattern": re.compile(r"https://hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+"),
        "suggestion": "Use $SLACK_WEBHOOK_URL environment variable",
    },
    # ── Google / GCP ──────────────────────────────────────────────────────
    {
        "name": "google_api_key",
        "label": "Google API Key",
        "pattern": re.compile(r"AIza[0-9A-Za-z_-]{35}"),
        "suggestion": "Use $GOOGLE_API_KEY environment variable",
    },
    {
        "name": "gcp_service_account",
        "label": "GCP Service Account Key",
        "pattern": re.compile(r'"type"\s*:\s*"service_account"'),
        "suggestion": "Use workload identity federation or $GOOGLE_APPLICATION_CREDENTIALS pointing to a file outside the repo",
    },
    # ── Azure / Microsoft ─────────────────────────────────────────────────
    {
        "name": "azure_subscription_key",
        "label": "Azure Subscription Key",
        "pattern": re.compile(r"(?<![A-Fa-f0-9])[0-9a-f]{32}(?![A-Fa-f0-9])"),
        "guard": lambda content, m: _near_azure_context(content, m),
        "suggestion": "Use $AZURE_SUBSCRIPTION_KEY or Azure Key Vault",
    },
    # ── Twilio ────────────────────────────────────────────────────────────
    {
        "name": "twilio_api_key",
        "label": "Twilio API Key",
        "pattern": re.compile(r"SK[0-9a-fA-F]{32}"),
        "guard": lambda content, m: _near_twilio_context(content, m),
        "suggestion": "Use $TWILIO_API_KEY environment variable",
    },
    # ── SendGrid ──────────────────────────────────────────────────────────
    {
        "name": "sendgrid_api_key",
        "label": "SendGrid API Key",
        "pattern": re.compile(r"SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{22,}"),
        "suggestion": "Use $SENDGRID_API_KEY environment variable",
    },
    # ── Mailgun ───────────────────────────────────────────────────────────
    {
        "name": "mailgun_api_key",
        "label": "Mailgun API Key",
        "pattern": re.compile(r"key-[A-Za-z0-9]{32}"),
        "suggestion": "Use $MAILGUN_API_KEY environment variable",
    },
    # ── npm ───────────────────────────────────────────────────────────────
    {
        "name": "npm_token",
        "label": "npm Access Token",
        "pattern": re.compile(r"npm_[A-Za-z0-9]{36,}"),
        "suggestion": "Use $NPM_TOKEN environment variable",
    },
    # ── PyPI ──────────────────────────────────────────────────────────────
    {
        "name": "pypi_token",
        "label": "PyPI API Token",
        "pattern": re.compile(r"pypi-[A-Za-z0-9_-]{50,}"),
        "suggestion": "Use $PYPI_TOKEN environment variable or keyring",
    },
    # ── Heroku ────────────────────────────────────────────────────────────
    {
        "name": "heroku_api_key",
        "label": "Heroku API Key",
        "pattern": re.compile(r"(?<![A-Fa-f0-9])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![A-Fa-f0-9])"),
        "guard": lambda content, m: _near_heroku_context(content, m),
        "suggestion": "Use $HEROKU_API_KEY environment variable",
    },
    # ── Private keys (PEM) ────────────────────────────────────────────────
    {
        "name": "private_key_pem",
        "label": "Private Key (PEM)",
        "pattern": re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |ED25519 )?PRIVATE KEY-----"),
        "suggestion": "Reference the key file via an environment variable path instead of embedding it",
    },
    # ── Generic Bearer / Authorization headers ────────────────────────────
    {
        "name": "bearer_token",
        "label": "Hardcoded Bearer Token",
        "pattern": re.compile(r"""(?:["'])Bearer\s+[A-Za-z0-9_\-.]{20,}(?:["'])"""),
        "suggestion": "Read the token from an environment variable at runtime",
    },
    {
        "name": "basic_auth_header",
        "label": "Hardcoded Basic Auth",
        "pattern": re.compile(r"""(?:["'])Basic\s+[A-Za-z0-9+/=]{20,}(?:["'])"""),
        "suggestion": "Read credentials from environment variables at runtime",
    },
    # ── Connection strings with embedded passwords ────────────────────────
    {
        "name": "database_url_password",
        "label": "Database URL with Embedded Password",
        "pattern": re.compile(
            r"(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqp)://"
            r"[^:\s]+:[^@\s]+@[^/\s]+"
        ),
        "suggestion": "Use $DATABASE_URL environment variable or a secrets manager",
    },
    # ── Generic high-entropy secrets (last resort) ────────────────────────
    {
        "name": "generic_secret_assignment",
        "label": "Possible Hardcoded Secret",
        "pattern": re.compile(
            r"""(?:secret|password|passwd|token|api_key|apikey|api[-_]?secret|auth[-_]?token|access[-_]?token)"""
            r"""\s*[=:]\s*["'][A-Za-z0-9+/=_\-.]{16,}["']""",
            re.IGNORECASE,
        ),
        "suggestion": "Use an environment variable or secrets manager instead of hardcoding this value",
    },
]


# ---------------------------------------------------------------------------
# Guard helpers — narrow down overly broad patterns by checking surrounding
# context.  Return True only when the match looks like a real credential.
# ---------------------------------------------------------------------------

def _context_window(content, match, chars=200):
    start = max(0, match.start() - chars)
    end = min(len(content), match.end() + chars)
    return content[start:end].lower()


def _near_aws_context(content, match):
    window = _context_window(content, match)
    return any(kw in window for kw in [
        "aws", "secret", "access_key", "secret_key",
        "credential", "s3", "iam", "boto",
    ])


def _near_azure_context(content, match):
    window = _context_window(content, match)
    return any(kw in window for kw in [
        "azure", "subscription", "cognitive", "ocp-apim",
    ])


def _near_heroku_context(content, match):
    window = _context_window(content, match)
    return any(kw in window for kw in [
        "heroku", "heroku_api", "heroku_key",
    ])


def _near_twilio_context(content, match):
    window = _context_window(content, match)
    return any(kw in window for kw in [
        "twilio", "account_sid", "auth_token", "sms", "messaging",
    ])


# ---------------------------------------------------------------------------
# Allowlist — paths where credentials are expected / safe
# ---------------------------------------------------------------------------

SAFE_PATH_PATTERNS = [
    re.compile(r"\.env\.example$"),
    re.compile(r"\.env\.sample$"),
    re.compile(r"\.env\.template$"),
    re.compile(r"fixture[s]?/", re.IGNORECASE),
    re.compile(r"test[s]?/.*mock", re.IGNORECASE),
    re.compile(r"__test__/", re.IGNORECASE),
]


def _is_safe_path(file_path):
    return any(p.search(file_path) for p in SAFE_PATH_PATTERNS)


# ---------------------------------------------------------------------------
# Bash command content extraction
# ---------------------------------------------------------------------------

# Bash patterns that write content to files
BASH_WRITE_PATTERNS = [
    re.compile(r"(?:>>?)\s*\S+"),           # echo foo > file / >> file
    re.compile(r"tee\s+(?:-a\s+)?\S+"),     # tee file / tee -a file
    re.compile(r"cat\s*<<"),                 # heredoc
]


def _bash_writes_to_file(command):
    return any(p.search(command) for p in BASH_WRITE_PATTERNS)


# ---------------------------------------------------------------------------
# State management — deduplicate warnings per session
# ---------------------------------------------------------------------------

def _state_file(session_id):
    return os.path.expanduser(f"~/.claude/credential_guard_state_{session_id}.json")


def _load_state(session_id):
    path = _state_file(session_id)
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def _save_state(session_id, seen):
    path = _state_file(session_id)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(list(seen), f)
    except IOError:
        pass


def _cleanup_old_state_files():
    """Remove state files older than 30 days."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return
        cutoff = datetime.now().timestamp() - (30 * 24 * 60 * 60)
        for name in os.listdir(state_dir):
            if name.startswith("credential_guard_state_") and name.endswith(".json"):
                path = os.path.join(state_dir, name)
                try:
                    if os.path.getmtime(path) < cutoff:
                        os.remove(path)
                except OSError:
                    pass
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Content extraction
# ---------------------------------------------------------------------------

def _extract_content(tool_name, tool_input):
    """Return (file_path, content) from the tool input."""
    if tool_name == "Write":
        return tool_input.get("file_path", ""), tool_input.get("content", "")
    elif tool_name == "Edit":
        return tool_input.get("file_path", ""), tool_input.get("new_string", "")
    elif tool_name == "MultiEdit":
        edits = tool_input.get("edits", [])
        combined = " ".join(e.get("new_string", "") for e in edits)
        return tool_input.get("file_path", ""), combined
    elif tool_name == "NotebookEdit":
        # Notebook cells can contain credentials too
        new_source = tool_input.get("new_source", "")
        file_path = tool_input.get("notebook_path", tool_input.get("file_path", ""))
        return file_path, new_source
    elif tool_name == "Bash":
        command = tool_input.get("command", "")
        if _bash_writes_to_file(command):
            return "<bash command>", command
        return "", ""
    return "", ""


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------

def scan(content):
    """Return list of {name, label, matched, suggestion} for all matches."""
    findings = []
    seen_names = set()
    for pat in CREDENTIAL_PATTERNS:
        if pat["name"] in seen_names:
            continue
        match = pat["pattern"].search(content)
        if not match:
            continue
        if "guard" in pat and not pat["guard"](content, match):
            continue
        matched_text = match.group()
        redacted = _redact(matched_text)
        findings.append({
            "name": pat["name"],
            "label": pat["label"],
            "matched": redacted,
            "suggestion": pat["suggestion"],
        })
        seen_names.add(pat["name"])
    return findings


def _redact(text):
    """Show first 4 and last 2 chars, mask the rest."""
    if len(text) <= 10:
        return text[:3] + "***"
    return text[:4] + "*" * (len(text) - 6) + text[-2:]


# ---------------------------------------------------------------------------
# Warning formatting
# ---------------------------------------------------------------------------

def _format_warning(findings, file_path):
    lines = [
        "",
        "=" * 64,
        "  CREDENTIAL GUARD — Hardcoded secret detected",
        "=" * 64,
        "",
        f"  File: {file_path}",
        "",
    ]
    for i, f in enumerate(findings, 1):
        lines.append(f"  [{i}] {f['label']}")
        lines.append(f"      Matched: {f['matched']}")
        lines.append(f"      Fix:     {f['suggestion']}")
        lines.append("")

    lines.extend([
        "  This write has been BLOCKED to prevent credential exposure.",
        "  Rewrite the code to use environment variables or a secrets",
        "  manager, then retry.",
        "",
        "  Docs: https://docs.claude.com/en/docs/claude-code/plugins",
        "=" * 64,
        "",
    ])
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if os.environ.get("CREDENTIAL_GUARD_DISABLED", "0") == "1":
        sys.exit(0)

    import random
    if random.random() < 0.05:
        _cleanup_old_state_files()

    try:
        input_data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    file_path, content = _extract_content(tool_name, tool_input)
    if not content:
        sys.exit(0)

    if file_path and _is_safe_path(file_path):
        sys.exit(0)

    findings = scan(content)
    if not findings:
        sys.exit(0)

    warning_key = f"{file_path}|{'|'.join(f['name'] for f in findings)}"
    seen = _load_state(session_id)
    if warning_key in seen:
        # Already warned in this session — still block but shorter message
        print(
            f"\n  Credential Guard: blocked repeat write to {file_path} "
            f"(same secrets still present). Remove the hardcoded credentials and retry.\n",
            file=sys.stderr,
        )
        sys.exit(2)

    seen.add(warning_key)
    _save_state(session_id, seen)

    print(_format_warning(findings, file_path), file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
