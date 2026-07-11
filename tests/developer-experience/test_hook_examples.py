#!/usr/bin/env python3
"""Executable contracts for hook-development and plugin examples."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[2]
HOOK_SKILL = ROOT / "plugins/plugin-dev/skills/hook-development"
LOAD_CONTEXT = HOOK_SKILL / "examples/load-context.sh"
TEST_HOOK = HOOK_SKILL / "scripts/test-hook.sh"
HOOK_SCHEMA_VALIDATOR = HOOK_SKILL / "scripts/validate-hook-schema.sh"
ADVANCED_REFERENCE = HOOK_SKILL / "references/advanced.md"
STANDARD_PLUGIN = (
    ROOT / "plugins/plugin-dev/skills/plugin-structure/examples/standard-plugin.md"
)


def run(command, *, cwd, env=None, input_text=None):
    return subprocess.run(
        [str(part) for part in command],
        cwd=cwd,
        env=env,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
    )


def extract_bash_block_after_heading(document: Path, heading: str) -> str:
    content = document.read_text(encoding="utf-8")
    section = content.split(heading, 1)[1]
    match = re.search(r"```bash\n(.*?)\n```", section, flags=re.DOTALL)
    if not match:
        raise AssertionError(f"missing bash example after {heading}")
    return textwrap.dedent(match.group(1)) + "\n"


class HookExampleContractTests(unittest.TestCase):
    def test_load_context_detects_github_workflow_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory) / "project"
            (project / ".github/workflows").mkdir(parents=True)
            environment_file = Path(directory) / "claude-env"
            environment = os.environ.copy()
            environment.update(
                {
                    "CLAUDE_PROJECT_DIR": str(project),
                    "CLAUDE_ENV_FILE": str(environment_file),
                }
            )

            result = run(["bash", LOAD_CONTEXT], cwd=project, env=environment)

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertIn(
                "export HAS_CI=true",
                environment_file.read_text(encoding="utf-8"),
            )

    def test_hook_runner_preserves_a_caller_owned_environment_file(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            hook = workdir / "hook.sh"
            hook.write_text("#!/bin/bash\ncat >/dev/null\n", encoding="utf-8")
            hook.chmod(0o755)
            hook_input = workdir / "input.json"
            hook_input.write_text("{}\n", encoding="utf-8")
            environment_file = workdir / "caller-owned.env"
            environment_file.write_text("KEEP=1\n", encoding="utf-8")
            environment = os.environ.copy()
            environment["CLAUDE_ENV_FILE"] = str(environment_file)

            result = run(
                ["bash", TEST_HOOK, "-t", "5", hook, hook_input],
                cwd=workdir,
                env=environment,
            )

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertTrue(environment_file.is_file())
            self.assertEqual("KEEP=1\n", environment_file.read_text(encoding="utf-8"))

    def test_hook_runner_uses_a_private_project_when_none_is_provided(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            existing_project = workdir / "existing-project"
            existing_project.mkdir()
            sentinel = existing_project / "keep.txt"
            sentinel.write_text("keep\n", encoding="utf-8")
            project_log = workdir / "project-path.txt"

            hook = workdir / "hook.sh"
            hook.write_text(
                "#!/bin/bash\n"
                'printf \'clobbered\\n\' > "$CLAUDE_PROJECT_DIR/keep.txt"\n'
                'printf \'%s\\n\' "$CLAUDE_PROJECT_DIR" > "$PROJECT_LOG"\n'
                "cat >/dev/null\n",
                encoding="utf-8",
            )
            hook.chmod(0o755)
            hook_input = workdir / "input.json"
            hook_input.write_text("{}\n", encoding="utf-8")

            # Redirect the old fixed default into this fixture. The repaired
            # helper has no such line and therefore leaves the copy unchanged.
            runner = workdir / "test-hook.sh"
            vulnerable_default = (
                'export CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/tmp/test-project}"'
            )
            isolated_default = (
                'export CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-'
                f'{existing_project}'
                '}"'
            )
            runner.write_text(
                TEST_HOOK.read_text(encoding="utf-8").replace(
                    vulnerable_default, isolated_default
                ),
                encoding="utf-8",
            )
            environment = os.environ.copy()
            environment.pop("CLAUDE_PROJECT_DIR", None)
            environment.pop("CLAUDE_ENV_FILE", None)
            environment.update(
                {"PROJECT_LOG": str(project_log), "TMPDIR": str(workdir)}
            )

            result = run(
                ["bash", runner, "-t", "5", hook, hook_input],
                cwd=workdir,
                env=environment,
            )

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertEqual("keep\n", sentinel.read_text(encoding="utf-8"))
            private_project = Path(project_log.read_text(encoding="utf-8").strip())
            self.assertFalse(private_project.exists(), "private test project leaked")

    def test_hook_schema_rejects_an_invalid_matcher_regex(self):
        document = {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "[",
                        "hooks": [{"type": "command", "command": "true"}],
                    }
                ]
            }
        }
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "hooks.json"
            fixture.write_text(json.dumps(document), encoding="utf-8")

            result = run(["bash", HOOK_SCHEMA_VALIDATOR, fixture], cwd=ROOT)

        self.assertNotEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("invalid regular expression", result.stdout)

    def test_integration_example_does_not_delete_an_existing_project(self):
        script = extract_bash_block_after_heading(
            ADVANCED_REFERENCE, "### Integration Testing"
        )
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            existing_project = workdir / "existing-project"
            existing_project.mkdir()
            sentinel = existing_project / "keep.txt"
            sentinel.write_text("keep\n", encoding="utf-8")
            hooks = workdir / "hooks"
            hooks.mkdir()
            session_hook = hooks / "session-start.sh"
            session_hook.write_text(
                "#!/bin/bash\n"
                "cat >/dev/null\n"
                "touch \"$CLAUDE_PROJECT_DIR/session-initialized\"\n",
                encoding="utf-8",
            )

            # Redirect the old fixed path into this isolated fixture. The fixed
            # example uses TMPDIR and therefore leaves this replacement unused.
            isolated_script = script.replace(
                "/tmp/test-project", str(existing_project)
            )
            environment = os.environ.copy()
            environment["TMPDIR"] = str(workdir)
            result = run(
                ["bash", "-c", isolated_script],
                cwd=workdir,
                env=environment,
            )

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertTrue(sentinel.is_file(), "example deleted an existing project")

    def test_cache_example_rejects_a_symlink_without_clobbering_its_target(self):
        script = extract_bash_block_after_heading(
            ADVANCED_REFERENCE, "### Caching Validation Results"
        )
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            cache_root = workdir / "cache"
            cache_root.mkdir()
            protected_file = workdir / "protected.txt"
            protected_file.write_text("keep\n", encoding="utf-8")

            file_path = "example.py"
            cache_keys = {
                hashlib.md5(file_path.encode()).hexdigest(),
                hashlib.sha256(file_path.encode()).hexdigest(),
            }
            for cache_key in cache_keys:
                cache_file = cache_root / cache_key
                cache_file.symlink_to(protected_file)
                os.utime(cache_file, (1, 1), follow_symlinks=False)

            # Keep the vulnerable example inside the isolated fixture. The
            # fixed example reads CLAUDE_HOOK_CACHE_DIR directly, so this
            # replacement becomes a no-op after the repair.
            isolated_script = script.replace(
                'cache_file="/tmp/hook-cache-$cache_key"',
                'cache_file="${CLAUDE_HOOK_CACHE_DIR}/$cache_key"',
            )
            environment = os.environ.copy()
            environment["CLAUDE_HOOK_CACHE_DIR"] = str(cache_root)
            result = run(
                ["bash", "-c", isolated_script],
                cwd=workdir,
                env=environment,
                input_text=json.dumps({"tool_input": {"file_path": file_path}}),
            )

            self.assertNotEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertEqual(
                "keep\n",
                protected_file.read_text(encoding="utf-8"),
                "cache example followed a symlink and clobbered its target",
            )

    def test_cache_example_creates_and_reuses_a_private_cache(self):
        script = extract_bash_block_after_heading(
            ADVANCED_REFERENCE, "### Caching Validation Results"
        )
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            cache_root = workdir / "cache"
            environment = os.environ.copy()
            environment["CLAUDE_HOOK_CACHE_DIR"] = str(cache_root)
            payload = json.dumps({"tool_input": {"file_path": "example.py"}})

            first = run(
                ["bash", "-c", script],
                cwd=workdir,
                env=environment,
                input_text=payload,
            )
            second = run(
                ["bash", "-c", script],
                cwd=workdir,
                env=environment,
                input_text=payload,
            )

            self.assertEqual(0, first.returncode, first.stdout + first.stderr)
            self.assertEqual(0, second.returncode, second.stdout + second.stderr)
            self.assertEqual(0o700, cache_root.stat().st_mode & 0o777)
            entries = list(cache_root.iterdir())
            self.assertEqual(1, len(entries))
            self.assertEqual(0o600, entries[0].stat().st_mode & 0o777)

    def test_stop_example_preserves_whitespace_filenames_and_blocks_with_json(self):
        script = extract_bash_block_after_heading(
            STANDARD_PLUGIN, "### hooks/scripts/validate-commit.sh"
        )
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory) / "repository"
            repository.mkdir()
            run(["git", "init", "-q"], cwd=repository)
            changed_file = repository / "source with space.py"
            changed_file.write_text("print('example')\n", encoding="utf-8")
            run(["git", "add", "--", changed_file.name], cwd=repository)

            bin_directory = repository / "bin"
            bin_directory.mkdir()
            invocation_log = repository / "python-invocation.json"
            fake_python = bin_directory / "python"
            fake_python.write_text(
                "#!/usr/bin/env python3\n"
                "import json, os, sys\n"
                "with open(os.environ['INVOCATION_LOG'], 'w') as stream:\n"
                "    json.dump(sys.argv[1:], stream)\n"
                "raise SystemExit(1)\n",
                encoding="utf-8",
            )
            fake_python.chmod(0o755)
            hook = repository / "validate-commit.sh"
            hook.write_text(script, encoding="utf-8")
            environment = os.environ.copy()
            environment.update(
                {
                    "PATH": f"{bin_directory}{os.pathsep}{environment['PATH']}",
                    "INVOCATION_LOG": str(invocation_log),
                }
            )

            result = run(["bash", hook], cwd=repository, env=environment)

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            response = json.loads(result.stdout)
            self.assertEqual("block", response["decision"])
            self.assertIn("code quality", response["reason"])
            self.assertEqual(
                ["-m", "pylint", changed_file.name, "--errors-only"],
                json.loads(invocation_log.read_text(encoding="utf-8")),
            )


if __name__ == "__main__":
    unittest.main()
