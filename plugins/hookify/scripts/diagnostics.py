#!/usr/bin/env python3
"""CLI for hookify diagnostics."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
if str(PLUGIN_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT.parent))
if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from core.diagnostics import diagnose_rule_files, test_rule_file


def cmd_doctor(args: argparse.Namespace) -> int:
    rules_dir = Path(args.rules_dir)
    reports = diagnose_rule_files(rules_dir)

    if args.json:
        print(
            json.dumps(
                [
                    {
                        "path": str(report.path),
                        "rule": report.rule.name,
                        "event": report.rule.event,
                        "diagnostics": [diagnostic.__dict__ for diagnostic in report.diagnostics],
                    }
                    for report in reports
                ],
                indent=2,
            )
        )
        return 0

    if not reports:
        print(f"No hookify rules found in {rules_dir}")
        return 0

    print(f"Hookify doctor checked {len(reports)} rule file(s) in {rules_dir}")
    for report in reports:
        issue_count = len(report.diagnostics)
        status = "OK" if issue_count == 0 else f"{issue_count} issue(s)"
        print(f"\n- {report.path} [{status}]")
        print(f"  name={report.rule.name} event={report.rule.event} action={report.rule.action}")
        for diagnostic in report.diagnostics:
            print(f"  {diagnostic.severity.upper()}: {diagnostic.code} - {diagnostic.message}")

    return 0


def cmd_test(args: argparse.Namespace) -> int:
    values = {}
    for item in args.value:
        if "=" not in item:
            raise SystemExit(f"Invalid --value '{item}'. Use field=value.")
        key, value = item.split("=", 1)
        values[key] = value

    report = test_rule_file(Path(args.rule_file), values)

    if args.json:
        print(
            json.dumps(
                {
                    "path": str(report.path),
                    "rule": report.rule.name,
                    "matched": report.matched,
                    "payload": report.payload,
                    "explanation": report.explanation,
                },
                indent=2,
            )
        )
        return 0

    print(f"Rule: {report.rule.name}")
    print(f"File: {report.path}")
    print(f"Matched: {'yes' if report.matched else 'no'}")
    print("Payload:")
    print(json.dumps(report.payload, indent=2))
    print("Condition results:")
    for condition in report.explanation["conditions"]:
        print(
            f"- {condition['field']} {condition['operator']} {condition['pattern']!r}"
            f" => {'matched' if condition['matched'] else 'not matched'}"
        )
        print(f"  value: {condition['value']!r}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Hookify diagnostics")
    subparsers = parser.add_subparsers(dest="command", required=True)

    doctor_parser = subparsers.add_parser("doctor", help="Diagnose hookify rules")
    doctor_parser.add_argument("--rules-dir", default=".claude")
    doctor_parser.add_argument("--json", action="store_true")
    doctor_parser.set_defaults(func=cmd_doctor)

    test_parser = subparsers.add_parser("test", help="Test a hookify rule")
    test_parser.add_argument("--rule-file", required=True)
    test_parser.add_argument("--value", action="append", default=[])
    test_parser.add_argument("--json", action="store_true")
    test_parser.set_defaults(func=cmd_test)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
