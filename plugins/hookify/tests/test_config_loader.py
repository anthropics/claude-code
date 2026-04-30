import os
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from hookify.core.config_loader import load_rules, resolve_project_claude_dir


RULE_MARKDOWN = """---
name: project-rule
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: "rm"
action: warn
---
Warn about rm usage.
"""


class ConfigLoaderTests(unittest.TestCase):
    def test_load_rules_uses_claude_project_dir_when_available(self):
        with tempfile.TemporaryDirectory() as td:
            project_root = Path(td)
            rules_dir = project_root / ".claude"
            rules_dir.mkdir()
            (rules_dir / "hookify.project.local.md").write_text(RULE_MARKDOWN)
            subdir = project_root / "subdir"
            subdir.mkdir()

            original_cwd = Path.cwd()
            original_project_dir = os.environ.get("CLAUDE_PROJECT_DIR")
            try:
                os.environ["CLAUDE_PROJECT_DIR"] = str(project_root)
                os.chdir(subdir)
                self.assertEqual(
                    Path(resolve_project_claude_dir()).resolve(),
                    rules_dir.resolve(),
                )
                self.assertEqual(len(load_rules("bash")), 1)
            finally:
                os.chdir(original_cwd)
                if original_project_dir is None:
                    os.environ.pop("CLAUDE_PROJECT_DIR", None)
                else:
                    os.environ["CLAUDE_PROJECT_DIR"] = original_project_dir

    def test_load_rules_finds_project_root_from_nested_directory(self):
        with tempfile.TemporaryDirectory() as td:
            project_root = Path(td)
            rules_dir = project_root / ".claude"
            rules_dir.mkdir()
            (rules_dir / "hookify.project.local.md").write_text(RULE_MARKDOWN)

            nested_dir = project_root / "packages" / "app"
            nested_dir.mkdir(parents=True)

            original_cwd = Path.cwd()
            original_project_dir = os.environ.get("CLAUDE_PROJECT_DIR")
            try:
                os.environ.pop("CLAUDE_PROJECT_DIR", None)
                os.chdir(nested_dir)
                self.assertEqual(
                    Path(resolve_project_claude_dir()).resolve(),
                    rules_dir.resolve(),
                )
                self.assertEqual(len(load_rules("bash")), 1)
            finally:
                os.chdir(original_cwd)
                if original_project_dir is None:
                    os.environ.pop("CLAUDE_PROJECT_DIR", None)
                else:
                    os.environ["CLAUDE_PROJECT_DIR"] = original_project_dir


if __name__ == "__main__":
    unittest.main()
