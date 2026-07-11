#!/usr/bin/env python3
"""Runtime contract tests for the plugin-settings examples and helpers."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = ROOT / "plugins" / "plugin-dev" / "skills" / "plugin-settings"
PARSER = SKILL_ROOT / "scripts" / "parse-frontmatter.sh"
VALIDATOR = SKILL_ROOT / "scripts" / "validate-settings.sh"
EXAMPLE_HOOK = SKILL_ROOT / "examples" / "read-settings-hook.sh"


class PluginSettingsContractTests(unittest.TestCase):
    def write_settings(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")

    def test_parser_stops_at_the_first_closing_frontmatter_marker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = Path(temporary_directory) / "settings.local.md"
            self.write_settings(
                settings,
                """
                ---
                enabled: true
                ---
                # Notes
                ---
                enabled: false
                ---
                """,
            )

            completed = subprocess.run(
                ["bash", str(PARSER), str(settings), "enabled"],
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(0, completed.returncode, completed.stderr)
            self.assertEqual("true", completed.stdout.strip())

    def test_validator_rejects_nonleading_and_malformed_yaml(self) -> None:
        invalid_documents = {
            "nonleading-frontmatter": """
                # Settings
                ---
                enabled: true
                ---
            """,
            "malformed-yaml": """
                ---
                enabled: true
                broken: [
                ---
            """,
            "invalid-common-boolean": """
                ---
                enabled: maybe
                ---
            """,
        }

        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            for case_name, content in invalid_documents.items():
                with self.subTest(case=case_name):
                    settings = temporary / f"{case_name}.local.md"
                    self.write_settings(settings, content)
                    completed = subprocess.run(
                        ["bash", str(VALIDATOR), str(settings)],
                        text=True,
                        capture_output=True,
                        check=False,
                    )
                    self.assertNotEqual(
                        0,
                        completed.returncode,
                        f"stdout={completed.stdout}\nstderr={completed.stderr}",
                    )

    def run_example_hook(
        self, project: Path, process_cwd: Path, payload: dict
    ) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        environment["CLAUDE_PROJECT_DIR"] = str(project)
        return subprocess.run(
            ["bash", str(EXAMPLE_HOOK)],
            input=json.dumps(payload),
            text=True,
            cwd=process_cwd,
            env=environment,
            capture_output=True,
            check=False,
        )

    def test_example_hook_uses_defaults_for_optional_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project = Path(temporary_directory) / "project"
            project.mkdir()
            self.write_settings(
                project / ".claude" / "my-plugin.local.md",
                """
                ---
                enabled: true
                mode: standard
                ---
                # Basic settings
                """,
            )
            payload = {
                "cwd": str(project),
                "tool_name": "Write",
                "tool_input": {"file_path": "notes.txt", "content": "safe"},
            }

            completed = self.run_example_hook(project, project, payload)

            self.assertEqual(0, completed.returncode, completed.stderr)

    def test_example_hook_resolves_project_settings_from_nested_cwd(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project = Path(temporary_directory) / "project"
            nested_cwd = project / "src" / "nested"
            nested_cwd.mkdir(parents=True)
            self.write_settings(
                project / ".claude" / "my-plugin.local.md",
                """
                ---
                enabled: true
                strict_mode: true
                max_file_size: 1000
                ---
                """,
            )
            payload = {
                "cwd": str(project),
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": ".env", "content": "SECRET=value"},
            }

            completed = self.run_example_hook(project, nested_cwd, payload)

            self.assertEqual(2, completed.returncode, completed.stderr)
            self.assertIn("Sensitive file blocked", completed.stderr)

    def test_recommended_examples_use_the_shared_parser(self) -> None:
        unsafe_extraction = "sed -n '/^---$/,/^---$/{ /^---$/d; p; }'"
        documents = (
            SKILL_ROOT / "SKILL.md",
            SKILL_ROOT / "references" / "parsing-techniques.md",
            SKILL_ROOT / "references" / "real-world-examples.md",
            SKILL_ROOT / "examples" / "example-settings.md",
        )

        for document in documents:
            with self.subTest(document=document.name):
                content = document.read_text(encoding="utf-8")
                self.assertNotIn(unsafe_extraction, content)
                self.assertIn("parse-frontmatter.sh", content)


if __name__ == "__main__":
    unittest.main()
