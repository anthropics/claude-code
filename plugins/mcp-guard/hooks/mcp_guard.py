#!/usr/bin/env python3
"""
MCP Guard - secret exposure detection hook for MCP configurations.

This hook fires after Bash commands that match 'claude mcp get' and
after edits to MCP config files. It checks whether any secret values
would be exposed and warns the user.
"""

import json
import os
import re
import sys

SENSITIVE_HEADER_PATTERNS = re.compile(
    r"(authorization|x-api-key|api-key|token|cookie|set-cookie|"
    r"secret|credential|x-secret|x-token|apikey)",
    re.IGNORECASE,
)

SECRET_VALUE_PATTERNS = re.compile(
    r"(Bearer\s+\S+|Basic\s+\S+|sk-[a-zA-Z0-9]{10,}|"
    r"ghp_[a-zA-Z0-9]{10,}|gho_[a-zA-Z0-9]{10,}|"
    r"key\s*=\s*\S+|token\s*=\s*\S+|secret\s*=\s*\S+)",
    re.IGNORECASE,
)

ENV_VAR_PATTERN = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*")

RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"


def find_mcp_configs():
    """Find all MCP config files."""
    configs = []

    project_config = os.path.join(os.getcwd(), ".claude", "mcp.json")
    if os.path.exists(project_config):
        configs.append(("project", project_config))

    global_config = os.path.join(
        os.path.expanduser("~"), ".claude", "mcp.json"
    )
    if os.path.exists(global_config):
        configs.append(("global", global_config))

    return configs


def has_plaintext_secrets(config_data):
    """Check if any MCP server config has plaintext secrets."""
    findings = []

    servers = {}
    if isinstance(config_data, dict):
        if "mcpServers" in config_data:
            servers = config_data["mcpServers"]
        elif "servers" in config_data:
            servers = config_data["servers"]
        elif all(isinstance(v, dict) for v in config_data.values()):
            servers = config_data

    for name, cfg in servers.items():
        if not isinstance(cfg, dict):
            continue

        headers = {}
        if "headers" in cfg and isinstance(cfg["headers"], dict):
            headers = cfg["headers"]
        elif "header" in cfg and isinstance(cfg["header"], list):
            for h in cfg["header"]:
                if ":" in str(h):
                    k, v = str(h).split(":", 1)
                    headers[k.strip()] = v.strip()

        for header_name, header_value in headers.items():
            if SENSITIVE_HEADER_PATTERNS.search(header_name):
                str_val = str(header_value)
                if SECRET_VALUE_PATTERNS.search(str_val):
                    if not ENV_VAR_PATTERN.search(str_val):
                        findings.append(
                            {
                                "server": name,
                                "header": header_name,
                                "severity": "CRITICAL",
                                "message": (
                                    f"Header '{header_name}' in server '{name}' "
                                    f"contains a plaintext secret value"
                                ),
                            }
                        )

        if "apiKey" in cfg and isinstance(cfg["apiKey"], str):
            key_val = cfg["apiKey"]
            if key_val and not ENV_VAR_PATTERN.search(key_val):
                findings.append(
                    {
                        "server": name,
                        "header": "apiKey",
                        "severity": "CRITICAL",
                        "message": (
                            f"Field 'apiKey' in server '{name}' "
                            f"contains a plaintext secret"
                        ),
                    }
                )

        url = cfg.get("url", "")
        if isinstance(url, str) and "@" in url and "://" in url:
            findings.append(
                {
                    "server": name,
                    "header": "url",
                    "severity": "HIGH",
                    "message": (
                        f"URL in server '{name}' contains embedded "
                        f"credentials (user:password@host)"
                    ),
                }
            )

    return findings


def check_recent_command():
    """Check if the recent bash command was claude mcp get."""
    log_dir = os.path.join(os.path.expanduser("~"), ".claude")
    for fname in sorted(os.listdir(log_dir), reverse=True)[:5]:
        fpath = os.path.join(log_dir, fname)
        if fname.endswith(".log") and os.path.isfile(fpath):
            try:
                with open(fpath, "r", errors="replace") as f:
                    content = f.read()
                    if "claude mcp get" in content:
                        return True
            except (IOError, OSError):
                pass
    return False


def main():
    findings = []
    configs = find_mcp_configs()

    for scope, path in configs:
        try:
            with open(path, "r") as f:
                data = json.load(f)
            server_findings = has_plaintext_secrets(data)
            for f_ in server_findings:
                f_["config"] = scope
            findings.extend(server_findings)
        except (json.JSONDecodeError, IOError, OSError):
            pass

    if findings:
        critical = [f for f in findings if f["severity"] == "CRITICAL"]
        high = [f for f in findings if f["severity"] == "HIGH"]

        print(
            f"\n{BOLD}{RED}MCP Guard detected potential security issues:{RESET}",
            flush=True,
        )

        if critical:
            print(
                f"\n{RED}CRITICAL: {len(critical)} plaintext secret(s) "
                f"found in MCP config{RESET}",
                flush=True,
            )
            for f_ in critical:
                print(f"  - {f_['message']}", flush=True)
            print(
                f"\n  {YELLOW}These secrets would be exposed in plaintext "
                f"by 'claude mcp get'.{RESET}",
                flush=True,
            )
            print(
                f"  {YELLOW}Use environment variables instead: "
                f"${YELLOW}{BOLD}{{YOUR_VAR}}{RESET}{YELLOW} in config, "
                f"then export it before running Claude Code.{RESET}",
                flush=True,
            )

        if high:
            print(
                f"\n{YELLOW}HIGH: {len(high)} security concern(s){RESET}",
                flush=True,
            )
            for f_ in high:
                print(f"  - {f_['message']}", flush=True)

        print(
            f"\n  Run {BOLD}/mcp-guard:audit{RESET} for a full security "
            f"scan with remediation steps.",
            flush=True,
        )
        print(
            f"  Run {BOLD}/mcp-guard:inspect <server>{RESET} to safely "
            f"view config with secrets redacted.",
            flush=True,
        )

    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
