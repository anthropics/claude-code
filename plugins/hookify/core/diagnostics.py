#!/usr/bin/env python3
"""Diagnostics helpers for hookify rules."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

from .config_loader import Rule, extract_frontmatter, load_rule_file
from .rule_engine import RuleEngine

SUPPORTED_EVENTS = {"bash", "file", "stop", "prompt", "all"}
SUPPORTED_ACTIONS = {"warn", "block"}
SUPPORTED_OPERATORS = {
    "regex_match",
    "contains",
    "equals",
    "not_contains",
    "starts_with",
    "ends_with",
}
SUPPORTED_FIELDS = {
    "command",
    "content",
    "new_text",
    "new_string",
    "old_text",
    "old_string",
    "file_path",
    "reason",
    "transcript",
    "user_prompt",
}


@dataclass
class Diagnostic:
    severity: str
    code: str
    message: str


@dataclass
class RuleReport:
    path: Path
    rule: Rule
    diagnostics: List[Diagnostic] = field(default_factory=list)


@dataclass
class TestReport:
    path: Path
    rule: Rule
    payload: Dict[str, Any]
    matched: bool
    explanation: Dict[str, Any]


def _read_rule(path: Path) -> Rule:
    rule = load_rule_file(str(path))
    if not rule:
        raise ValueError("Could not parse rule file")
    return rule


def _parse_rule_with_frontmatter(path: Path) -> Rule:
    content = path.read_text(encoding="utf-8")
    frontmatter, message = extract_frontmatter(content)
    if not frontmatter:
        raise ValueError("Missing YAML frontmatter")
    return Rule.from_dict(frontmatter, message)


def diagnose_rule(rule: Rule) -> List[Diagnostic]:
    diagnostics: List[Diagnostic] = []

    if rule.event not in SUPPORTED_EVENTS:
        diagnostics.append(
            Diagnostic(
                severity="error",
                code="invalid_event",
                message=f"Unsupported event '{rule.event}'.",
            )
        )

    if rule.action not in SUPPORTED_ACTIONS:
        diagnostics.append(
            Diagnostic(
                severity="error",
                code="invalid_action",
                message=f"Unsupported action '{rule.action}'.",
            )
        )

    if not rule.conditions:
        diagnostics.append(
            Diagnostic(
                severity="error",
                code="missing_conditions",
                message="Rule does not define any effective conditions.",
            )
        )

    for condition in rule.conditions:
        if condition.operator not in SUPPORTED_OPERATORS:
            diagnostics.append(
                Diagnostic(
                    severity="error",
                    code="invalid_operator",
                    message=f"Unsupported operator '{condition.operator}'.",
                )
            )

        if condition.field not in SUPPORTED_FIELDS:
            diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="unknown_field",
                    message=f"Field '{condition.field}' is not a known hookify field.",
                )
            )

        if condition.operator == "regex_match":
            try:
                re.compile(condition.pattern, re.IGNORECASE)
            except re.error as exc:
                diagnostics.append(
                    Diagnostic(
                        severity="error",
                        code="invalid_regex",
                        message=f"Invalid regex '{condition.pattern}': {exc}",
                    )
                )

    return diagnostics


def diagnose_rule_files(rules_dir: Path) -> List[RuleReport]:
    reports: List[RuleReport] = []
    name_to_reports: Dict[str, List[RuleReport]] = {}

    for path in sorted(rules_dir.glob("hookify.*.local.md")):
        try:
            rule = _parse_rule_with_frontmatter(path)
            report = RuleReport(path=path, rule=rule, diagnostics=diagnose_rule(rule))
        except Exception as exc:
            fallback_rule = Rule(
                name=path.stem,
                enabled=False,
                event="all",
                message="",
            )
            report = RuleReport(
                path=path,
                rule=fallback_rule,
                diagnostics=[
                    Diagnostic(
                        severity="error",
                        code="parse_error",
                        message=str(exc),
                    )
                ],
            )

        reports.append(report)
        name_to_reports.setdefault(report.rule.name, []).append(report)

    for duplicate_reports in name_to_reports.values():
        if len(duplicate_reports) < 2:
            continue
        for report in duplicate_reports:
            report.diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="duplicate_rule_name",
                    message=f"Rule name '{report.rule.name}' is duplicated across multiple files.",
                )
            )

    return reports


def build_payload(event: str, field_values: Dict[str, str]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}

    if event == "bash":
        payload["hook_event_name"] = field_values.get("hook_event_name", "PreToolUse")
        payload["tool_name"] = "Bash"
        payload["tool_input"] = {
            "command": field_values.get("command", ""),
        }
        return payload

    if event == "file":
        tool_name = field_values.get("tool_name")
        if not tool_name:
            if "old_text" in field_values or "new_text" in field_values or "new_string" in field_values:
                tool_name = "Edit"
            else:
                tool_name = "Write"

        payload["hook_event_name"] = field_values.get("hook_event_name", "PreToolUse")
        payload["tool_name"] = tool_name
        payload["tool_input"] = {
            "file_path": field_values.get("file_path", ""),
        }
        if tool_name == "Write":
            payload["tool_input"]["content"] = field_values.get(
                "content",
                field_values.get("new_text", field_values.get("new_string", "")),
            )
        else:
            payload["tool_input"]["new_string"] = field_values.get(
                "new_string", field_values.get("new_text", "")
            )
            payload["tool_input"]["old_string"] = field_values.get(
                "old_string", field_values.get("old_text", "")
            )
        return payload

    if event == "stop":
        payload["hook_event_name"] = "Stop"
        payload["reason"] = field_values.get("reason", "")
        payload["transcript"] = field_values.get("transcript", "")
        return payload

    if event == "prompt":
        payload["hook_event_name"] = "UserPromptSubmit"
        payload["user_prompt"] = field_values.get("user_prompt", "")
        return payload

    payload["hook_event_name"] = field_values.get("hook_event_name", "")
    payload["tool_name"] = field_values.get("tool_name", "")
    payload["tool_input"] = field_values.get("tool_input", {})
    return payload


def test_rule_file(rule_path: Path, field_values: Dict[str, str]) -> TestReport:
    rule = _read_rule(rule_path)
    payload = build_payload(rule.event, field_values)
    engine = RuleEngine()
    explanation = engine.explain_rule_match(rule, payload)
    return TestReport(
        path=rule_path,
        rule=rule,
        payload=payload,
        matched=explanation["matched"],
        explanation=explanation,
    )
