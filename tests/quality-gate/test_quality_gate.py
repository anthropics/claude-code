#!/usr/bin/env python3
"""Repository-wide quality gate contract tests."""

import json
import re
import subprocess
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

EXPECTED_PLUGIN_VERSIONS = {
    "agent-sdk-dev": "1.0.1",
    "claude-opus-4-5-migration": "1.0.1",
    "code-review": "1.0.1",
    "commit-commands": "1.0.1",
    "explanatory-output-style": "1.0.1",
    "feature-dev": "1.0.1",
    "hookify": "0.1.1",
    "learning-output-style": "1.0.1",
    "plugin-dev": "0.1.1",
    "pr-review-toolkit": "1.0.1",
    "ralph-wiggum": "1.0.1",
    "security-guidance": "1.0.1",
}
EXPECTED_BUN_VERSION = "1.3.7"


class QualityGateContractTests(unittest.TestCase):
    def test_repository_runner_has_required_checks(self) -> None:
        runner = REPOSITORY_ROOT / "scripts" / "test-repository.sh"
        self.assertTrue(runner.is_file(), "repository test runner is missing")
        self.assertTrue(runner.stat().st_mode & 0o111, "repository test runner is not executable")

        content = runner.read_text(encoding="utf-8")
        for contract in (
            "set -euo pipefail",
            "bash -n",
            "ast.parse",
            "jq empty",
            "Psych.safe_load",
            "validate-hook-schema.sh",
            "plugins/*/hooks/hooks.json",
            "bun test tests/automation",
            "plugins/hookify/tests",
            "tests/data-safety",
            "tests/developer-experience",
            "tests/validator-security",
            "tests/quality-gate",
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, content)

        self.assertIn("-z", content, "repository paths must be NUL-delimited")
        self.assertNotIn("test-repository.sh\"", content.split("python_suites=", 1)[-1])

    def test_content_quality_workflow_contract(self) -> None:
        workflow = REPOSITORY_ROOT / ".github" / "workflows" / "content-quality.yml"
        self.assertTrue(workflow.is_file(), "content quality workflow is missing")

        subprocess.run(
            [
                "ruby",
                "-rpsych",
                "-e",
                "Psych.safe_load(File.read(ARGV.fetch(0)), [], [], false, filename: ARGV.fetch(0))",
                str(workflow),
            ],
            check=True,
            cwd=REPOSITORY_ROOT,
        )

        content = workflow.read_text(encoding="utf-8")
        for pattern in (
            r"(?m)^on:\s*$",
            r"(?m)^\s{2}pull_request:\s*$",
            r"(?m)^\s{2}push:\s*$",
            r"(?m)^\s{6}- main\s*$",
            r"(?m)^\s{2}workflow_dispatch:\s*$",
            r"(?ms)^permissions:\s*\n\s{2}contents: read\s*$",
            r"(?m)^concurrency:\s*$",
            r"uses: oven-sh/setup-bun@v2",
            rf"bun-version: [\"']?{re.escape(EXPECTED_BUN_VERSION)}[\"']?",
            r"uses: actions/setup-python@v5",
            r"python-version: [\"']3\.11[\"']",
            r"ruby --version",
            r"jq --version",
            r"\./scripts/test-repository\.sh",
        ):
            with self.subTest(pattern=pattern):
                self.assertRegex(content, pattern)

    def test_workflow_bun_versions_match_quality_gate(self) -> None:
        workflow_directory = REPOSITORY_ROOT / ".github" / "workflows"
        workflows = sorted(
            path
            for path in workflow_directory.iterdir()
            if path.suffix in {".yml", ".yaml"}
        )
        setup_workflows = []

        for workflow in workflows:
            content = workflow.read_text(encoding="utf-8")
            setup_count = len(
                re.findall(r"uses:\s*oven-sh/setup-bun@", content)
            )
            if setup_count == 0:
                continue

            setup_workflows.append(workflow.name)
            versions = re.findall(
                r"(?m)^\s*bun-version:\s*[\"']?([^\"'\s]+)[\"']?\s*$",
                content,
            )
            with self.subTest(workflow=workflow.name):
                self.assertEqual(
                    len(versions),
                    setup_count,
                    "every setup-bun step must declare a version",
                )
                self.assertEqual(set(versions), {EXPECTED_BUN_VERSION})
                self.assertNotIn("bun-version: latest", content)

        self.assertGreater(len(setup_workflows), 1)

    def test_changed_plugin_versions_match_marketplace(self) -> None:
        marketplace_path = REPOSITORY_ROOT / ".claude-plugin" / "marketplace.json"
        marketplace = json.loads(marketplace_path.read_text(encoding="utf-8"))
        self.assertEqual(marketplace["version"], "1.0.1")

        entries = {entry["name"]: entry for entry in marketplace["plugins"]}
        for plugin_name, entry in entries.items():
            manifest_path = (
                REPOSITORY_ROOT
                / entry["source"]
                / ".claude-plugin"
                / "plugin.json"
            )
            if not manifest_path.exists():
                continue
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            with self.subTest(all_marketplace_plugins=plugin_name):
                self.assertEqual(entry.get("version"), manifest.get("version"))

        for plugin_name, expected_version in EXPECTED_PLUGIN_VERSIONS.items():
            with self.subTest(plugin=plugin_name):
                self.assertIn(plugin_name, entries)
                self.assertEqual(entries[plugin_name].get("version"), expected_version)

                manifest_path = (
                    REPOSITORY_ROOT
                    / "plugins"
                    / plugin_name
                    / ".claude-plugin"
                    / "plugin.json"
                )
                if plugin_name == "plugin-dev":
                    self.assertFalse(manifest_path.exists())
                    continue

                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                self.assertEqual(manifest["name"], plugin_name)
                self.assertEqual(manifest["version"], expected_version)


if __name__ == "__main__":
    unittest.main()
