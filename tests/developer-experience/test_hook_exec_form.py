#!/usr/bin/env python3
"""Runtime contract tests for plugin hook command configuration."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
EXPECTED_HOOK_COUNTS = {
    "explanatory-output-style": 1,
    "hookify": 4,
    "learning-output-style": 1,
    "ralph-wiggum": 1,
    "security-guidance": 1,
}
PLUGIN_ROOT_VARIABLE = "${CLAUDE_PLUGIN_ROOT}"


def configured_hooks(configuration):
    for event_name, groups in configuration["hooks"].items():
        for group in groups:
            for hook in group["hooks"]:
                yield event_name, hook


class HookExecFormContractTests(unittest.TestCase):
    """Run every plugin-root hook without relying on shell tokenization."""

    def test_plugin_root_hooks_use_exec_form_and_run_from_a_space_path(self):
        configured_plugins = {
            path.parents[1].name
            for path in ROOT.glob("plugins/*/hooks/hooks.json")
            if PLUGIN_ROOT_VARIABLE in path.read_text(encoding="utf-8")
        }
        self.assertEqual(set(EXPECTED_HOOK_COUNTS), configured_plugins)

        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            project = temporary / "project root"
            nested_cwd = project / "src" / "nested"
            nested_cwd.mkdir(parents=True)
            transcript = project / "transcript.jsonl"
            transcript.write_text("", encoding="utf-8")

            tested_hooks = 0
            for plugin_name, expected_count in EXPECTED_HOOK_COUNTS.items():
                plugin_source = ROOT / "plugins" / plugin_name
                installed_plugin = temporary / "plugin cache" / plugin_name
                shutil.copytree(plugin_source, installed_plugin)

                configuration_path = plugin_source / "hooks" / "hooks.json"
                configuration = json.loads(
                    configuration_path.read_text(encoding="utf-8")
                )
                hooks = list(configured_hooks(configuration))
                self.assertEqual(
                    expected_count,
                    len(hooks),
                    f"unexpected hook count in {configuration_path}",
                )

                for event_name, hook in hooks:
                    tested_hooks += 1
                    with self.subTest(plugin=plugin_name, event=event_name):
                        command = hook.get("command")
                        arguments = hook.get("args")
                        self.assertIsInstance(command, str)
                        self.assertNotRegex(
                            command,
                            r"\s",
                            "command must contain only the executable",
                        )
                        self.assertIsInstance(
                            arguments,
                            list,
                            "exec-form hooks must declare an args array",
                        )
                        self.assertTrue(
                            all(isinstance(argument, str) for argument in arguments)
                        )
                        self.assertTrue(
                            any(
                                PLUGIN_ROOT_VARIABLE in token
                                for token in [command, *arguments]
                            ),
                            "the hook must resolve its installed plugin root",
                        )

                        resolve = lambda token: token.replace(
                            PLUGIN_ROOT_VARIABLE, str(installed_plugin)
                        )
                        argv = [resolve(command), *(resolve(arg) for arg in arguments)]
                        payload = {
                            "session_id": "hook-contract-session",
                            "transcript_path": str(transcript),
                            "cwd": str(nested_cwd),
                            "permission_mode": "default",
                            "hook_event_name": event_name,
                            "tool_name": "Write",
                            "tool_input": {
                                "file_path": "safe.txt",
                                "content": "safe content",
                            },
                            "tool_response": {"stdout": "", "stderr": ""},
                            "prompt": "safe prompt",
                            "stop_hook_active": True,
                        }
                        environment = os.environ.copy()
                        environment.update(
                            {
                                "CLAUDE_PLUGIN_ROOT": str(installed_plugin),
                                "CLAUDE_PROJECT_DIR": str(project),
                                "ENABLE_SECURITY_REMINDER": "0",
                                "HOME": str(temporary / "home"),
                            }
                        )
                        completed = subprocess.run(
                            argv,
                            input=json.dumps(payload),
                            text=True,
                            cwd=nested_cwd,
                            env=environment,
                            capture_output=True,
                            check=False,
                            timeout=10,
                        )
                        self.assertEqual(
                            0,
                            completed.returncode,
                            f"argv={argv!r}\nstdout={completed.stdout}\n"
                            f"stderr={completed.stderr}",
                        )

            self.assertEqual(sum(EXPECTED_HOOK_COUNTS.values()), tested_hooks)


if __name__ == "__main__":
    unittest.main()
