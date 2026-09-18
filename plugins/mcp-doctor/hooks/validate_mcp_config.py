#!/usr/bin/env python3
"""
MCP Configuration Validator

Validates .mcp.json files with thorough diagnostics that go beyond the
built-in /doctor checks. Catches false positives caused by encoding issues,
caching, and parser quirks that the built-in validator misses.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional


class Severity:
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class Diagnostic:
    """A single validation finding."""

    def __init__(self, severity: str, message: str, file_path: str = "",
                 line: Optional[int] = None, column: Optional[int] = None,
                 suggestion: Optional[str] = None):
        self.severity = severity
        self.message = message
        self.file_path = file_path
        self.line = line
        self.column = column
        self.suggestion = suggestion

    def format(self) -> str:
        icon = {"error": "[ERROR]", "warning": "[WARN]", "info": "[INFO]"}
        prefix = icon.get(self.severity, "[?]")
        location = ""
        if self.line is not None:
            location = f" (line {self.line}"
            if self.column is not None:
                location += f", col {self.column}"
            location += ")"
        msg = f"  {prefix} {self.message}{location}"
        if self.suggestion:
            msg += f"\n         -> {self.suggestion}"
        return msg


def find_mcp_configs(start_dir: str) -> list[str]:
    """Walk up from start_dir to filesystem root, collecting .mcp.json paths."""
    configs = []
    current = Path(start_dir).resolve()
    root = Path(current.anchor)

    while current != root:
        candidate = current / ".mcp.json"
        if candidate.is_file():
            configs.append(str(candidate))
        current = current.parent

    # Reverse so we process from root downward (matching merge order)
    configs.reverse()
    return configs


def check_encoding(raw_bytes: bytes, file_path: str) -> list[Diagnostic]:
    """Check for BOM, encoding issues, and invisible characters."""
    diagnostics = []

    # Check for BOM
    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        diagnostics.append(Diagnostic(
            Severity.WARNING,
            "File has UTF-8 BOM (byte order mark)",
            file_path,
            suggestion="Remove BOM: the built-in validator may fail on BOM-prefixed files. "
                       "Fix with: sed -i '1s/^\\xEF\\xBB\\xBF//' .mcp.json"
        ))
    elif raw_bytes.startswith(b"\xff\xfe") or raw_bytes.startswith(b"\xfe\xff"):
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            "File uses UTF-16 encoding (detected BOM)",
            file_path,
            suggestion="Convert to UTF-8: iconv -f UTF-16 -t UTF-8 .mcp.json > .mcp.json.tmp && "
                       "mv .mcp.json.tmp .mcp.json"
        ))

    # Check for null bytes (indicates binary or UTF-16 without BOM)
    if b"\x00" in raw_bytes:
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            "File contains null bytes (possible binary or UTF-16 encoding)",
            file_path,
            suggestion="Ensure the file is saved as UTF-8 without BOM"
        ))

    # Check for common invisible characters that break JSON parsing
    try:
        text = raw_bytes.decode("utf-8-sig")  # strips BOM if present
        problematic_chars = {
            "\u200b": "zero-width space",
            "\u200c": "zero-width non-joiner",
            "\u200d": "zero-width joiner",
            "\ufeff": "zero-width no-break space (mid-file BOM)",
            "\u00a0": "non-breaking space",
            "\u2028": "line separator",
            "\u2029": "paragraph separator",
        }
        for char, name in problematic_chars.items():
            if char in text:
                pos = text.index(char)
                line_num = text[:pos].count("\n") + 1
                diagnostics.append(Diagnostic(
                    Severity.WARNING,
                    f"Contains invisible character: {name} (U+{ord(char):04X})",
                    file_path,
                    line=line_num,
                    suggestion=f"Remove invisible characters. "
                               f"Hex dump: xxd .mcp.json | grep -n '{ord(char):02x}'"
                ))
    except UnicodeDecodeError as e:
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            f"File is not valid UTF-8: {e}",
            file_path,
            suggestion="Re-save the file as UTF-8"
        ))

    return diagnostics


def check_json_syntax(text: str, file_path: str) -> tuple[Optional[dict], list[Diagnostic]]:
    """Parse JSON with detailed error reporting."""
    diagnostics = []

    # Strip BOM if present
    if text.startswith("\ufeff"):
        text = text[1:]

    # Check for common JSON mistakes before parsing
    # Trailing commas
    trailing_comma = re.search(r',\s*[}\]]', text)
    if trailing_comma:
        pos = trailing_comma.start()
        line_num = text[:pos].count("\n") + 1
        diagnostics.append(Diagnostic(
            Severity.WARNING,
            "Possible trailing comma detected (not valid in JSON)",
            file_path,
            line=line_num,
            suggestion="Remove the trailing comma before } or ]"
        ))

    # Single-line comments
    if re.search(r'(?<!:)//[^\n]*', text):
        diagnostics.append(Diagnostic(
            Severity.WARNING,
            "File may contain // comments (not valid in JSON)",
            file_path,
            suggestion="Remove comments or use JSONC-aware tooling. "
                       "Standard JSON does not allow comments."
        ))

    # Multi-line comments
    if "/*" in text:
        diagnostics.append(Diagnostic(
            Severity.WARNING,
            "File may contain /* */ block comments (not valid in JSON)",
            file_path,
            suggestion="Remove block comments"
        ))

    # Attempt parse
    try:
        parsed = json.loads(text)
        return parsed, diagnostics
    except json.JSONDecodeError as e:
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            f"JSON parse error: {e.msg}",
            file_path,
            line=e.lineno,
            column=e.colno,
            suggestion=f"Fix the syntax at line {e.lineno}, column {e.colno}. "
                       f"Context: ...{text[max(0, e.pos - 20):e.pos + 20]}..."
        ))
        return None, diagnostics


def check_schema(config: dict, file_path: str) -> list[Diagnostic]:
    """Validate the MCP config schema structure."""
    diagnostics = []

    if not isinstance(config, dict):
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            f"Config root must be an object, got {type(config).__name__}",
            file_path,
            suggestion="Wrap your config in { \"mcpServers\": { ... } }"
        ))
        return diagnostics

    if "mcpServers" not in config:
        # Check if servers are at the root level (common mistake)
        has_server_like_keys = any(
            isinstance(v, dict) and ("command" in v or "url" in v)
            for v in config.values()
        )
        if has_server_like_keys:
            diagnostics.append(Diagnostic(
                Severity.ERROR,
                "Server definitions found at root level instead of under 'mcpServers'",
                file_path,
                suggestion="Wrap your servers: { \"mcpServers\": { <your servers here> } }"
            ))
        else:
            diagnostics.append(Diagnostic(
                Severity.WARNING,
                "Missing 'mcpServers' key",
                file_path,
                suggestion="Add a 'mcpServers' object containing your server definitions"
            ))
        return diagnostics

    servers = config["mcpServers"]
    if not isinstance(servers, dict):
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            f"'mcpServers' must be an object, got {type(servers).__name__}",
            file_path
        ))
        return diagnostics

    for name, server in servers.items():
        if not isinstance(server, dict):
            diagnostics.append(Diagnostic(
                Severity.ERROR,
                f"Server '{name}' must be an object, got {type(server).__name__}",
                file_path
            ))
            continue

        server_type = server.get("type", "stdio")  # default is stdio

        if server_type == "stdio":
            if "command" not in server:
                diagnostics.append(Diagnostic(
                    Severity.ERROR,
                    f"Server '{name}' (stdio): missing required 'command' field",
                    file_path,
                    suggestion=f"Add \"command\": \"<executable>\" to the '{name}' server config"
                ))
            if "url" in server:
                diagnostics.append(Diagnostic(
                    Severity.WARNING,
                    f"Server '{name}': has 'url' field but type is 'stdio' (url is ignored)",
                    file_path,
                    suggestion="Remove 'url' or change type to 'sse', 'http', or 'ws'"
                ))
        elif server_type in ("sse", "http", "ws"):
            if "url" not in server:
                diagnostics.append(Diagnostic(
                    Severity.ERROR,
                    f"Server '{name}' ({server_type}): missing required 'url' field",
                    file_path,
                    suggestion=f"Add \"url\": \"<server-url>\" to the '{name}' server config"
                ))
            if "command" in server:
                diagnostics.append(Diagnostic(
                    Severity.WARNING,
                    f"Server '{name}': has 'command' field but type is '{server_type}' "
                    f"(command is ignored)",
                    file_path,
                    suggestion="Remove 'command' or change type to 'stdio'"
                ))
        else:
            diagnostics.append(Diagnostic(
                Severity.WARNING,
                f"Server '{name}': unknown type '{server_type}'",
                file_path,
                suggestion="Valid types: 'stdio', 'sse', 'http', 'ws'"
            ))

        # Check env vars
        env = server.get("env", {})
        if isinstance(env, dict):
            for key, val in env.items():
                if not isinstance(val, str):
                    diagnostics.append(Diagnostic(
                        Severity.WARNING,
                        f"Server '{name}': env var '{key}' should be a string, "
                        f"got {type(val).__name__}",
                        file_path,
                        suggestion=f"Change to: \"{key}\": \"{val}\""
                    ))

        # Check args
        args = server.get("args", [])
        if not isinstance(args, list):
            diagnostics.append(Diagnostic(
                Severity.ERROR,
                f"Server '{name}': 'args' must be an array, got {type(args).__name__}",
                file_path
            ))
        elif args:
            for i, arg in enumerate(args):
                if not isinstance(arg, str):
                    diagnostics.append(Diagnostic(
                        Severity.WARNING,
                        f"Server '{name}': args[{i}] should be a string, "
                        f"got {type(arg).__name__}",
                        file_path
                    ))

    return diagnostics


def validate_file(file_path: str) -> list[Diagnostic]:
    """Run all validation checks on a single .mcp.json file."""
    diagnostics = []

    # Read raw bytes for encoding checks
    try:
        raw_bytes = Path(file_path).read_bytes()
    except OSError as e:
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            f"Cannot read file: {e}",
            file_path
        ))
        return diagnostics

    if len(raw_bytes) == 0:
        diagnostics.append(Diagnostic(
            Severity.ERROR,
            "File is empty",
            file_path,
            suggestion="Add MCP server configuration: { \"mcpServers\": { ... } }"
        ))
        return diagnostics

    # Encoding checks
    diagnostics.extend(check_encoding(raw_bytes, file_path))

    # Decode to text
    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        # Already reported in check_encoding
        return diagnostics

    # JSON syntax check
    parsed, syntax_diags = check_json_syntax(text, file_path)
    diagnostics.extend(syntax_diags)

    if parsed is None:
        return diagnostics

    # Schema validation
    diagnostics.extend(check_schema(parsed, file_path))

    return diagnostics


def format_report(all_results: dict[str, list[Diagnostic]], is_hook: bool = False) -> str:
    """Format validation results as a human-readable report."""
    lines = []
    total_errors = 0
    total_warnings = 0

    for file_path, diagnostics in all_results.items():
        errors = [d for d in diagnostics if d.severity == Severity.ERROR]
        warnings = [d for d in diagnostics if d.severity == Severity.WARNING]
        infos = [d for d in diagnostics if d.severity == Severity.INFO]

        total_errors += len(errors)
        total_warnings += len(warnings)

        if not diagnostics:
            if not is_hook:
                lines.append(f"  [OK] {file_path}")
            continue

        status = "[FAIL]" if errors else "[WARN]"
        lines.append(f"  {status} {file_path}")
        for d in diagnostics:
            lines.append(d.format())

    if not lines:
        if not is_hook:
            return "No .mcp.json files found in the project hierarchy."
        return ""

    header = "MCP Configuration Validation"
    separator = "=" * len(header)

    report_lines = [separator, header, separator, ""]
    report_lines.extend(lines)
    report_lines.append("")

    if total_errors == 0 and total_warnings == 0:
        report_lines.append("All configs are valid.")
    else:
        summary_parts = []
        if total_errors:
            summary_parts.append(f"{total_errors} error{'s' if total_errors != 1 else ''}")
        if total_warnings:
            summary_parts.append(
                f"{total_warnings} warning{'s' if total_warnings != 1 else ''}"
            )
        report_lines.append(f"Found: {', '.join(summary_parts)}")
        if total_errors:
            report_lines.append("")
            report_lines.append(
                "NOTE: If the built-in /doctor reports 'MCP config is not a valid JSON'")
            report_lines.append(
                "but this validator shows no errors, the issue is likely a false positive")
            report_lines.append(
                "in the built-in JSON parser cache. Restarting the session may resolve it.")

    report_lines.append(separator)
    return "\n".join(report_lines)


def main():
    is_hook = "--hook" in sys.argv

    if is_hook:
        # Read hook input from stdin (SessionStart provides session data)
        try:
            raw = sys.stdin.read()
            if raw.strip():
                input_data = json.loads(raw)
            else:
                input_data = {}
        except (json.JSONDecodeError, IOError):
            input_data = {}

        # In hook mode, only report errors (not successes)
        cwd = input_data.get("cwd", os.getcwd())
    else:
        cwd = os.getcwd()

    configs = find_mcp_configs(cwd)

    # Also check user-level config locations
    home = Path.home()
    config_dir = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(home / ".claude")))
    user_settings = config_dir / "settings.json"
    user_local_settings = config_dir / "settings.local.json"

    all_results: dict[str, list[Diagnostic]] = {}

    # Validate .mcp.json files from the directory hierarchy
    for config_path in configs:
        all_results[config_path] = validate_file(config_path)

    # Check user settings for inline mcpServers
    for settings_path in [user_settings, user_local_settings]:
        if settings_path.is_file():
            try:
                text = settings_path.read_text(encoding="utf-8-sig")
                settings = json.loads(text)
                if "mcpServers" in settings and isinstance(settings["mcpServers"], dict):
                    # Validate the inline config structure
                    inline_config = {"mcpServers": settings["mcpServers"]}
                    diags = check_schema(inline_config, str(settings_path))
                    if diags:
                        all_results[f"{settings_path} (inline mcpServers)"] = diags
            except (json.JSONDecodeError, OSError):
                pass  # Settings file issues are handled elsewhere

    if not all_results and not is_hook:
        print("No .mcp.json files found in the project hierarchy.", file=sys.stderr)
        print("Searched from:", cwd, file=sys.stderr)
        sys.exit(0)

    has_errors = any(
        any(d.severity == Severity.ERROR for d in diags)
        for diags in all_results.values()
    )

    report = format_report(all_results, is_hook=is_hook)

    if is_hook:
        # In hook mode, only output if there are issues
        if has_errors or any(
            any(d.severity == Severity.WARNING for d in diags)
            for diags in all_results.values()
        ):
            print(report, file=sys.stderr)
        # Hook should always exit 0 to not block session start
        sys.exit(0)
    else:
        # In command mode, always show full report
        print(report)
        sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
