#!/usr/bin/env python3
"""PostToolUse hook for detecting exposed secrets in Claude Code output.

This hook scans tool output for sensitive data patterns including:
- API keys (OpenAI, Anthropic, AWS, Stripe, etc.)
- Passwords and credentials
- Private keys and certificates
- Database connection strings
- OAuth tokens and JWTs

When secrets are detected, it:
1. Displays a warning to the user
2. Logs the detection (without the actual secret) for security review
3. Suggests remediation steps

Addresses issues:
- #18223: Claude displayed sensitive .env credentials
- #22548: Auto-mask API keys in VS Code extension
- #21528: Environment Variable Redaction for Hook Security

Author: Steven Elliott
License: MIT
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple


class SecretPattern(NamedTuple):
    """Definition of a secret pattern to detect."""
    name: str
    pattern: str
    severity: str  # critical, high, medium, low
    description: str


# Comprehensive list of secret patterns
# Patterns sourced from: gitleaks, trufflehog, detect-secrets
SECRET_PATTERNS = [
    # Anthropic
    SecretPattern(
        "Anthropic API Key",
        r"sk-ant-api\d{2}-[A-Za-z0-9_-]{93}",
        "critical",
        "Anthropic Claude API key"
    ),

    # OpenAI
    SecretPattern(
        "OpenAI API Key",
        r"sk-[A-Za-z0-9]{48}",
        "critical",
        "OpenAI API key"
    ),
    SecretPattern(
        "OpenAI Project Key",
        r"sk-proj-[A-Za-z0-9_-]{48,}",
        "critical",
        "OpenAI project API key"
    ),

    # AWS
    SecretPattern(
        "AWS Access Key ID",
        r"AKIA[0-9A-Z]{16}",
        "critical",
        "AWS access key ID"
    ),
    SecretPattern(
        "AWS Secret Access Key",
        r"(?i)aws_secret_access_key\s*[=:]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?",
        "critical",
        "AWS secret access key"
    ),

    # Google Cloud
    SecretPattern(
        "Google API Key",
        r"AIza[0-9A-Za-z_-]{35}",
        "high",
        "Google Cloud API key"
    ),
    SecretPattern(
        "Google OAuth Token",
        r"ya29\.[0-9A-Za-z_-]+",
        "high",
        "Google OAuth access token"
    ),

    # GitHub
    SecretPattern(
        "GitHub Token (Classic)",
        r"ghp_[A-Za-z0-9]{36}",
        "critical",
        "GitHub personal access token (classic)"
    ),
    SecretPattern(
        "GitHub Token (Fine-grained)",
        r"github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}",
        "critical",
        "GitHub fine-grained personal access token"
    ),
    SecretPattern(
        "GitHub OAuth Token",
        r"gho_[A-Za-z0-9]{36}",
        "high",
        "GitHub OAuth access token"
    ),
    SecretPattern(
        "GitHub App Token",
        r"ghu_[A-Za-z0-9]{36}",
        "high",
        "GitHub user-to-server token"
    ),

    # Stripe
    SecretPattern(
        "Stripe Secret Key",
        r"sk_live_[0-9a-zA-Z]{24,}",
        "critical",
        "Stripe live secret key"
    ),
    SecretPattern(
        "Stripe Test Key",
        r"sk_test_[0-9a-zA-Z]{24,}",
        "medium",
        "Stripe test secret key"
    ),
    SecretPattern(
        "Stripe Restricted Key",
        r"rk_live_[0-9a-zA-Z]{24,}",
        "critical",
        "Stripe restricted API key"
    ),

    # Slack
    SecretPattern(
        "Slack Bot Token",
        r"xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}",
        "high",
        "Slack bot token"
    ),
    SecretPattern(
        "Slack User Token",
        r"xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}",
        "high",
        "Slack user token"
    ),
    SecretPattern(
        "Slack Webhook",
        r"https://hooks\.slack\.com/services/T[A-Z0-9]{8,}/B[A-Z0-9]{8,}/[a-zA-Z0-9]{24}",
        "high",
        "Slack incoming webhook URL"
    ),

    # Database Connection Strings
    SecretPattern(
        "PostgreSQL Connection String",
        r"postgres(?:ql)?://[^:]+:[^@]+@[^/]+/[^\s]+",
        "critical",
        "PostgreSQL connection string with credentials"
    ),
    SecretPattern(
        "MySQL Connection String",
        r"mysql://[^:]+:[^@]+@[^/]+/[^\s]+",
        "critical",
        "MySQL connection string with credentials"
    ),
    SecretPattern(
        "MongoDB Connection String",
        r"mongodb(?:\+srv)?://[^:]+:[^@]+@[^\s]+",
        "critical",
        "MongoDB connection string with credentials"
    ),
    SecretPattern(
        "Redis Connection String",
        r"redis://[^:]+:[^@]+@[^\s]+",
        "high",
        "Redis connection string with credentials"
    ),

    # Private Keys
    SecretPattern(
        "RSA Private Key",
        r"-----BEGIN RSA PRIVATE KEY-----",
        "critical",
        "RSA private key"
    ),
    SecretPattern(
        "OpenSSH Private Key",
        r"-----BEGIN OPENSSH PRIVATE KEY-----",
        "critical",
        "OpenSSH private key"
    ),
    SecretPattern(
        "PGP Private Key",
        r"-----BEGIN PGP PRIVATE KEY BLOCK-----",
        "critical",
        "PGP private key"
    ),
    SecretPattern(
        "EC Private Key",
        r"-----BEGIN EC PRIVATE KEY-----",
        "critical",
        "Elliptic curve private key"
    ),

    # JWT
    SecretPattern(
        "JSON Web Token",
        r"eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*",
        "high",
        "JSON Web Token (may contain sensitive claims)"
    ),

    # Generic Patterns
    SecretPattern(
        "Generic API Key",
        r"(?i)(?:api[_-]?key|apikey)\s*[=:]\s*['\"]?([A-Za-z0-9_-]{20,})['\"]?",
        "medium",
        "Generic API key pattern"
    ),
    SecretPattern(
        "Generic Secret",
        r"(?i)(?:secret|password|passwd|pwd)\s*[=:]\s*['\"]?([^\s'\"]{8,})['\"]?",
        "high",
        "Generic secret or password"
    ),
    SecretPattern(
        "Bearer Token",
        r"(?i)bearer\s+[A-Za-z0-9_-]{20,}",
        "high",
        "Bearer authentication token"
    ),
    SecretPattern(
        "Basic Auth Header",
        r"(?i)basic\s+[A-Za-z0-9+/=]{20,}",
        "high",
        "Basic authentication header (base64 encoded)"
    ),

    # Cloud Provider Specific
    SecretPattern(
        "Azure Storage Key",
        r"DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}",
        "critical",
        "Azure Storage account connection string"
    ),
    SecretPattern(
        "Twilio API Key",
        r"SK[a-f0-9]{32}",
        "high",
        "Twilio API key"
    ),
    SecretPattern(
        "SendGrid API Key",
        r"SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}",
        "high",
        "SendGrid API key"
    ),
    SecretPattern(
        "Mailchimp API Key",
        r"[a-f0-9]{32}-us[0-9]{1,2}",
        "high",
        "Mailchimp API key"
    ),

    # npm
    SecretPattern(
        "npm Token",
        r"npm_[A-Za-z0-9]{36}",
        "high",
        "npm access token"
    ),

    # Heroku
    SecretPattern(
        "Heroku API Key",
        r"(?i)heroku.*['\"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['\"]",
        "high",
        "Heroku API key"
    ),
]


def get_log_dir() -> Path:
    """Get or create the secrets log directory."""
    config_dir = os.environ.get('CLAUDE_CONFIG_DIR', os.path.expanduser('~/.claude'))
    log_dir = Path(config_dir) / 'security-logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def log_detection(tool_name: str, file_path: str, detections: list) -> None:
    """Log secret detection event (without the actual secret values)."""
    log_dir = get_log_dir()
    date_str = datetime.now().strftime('%Y-%m-%d')
    log_file = log_dir / f"secrets-detected-{date_str}.jsonl"

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool": tool_name,
        "source": file_path or "unknown",
        "detections": [
            {
                "type": d["name"],
                "severity": d["severity"],
                "description": d["description"],
                # Note: We deliberately do NOT log the actual secret value
            }
            for d in detections
        ],
        "cwd": os.getcwd(),
    }

    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


def scan_for_secrets(content: str) -> list:
    """Scan content for secret patterns."""
    if not content or len(content) < 10:
        return []

    detections = []
    seen_patterns = set()  # Avoid duplicate detections

    for pattern in SECRET_PATTERNS:
        try:
            matches = re.findall(pattern.pattern, content)
            if matches and pattern.name not in seen_patterns:
                # For patterns with groups, check if we got actual matches
                if isinstance(matches[0], tuple):
                    matches = [m for m in matches if any(m)]
                if matches:
                    detections.append({
                        "name": pattern.name,
                        "severity": pattern.severity,
                        "description": pattern.description,
                        "count": len(matches),
                    })
                    seen_patterns.add(pattern.name)
        except re.error:
            continue  # Skip invalid patterns

    return detections


def format_warning(detections: list, tool_name: str, file_path: str) -> str:
    """Format a user-friendly warning message."""
    severity_icons = {
        "critical": "🚨",
        "high": "⚠️",
        "medium": "⚡",
        "low": "ℹ️",
    }

    lines = [
        "",
        "=" * 60,
        "🔐 SECRETS DETECTED IN OUTPUT",
        "=" * 60,
        "",
    ]

    # Group by severity
    critical = [d for d in detections if d["severity"] == "critical"]
    high = [d for d in detections if d["severity"] == "high"]
    other = [d for d in detections if d["severity"] not in ("critical", "high")]

    if critical:
        lines.append("🚨 CRITICAL:")
        for d in critical:
            lines.append(f"   • {d['name']} - {d['description']}")
        lines.append("")

    if high:
        lines.append("⚠️  HIGH:")
        for d in high:
            lines.append(f"   • {d['name']} - {d['description']}")
        lines.append("")

    if other:
        lines.append("ℹ️  OTHER:")
        for d in other:
            icon = severity_icons.get(d["severity"], "•")
            lines.append(f"   {icon} {d['name']}")
        lines.append("")

    source = file_path or tool_name
    lines.extend([
        f"Source: {source}",
        "",
        "⚡ RECOMMENDED ACTIONS:",
        "   1. Do NOT share this terminal output",
        "   2. Clear terminal history: `history -c`",
        "   3. Rotate exposed credentials immediately",
        "   4. Check ~/.claude/projects/ for cached data",
        "",
        "📋 This detection has been logged to:",
        f"   ~/.claude/security-logs/",
        "",
        "=" * 60,
        "",
    ])

    return "\n".join(lines)


def get_file_path_from_input(tool_name: str, tool_input: dict) -> str:
    """Extract the relevant file path from tool input."""
    if tool_name in ('Read', 'Write', 'Edit'):
        return tool_input.get('file_path', '')
    elif tool_name == 'Bash':
        cmd = tool_input.get('command', '')
        # Try to extract file path from common commands
        for pattern in [r'cat\s+([^\s|>]+)', r'head\s+[^\s]*\s*([^\s|>]+)',
                        r'tail\s+[^\s]*\s*([^\s|>]+)', r'less\s+([^\s]+)',
                        r'grep\s+[^\s]+\s+([^\s|>]+)']:
            match = re.search(pattern, cmd)
            if match:
                return match.group(1)
    return ''


def is_sensitive_file(file_path: str) -> bool:
    """Check if the file path suggests sensitive content."""
    sensitive_patterns = [
        r'\.env',
        r'\.env\.',
        r'credentials',
        r'secrets?',
        r'\.pem$',
        r'\.key$',
        r'\.p12$',
        r'\.pfx$',
        r'id_rsa',
        r'id_ed25519',
        r'\.npmrc',
        r'\.pypirc',
        r'\.netrc',
        r'\.aws/credentials',
        r'\.docker/config\.json',
        r'kubeconfig',
    ]

    file_lower = file_path.lower()
    return any(re.search(p, file_lower) for p in sensitive_patterns)


def main():
    """Main entry point for the secrets scanner hook."""
    try:
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        tool_result = input_data.get('tool_result', '')

        # Convert tool_result to string for scanning
        if isinstance(tool_result, dict):
            content = json.dumps(tool_result)
        else:
            content = str(tool_result) if tool_result else ''

        # Get file path for context (do this early for sensitive file check)
        file_path = get_file_path_from_input(tool_name, tool_input)

        detections = []

        # Check for sensitive file access first (regardless of content length)
        if file_path and is_sensitive_file(file_path):
            detections.append({
                "name": "Sensitive File Access",
                "severity": "medium",
                "description": f"Accessing potentially sensitive file: {file_path}",
                "count": 1,
            })

        # Scan content for secrets if it's long enough to contain them
        if len(content) >= 20:
            content_detections = scan_for_secrets(content)
            detections.extend(content_detections)

        if detections:
            # Log the detection
            log_detection(tool_name, file_path, detections)

            # Format and display warning
            warning = format_warning(detections, tool_name, file_path)

            # Output warning as system message
            output = {
                "systemMessage": warning
            }
            print(json.dumps(output))
        else:
            print(json.dumps({}))

    except Exception as e:
        # On error, don't block - just log to stderr
        print(f"Secrets scanner error: {e}", file=sys.stderr)
        print(json.dumps({}))

    finally:
        sys.exit(0)


if __name__ == '__main__':
    main()
