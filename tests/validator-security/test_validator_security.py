import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).parent / "fixtures"
HOOK_SCHEMA_VALIDATOR = (
    ROOT
    / "plugins/plugin-dev/skills/hook-development/scripts/validate-hook-schema.sh"
)
AGENT_VALIDATOR = (
    ROOT / "plugins/plugin-dev/skills/agent-development/scripts/validate-agent.sh"
)
HOOK_DEVELOPMENT_SKILL = (
    ROOT / "plugins/plugin-dev/skills/hook-development/SKILL.md"
)
ADVANCED_HOOKS = (
    ROOT / "plugins/plugin-dev/skills/hook-development/references/advanced.md"
)
TEST_HOOK = ROOT / "plugins/plugin-dev/skills/hook-development/scripts/test-hook.sh"
VALIDATE_BASH = (
    ROOT / "plugins/plugin-dev/skills/hook-development/examples/validate-bash.sh"
)
VALIDATE_WRITE = (
    ROOT / "plugins/plugin-dev/skills/hook-development/examples/validate-write.sh"
)
SECURITY_HOOK = ROOT / "plugins/security-guidance/hooks/security_reminder_hook.py"
SECURITY_HOOK_CONFIG = ROOT / "plugins/security-guidance/hooks/hooks.json"

AGENT_FILES = [
    ROOT / "plugins/hookify/agents/conversation-analyzer.md",
    ROOT / "plugins/plugin-dev/agents/agent-creator.md",
    ROOT / "plugins/plugin-dev/agents/plugin-validator.md",
    ROOT / "plugins/plugin-dev/agents/skill-reviewer.md",
    ROOT / "plugins/pr-review-toolkit/agents/code-reviewer.md",
    ROOT / "plugins/pr-review-toolkit/agents/code-simplifier.md",
    ROOT / "plugins/pr-review-toolkit/agents/comment-analyzer.md",
    ROOT / "plugins/pr-review-toolkit/agents/pr-test-analyzer.md",
    ROOT / "plugins/pr-review-toolkit/agents/silent-failure-hunter.md",
    ROOT / "plugins/pr-review-toolkit/agents/type-design-analyzer.md",
]


def run_command(command, *, input_text=None, env=None, cwd=ROOT):
    return subprocess.run(
        [str(part) for part in command],
        cwd=cwd,
        input=input_text,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )


class HookSchemaValidatorTests(unittest.TestCase):
    def validate_document(self, document):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as fixture:
            json.dump(document, fixture)
            fixture.flush()
            return run_command(["bash", HOOK_SCHEMA_VALIDATOR, fixture.name])

    def test_accepts_plugin_wrapper_current_events_types_and_missing_matcher(self):
        result = run_command(
            ["bash", HOOK_SCHEMA_VALIDATOR, FIXTURES / "valid-hooks-wrapper.json"]
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rejects_unknown_event(self):
        result = run_command(
            ["bash", HOOK_SCHEMA_VALIDATOR, FIXTURES / "invalid-hooks-event.json"]
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unknown event type: BogusEvent", result.stdout)

    def test_rejects_non_string_matcher(self):
        result = run_command(
            ["bash", HOOK_SCHEMA_VALIDATOR, FIXTURES / "invalid-hooks-matcher.json"]
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("matcher must be a string", result.stdout)

    def test_rejects_unknown_group_key(self):
        result = self.validate_document(
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcer": "Bash",
                            "hooks": [{"type": "command", "command": "true"}],
                        }
                    ]
                }
            }
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unknown group key 'matcer'", result.stdout)

    def test_accepts_a_compilable_matcher_that_does_not_match_empty_input(self):
        result = run_command(
            ["bash", HOOK_SCHEMA_VALIDATOR, SECURITY_HOOK_CONFIG]
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_accepts_a_literal_matcher_without_treating_it_as_a_regex(self):
        result = self.validate_document(
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [{"type": "command", "command": "true"}],
                        }
                    ]
                }
            }
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rejects_a_matcher_that_is_invalid_in_javascript(self):
        result = self.validate_document(
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": "(?i)",
                            "hooks": [{"type": "command", "command": "true"}],
                        }
                    ]
                }
            }
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("matcher is an invalid regular expression for JavaScript", result.stdout)

    def test_rejects_direct_event_map_without_plugin_wrapper(self):
        result = run_command(
            [
                "bash",
                HOOK_SCHEMA_VALIDATOR,
                FIXTURES / "invalid-hooks-direct-event-map.json",
            ]
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("top-level 'hooks' wrapper", result.stdout)

    def test_skill_documents_settings_and_plugin_wrappers(self):
        documentation = HOOK_DEVELOPMENT_SKILL.read_text()
        settings_section = documentation.split(
            "### Settings Format", 1
        )[1].split("## Hook Events", 1)[0]
        plugin_section = documentation.split(
            "## Plugin Hook Configuration", 1
        )[1].split("## Matchers", 1)[0]

        self.assertIn('"hooks": {', settings_section)
        self.assertNotIn("No wrapper", settings_section)
        self.assertIn('"hooks": {', plugin_section)

    def test_rejects_handler_not_supported_by_event(self):
        document = {
            "hooks": {
                "SessionStart": [
                    {
                        "hooks": [
                            {"type": "http", "url": "https://example.invalid/start"}
                        ]
                    }
                ]
            }
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as fixture:
            json.dump(document, fixture)
            fixture.flush()
            result = run_command(["bash", HOOK_SCHEMA_VALIDATOR, fixture.name])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not supported for SessionStart", result.stdout)

    def test_accepts_prompt_and_agent_for_every_all_five_type_event(self):
        all_five_type_events = (
            "PermissionDenied",
            "PermissionRequest",
            "PostToolBatch",
            "PostToolUse",
            "PostToolUseFailure",
            "PreToolUse",
            "Stop",
            "SubagentStop",
            "TaskCompleted",
            "TaskCreated",
            "TeammateIdle",
            "UserPromptExpansion",
            "UserPromptSubmit",
        )
        for event in all_five_type_events:
            for handler_type in ("prompt", "agent"):
                with self.subTest(event=event, handler_type=handler_type):
                    result = self.validate_document(
                        {
                            "hooks": {
                                event: [
                                    {
                                        "hooks": [
                                            {
                                                "type": handler_type,
                                                "prompt": "Check the event.",
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    )
                    self.assertEqual(
                        result.returncode,
                        0,
                        result.stdout + result.stderr,
                    )

    def test_rejects_matcher_for_event_without_matcher_support(self):
        document = {
            "hooks": {
                "Stop": [
                    {
                        "matcher": "*",
                        "hooks": [{"type": "command", "command": "true"}],
                    }
                ]
            }
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as fixture:
            json.dump(document, fixture)
            fixture.flush()
            result = run_command(["bash", HOOK_SCHEMA_VALIDATOR, fixture.name])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Stop does not support matcher", result.stdout)

    def test_message_display_accepts_command_but_rejects_unlisted_handlers(self):
        command = self.validate_document(
            {
                "hooks": {
                    "MessageDisplay": [
                        {"hooks": [{"type": "command", "command": "true"}]}
                    ]
                }
            }
        )
        self.assertEqual(command.returncode, 0, command.stdout + command.stderr)

        unlisted_handlers = (
            {"type": "http", "url": "https://example.invalid/display"},
            {"type": "mcp_tool", "server": "display", "tool": "render"},
        )
        for handler in unlisted_handlers:
            with self.subTest(handler_type=handler["type"]):
                result = self.validate_document(
                    {
                        "hooks": {
                            "MessageDisplay": [{"hooks": [handler]}]
                        }
                    }
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("not supported for MessageDisplay", result.stdout)

    def test_rejects_invalid_common_fields_and_once_in_plugin_config(self):
        invalid_cases = (
            ({"if": 17}, "if must be a non-empty string"),
            ({"statusMessage": 17}, "statusMessage must be a string"),
            ({"timeout": "30"}, "timeout must be a positive integer"),
            ({"once": "yes"}, "once must be a boolean"),
        )
        for extra_fields, expected_error in invalid_cases:
            with self.subTest(field=next(iter(extra_fields))):
                handler = {
                    "type": "command",
                    "command": "true",
                    **extra_fields,
                }
                result = self.validate_document(
                    {
                        "description": "invalid common field",
                        "hooks": {
                            "PreToolUse": [{"hooks": [handler]}],
                        },
                    }
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(expected_error, result.stdout)

        ignored_once = self.validate_document(
            {
                "description": "once is ignored in plugin hooks",
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "true",
                                    "once": True,
                                }
                            ]
                        }
                    ]
                },
            }
        )
        self.assertNotEqual(ignored_once.returncode, 0)
        self.assertIn("once is ignored", ignored_once.stdout)

    def test_rejects_unknown_handler_key(self):
        result = self.validate_document(
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "true",
                                    "statusMesage": "Checking",
                                }
                            ]
                        }
                    ]
                }
            }
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unknown handler key 'statusMesage'", result.stdout)

    def test_rejects_if_outside_tool_events(self):
        result = self.validate_document(
            {
                "hooks": {
                    "Stop": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "true",
                                    "if": "Bash(git *)",
                                }
                            ]
                        }
                    ]
                }
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("if is only evaluated on tool events", result.stdout)

    def test_rejects_invalid_command_field_types(self):
        invalid_cases = (
            ({"args": "not-an-array"}, "args must be an array of strings"),
            ({"async": "yes"}, "async must be a boolean"),
            ({"asyncRewake": 1}, "asyncRewake must be a boolean"),
            ({"shell": "zsh"}, "shell must be 'bash' or 'powershell'"),
        )
        for extra_fields, expected_error in invalid_cases:
            with self.subTest(field=next(iter(extra_fields))):
                result = self.validate_document(
                    {
                        "hooks": {
                            "PreToolUse": [
                                {
                                    "hooks": [
                                        {
                                            "type": "command",
                                            "command": "true",
                                            **extra_fields,
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(expected_error, result.stdout)

    def test_rejects_type_specific_fields_on_other_handler_types(self):
        invalid_handlers = (
            (
                {"type": "http", "url": "example", "args": []},
                "args is only valid for command hooks",
            ),
            (
                {"type": "command", "command": "true", "headers": {}},
                "headers is only valid for http hooks",
            ),
            (
                {
                    "type": "http",
                    "url": "example",
                    "input": {},
                },
                "input is only valid for mcp_tool hooks",
            ),
            (
                {
                    "type": "mcp_tool",
                    "server": "server",
                    "tool": "tool",
                    "model": "haiku",
                },
                "model is only valid for prompt and agent hooks",
            ),
        )
        for handler, expected_error in invalid_handlers:
            with self.subTest(field=expected_error.split()[0]):
                result = self.validate_document(
                    {"hooks": {"PreToolUse": [{"hooks": [handler]}]}}
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(expected_error, result.stdout)

    def test_rejects_invalid_http_mcp_prompt_and_agent_field_types(self):
        invalid_handlers = (
            (
                {"type": "http", "url": "example", "headers": "bad"},
                "headers must be an object with string values",
            ),
            (
                {
                    "type": "http",
                    "url": "example",
                    "headers": {"Authorization": 17},
                },
                "headers must be an object with string values",
            ),
            (
                {
                    "type": "http",
                    "url": "example",
                    "allowedEnvVars": "bad",
                },
                "allowedEnvVars must be an array of strings",
            ),
            (
                {
                    "type": "mcp_tool",
                    "server": "server",
                    "tool": "tool",
                    "input": "bad",
                },
                "input must be an object",
            ),
            (
                {"type": "prompt", "prompt": "check", "model": 17},
                "model must be a non-empty string",
            ),
            (
                {
                    "type": "prompt",
                    "prompt": "check",
                    "continueOnBlock": "yes",
                },
                "continueOnBlock must be a boolean",
            ),
            (
                {"type": "agent", "prompt": "check", "model": 17},
                "model must be a non-empty string",
            ),
            (
                {
                    "type": "agent",
                    "prompt": "check",
                    "continueOnBlock": "yes",
                },
                "continueOnBlock must be a boolean",
            ),
        )
        for handler, expected_error in invalid_handlers:
            with self.subTest(type=handler["type"], field=expected_error.split()[0]):
                result = self.validate_document(
                    {"hooks": {"PreToolUse": [{"hooks": [handler]}]}}
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(expected_error, result.stdout)

    def test_accepts_valid_handler_fields_without_overvalidating_url(self):
        result = self.validate_document(
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "true",
                                    "args": [],
                                    "async": True,
                                    "asyncRewake": True,
                                    "shell": "bash",
                                    "if": "Bash(git *)",
                                    "timeout": 1,
                                    "statusMessage": "Checking",
                                },
                                {
                                    "type": "http",
                                    "url": "not even a URL",
                                    "headers": {"Authorization": "Bearer $TOKEN"},
                                    "allowedEnvVars": ["TOKEN"],
                                },
                                {
                                    "type": "mcp_tool",
                                    "server": "server",
                                    "tool": "tool",
                                    "input": {"path": "${tool_input.file_path}"},
                                },
                                {
                                    "type": "prompt",
                                    "prompt": "check $ARGUMENTS",
                                    "model": "future-model-id",
                                    "continueOnBlock": False,
                                },
                                {
                                    "type": "agent",
                                    "prompt": "check $ARGUMENTS",
                                    "model": "future-model-id",
                                    "continueOnBlock": True,
                                },
                            ]
                        }
                    ]
                }
            }
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class HookPayloadAndOutputTests(unittest.TestCase):
    def sample(self, event):
        result = run_command(["bash", TEST_HOOK, "--create-sample", event])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_current_sample_payload_fields(self):
        post_tool = self.sample("PostToolUse")
        self.assertIn("tool_response", post_tool)
        self.assertNotIn("tool_result", post_tool)

        prompt = self.sample("UserPromptSubmit")
        self.assertEqual(prompt["prompt"], "Test user prompt")
        self.assertNotIn("user_prompt", prompt)

        stop = self.sample("Stop")
        self.assertFalse(stop["stop_hook_active"])
        self.assertIn("last_assistant_message", stop)
        self.assertNotIn("reason", stop)

        subagent_stop = self.sample("SubagentStop")
        self.assertEqual(subagent_stop["hook_event_name"], "SubagentStop")
        self.assertIn("agent_id", subagent_stop)

        setup = self.sample("Setup")
        self.assertEqual(setup["hook_event_name"], "Setup")

    def test_samples_use_current_permission_mode_and_setup_trigger(self):
        events = (
            "PreToolUse",
            "PostToolUse",
            "Stop",
            "SubagentStop",
            "UserPromptSubmit",
            "SessionStart",
            "Setup",
            "SessionEnd",
        )
        for event in events:
            with self.subTest(event=event):
                payload = self.sample(event)
                self.assertEqual(payload["permission_mode"], "default")

        setup = self.sample("Setup")
        self.assertEqual(setup["trigger"], "init")
        self.assertNotIn("source", setup)

    def assert_structured_decision(self, script, payload, expected):
        result = run_command(
            ["bash", script],
            input_text=json.dumps(payload),
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stderr, "")
        response = json.loads(result.stdout)
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertEqual(output["permissionDecision"], expected)
        self.assertTrue(output["permissionDecisionReason"])

    def test_ask_and_deny_are_stdout_json_with_exit_zero(self):
        self.assert_structured_decision(
            VALIDATE_BASH,
            {"tool_input": {"command": "sudo true"}},
            "ask",
        )
        self.assert_structured_decision(
            VALIDATE_BASH,
            {"tool_input": {"command": "rm -rf /tmp/example"}},
            "deny",
        )
        self.assert_structured_decision(
            VALIDATE_WRITE,
            {"tool_input": {"file_path": "credentials.env"}},
            "ask",
        )

    def test_hook_and_input_paths_are_not_interpreted_by_a_shell(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            injected_marker = workdir / "injected-marker"
            input_marker = workdir / "input-marker"
            hook = workdir / "hook with 'quote'; touch injected-marker; #.sh"
            test_input = (
                workdir / "input with 'quote'; touch input-marker; #.json"
            )
            hook.write_text(
                "#!/bin/bash\ncat >/dev/null\nprintf '{\"continue\":true}\\n'\n"
            )
            test_input.write_text("{}\n")

            result = run_command(
                ["bash", TEST_HOOK, "-t", "5", hook, test_input],
                cwd=workdir,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertFalse(injected_marker.exists())
            self.assertFalse(input_marker.exists())

    def test_timeout_must_be_a_positive_integer(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            hook = workdir / "hook.sh"
            test_input = workdir / "input.json"
            hook.write_text("#!/bin/bash\ncat >/dev/null\n")
            test_input.write_text("{}\n")

            for timeout_value in ("0", "-1", "abc", "1.5"):
                with self.subTest(timeout=timeout_value):
                    result = run_command(
                        [
                            "bash",
                            TEST_HOOK,
                            "-t",
                            timeout_value,
                            hook,
                            test_input,
                        ],
                        cwd=workdir,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("positive integer", result.stdout)

            missing_value = run_command(
                ["bash", TEST_HOOK, "-t"],
                cwd=workdir,
            )
            self.assertNotEqual(missing_value.returncode, 0)
            self.assertIn("positive integer", missing_value.stdout)

    def test_uses_gtimeout_when_gnu_timeout_name_is_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            bin_dir = workdir / "bin"
            bin_dir.mkdir()
            for command in ("jq", "date"):
                command_path = shutil.which(command)
                self.assertIsNotNone(command_path)
                (bin_dir / command).symlink_to(command_path)

            gtimeout_marker = workdir / "gtimeout-used"
            gtimeout = bin_dir / "gtimeout"
            gtimeout.write_text(
                "#!/bin/bash\n"
                "printf 'used\\n' > \"$GTIMEOUT_MARKER\"\n"
                "shift\n"
                "exec \"$@\"\n"
            )
            gtimeout.chmod(0o755)

            hook = workdir / "hook.sh"
            hook.write_text("#!/bin/bash\nprintf '{\"continue\":true}\\n'\n")
            hook.chmod(0o755)
            test_input = workdir / "input.json"
            test_input.write_text("{}\n")

            env = os.environ.copy()
            env.update(
                {
                    "PATH": str(bin_dir),
                    "GTIMEOUT_MARKER": str(gtimeout_marker),
                    "CLAUDE_PROJECT_DIR": str(workdir / "caller-project"),
                    "CLAUDE_ENV_FILE": str(workdir / "no-env-file"),
                }
            )
            result = run_command(
                ["/bin/bash", TEST_HOOK, "-t", "5", hook, test_input],
                env=env,
                cwd=workdir,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue(gtimeout_marker.exists())
            self.assertIn("Hook approved/succeeded", result.stdout)

    def test_reports_missing_timeout_dependency(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            bin_dir = workdir / "bin"
            bin_dir.mkdir()
            for command in ("jq", "date"):
                command_path = shutil.which(command)
                self.assertIsNotNone(command_path)
                (bin_dir / command).symlink_to(command_path)

            hook = workdir / "hook.sh"
            hook.write_text("#!/bin/bash\nprintf '{\"continue\":true}\\n'\n")
            hook.chmod(0o755)
            test_input = workdir / "input.json"
            test_input.write_text("{}\n")

            env = os.environ.copy()
            env.update(
                {
                    "PATH": str(bin_dir),
                    "CLAUDE_ENV_FILE": str(workdir / "no-env-file"),
                }
            )
            result = run_command(
                ["/bin/bash", TEST_HOOK, "-t", "5", hook, test_input],
                env=env,
                cwd=workdir,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("requires 'timeout' or 'gtimeout'", result.stdout)


class AgentValidatorTests(unittest.TestCase):
    def validate_metadata(self, extra_metadata):
        metadata = {
            "name": "contract-agent",
            "description": (
                "Use this agent when the validator contract needs testing. "
                "<example>Validate official fields.</example>"
            ),
            **extra_metadata,
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md") as fixture:
            fixture.write(
                "---\n"
                + json.dumps(metadata)
                + "\n---\n\n"
                + "You are responsible for validating the official agent contract.\n"
            )
            fixture.flush()
            return run_command(["bash", AGENT_VALIDATOR, fixture.name])

    def test_model_is_optional(self):
        result = run_command(
            ["bash", AGENT_VALIDATOR, FIXTURES / "valid-agent-minimal.md"]
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("model: not specified (optional)", result.stdout)

    def test_malformed_yaml_is_rejected(self):
        result = run_command(
            ["bash", AGENT_VALIDATOR, FIXTURES / "invalid-agent-yaml.md"]
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Invalid YAML frontmatter", result.stderr)

    def test_tools_support_scalar_and_array_and_current_models(self):
        fixtures = (
            FIXTURES / "valid-agent-tools-scalar.md",
            FIXTURES / "valid-agent-tools-array.md",
        )
        for fixture in fixtures:
            with self.subTest(fixture=fixture.name):
                result = run_command(["bash", AGENT_VALIDATOR, fixture])
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertNotIn("Unknown model", result.stdout)

    def test_rejects_manual_permission_mode_in_plugin_agents(self):
        result = run_command(
            [
                "bash",
                AGENT_VALIDATOR,
                FIXTURES / "unsupported-plugin-agent-permission-manual.md",
            ]
        )
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(
            "permissionMode is not supported in plugin agent frontmatter",
            result.stdout,
        )

    def test_rejects_frontmatter_fields_ignored_by_plugin_agents(self):
        unsupported_fields = (
            ("permissionMode", "manual"),
            ("mcpServers", ["github"]),
            ("hooks", {"PreToolUse": []}),
        )

        for field, value in unsupported_fields:
            with self.subTest(field=field):
                result = self.validate_metadata({field: value})
                self.assertNotEqual(
                    result.returncode,
                    0,
                    result.stdout + result.stderr,
                )
                self.assertIn(
                    f"{field} is not supported in plugin agent frontmatter",
                    result.stdout,
                )

    def test_accepts_official_colors_and_initial_prompt(self):
        for color in (
            "red",
            "blue",
            "green",
            "yellow",
            "purple",
            "orange",
            "pink",
            "cyan",
        ):
            with self.subTest(color=color):
                result = self.validate_metadata(
                    {
                        "color": color,
                        "initialPrompt": "Inspect the current change.",
                    }
                )
                self.assertEqual(
                    result.returncode,
                    0,
                    result.stdout + result.stderr,
                )

    def test_uppercase_and_underscore_name_is_rejected(self):
        result = run_command(
            ["bash", AGENT_VALIDATOR, FIXTURES / "invalid-agent-name.md"]
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("only lowercase letters and hyphens", result.stdout)

    def test_rejects_invalid_official_frontmatter_field_values(self):
        invalid_cases = (
            ("maxTurns", "unlimited", "maxTurns must be a positive integer"),
            ("maxTurns", 0, "maxTurns must be a positive integer"),
            ("background", "false", "background must be a boolean"),
            ("isolation", "shared", "isolation must be 'worktree'"),
            ("memory", "global", "memory must be one of"),
            (
                "disallowedTools",
                42,
                "disallowedTools must be a comma-separated string or an array",
            ),
            ("effort", "extreme", "effort must be one of"),
            ("skills", 42, "skills must be an array"),
            ("color", "magenta", "color must be one of"),
            ("initialPrompt", "", "initialPrompt must be a non-empty string"),
            ("initialPrompt", 42, "initialPrompt must be a non-empty string"),
        )

        for field, value, expected_error in invalid_cases:
            with self.subTest(field=field, value=value):
                result = self.validate_metadata({field: value})
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn(expected_error, result.stdout)

    def test_accepts_all_supported_plugin_fields_and_rejects_unknown_fields(self):
        supported = self.validate_metadata(
            {
                "tools": ["Read", "Grep"],
                "disallowedTools": "Write, Edit",
                "model": "inherit",
                "maxTurns": 3,
                "skills": ["testing-conventions"],
                "memory": "project",
                "background": False,
                "effort": "high",
                "isolation": "worktree",
                "color": "blue",
                "initialPrompt": "Review this plugin agent.",
            }
        )
        self.assertEqual(supported.returncode, 0, supported.stdout + supported.stderr)

        unknown = self.validate_metadata({"futureField": {"enabled": True}})
        self.assertNotEqual(unknown.returncode, 0, unknown.stdout + unknown.stderr)
        self.assertIn(
            "futureField is not supported in plugin agent frontmatter",
            unknown.stdout,
        )


class AdvancedHookDocumentationTests(unittest.TestCase):
    def extract_bash_block(self, marker):
        documentation = ADVANCED_HOOKS.read_text()
        match = re.search(
            rf"```bash\n(?P<script>[^`]*{re.escape(marker)}[^`]*)\n```",
            documentation,
        )
        self.assertIsNotNone(match, f"missing executable example: {marker}")
        return match.group("script")

    def test_cross_hook_examples_share_secure_state_across_processes(self):
        documentation = ADVANCED_HOOKS.read_text()
        self.assertNotIn("$$", documentation)

        helper_script = self.extract_bash_block("# hook-state.sh")
        producer_script = self.extract_bash_block("# analyze-command.sh")
        consumer_script = self.extract_bash_block("# enforce-risk.sh")

        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            scripts = workdir / "scripts"
            scripts.mkdir()
            helper = scripts / "hook-state.sh"
            producer = scripts / "analyze-command.sh"
            consumer = scripts / "enforce-risk.sh"
            helper.write_text(helper_script)
            producer.write_text(producer_script)
            consumer.write_text(consumer_script)

            state_root = workdir / "state"
            env = os.environ.copy()
            env.update(
                {
                    "CLAUDE_PLUGIN_ROOT": str(workdir),
                    "CLAUDE_HOOK_STATE_DIR": str(state_root),
                }
            )
            payload = json.dumps(
                {
                    "session_id": "shared-session",
                    "tool_input": {"command": "rm -rf /tmp/example"},
                }
            )

            produced = run_command(
                ["bash", producer],
                input_text=payload,
                env=env,
                cwd=workdir,
            )
            self.assertEqual(produced.returncode, 0, produced.stdout + produced.stderr)
            self.assertEqual(state_root.stat().st_mode & 0o777, 0o700)
            state_files = list(state_root.glob("*.state"))
            self.assertEqual(len(state_files), 1)
            self.assertEqual(state_files[0].stat().st_mode & 0o777, 0o600)

            consumed = run_command(
                ["bash", consumer],
                input_text=payload,
                env=env,
                cwd=workdir,
            )
            self.assertEqual(consumed.returncode, 2, consumed.stdout + consumed.stderr)
            self.assertIn("High risk operation detected", consumed.stderr)
            self.assertFalse(state_files[0].exists())

            invalid = run_command(
                ["bash", producer],
                input_text=json.dumps(
                    {
                        "session_id": "../escaped",
                        "tool_input": {"command": "echo safe"},
                    }
                ),
                env=env,
                cwd=workdir,
            )
            self.assertEqual(invalid.returncode, 2)
            self.assertFalse((workdir / "escaped.risk.state").exists())

            state_root.mkdir(mode=0o700, exist_ok=True)
            protected = workdir / "protected.txt"
            protected.write_text("keep\n")
            poisoned = state_root / "symlink-session.risk.state"
            poisoned.symlink_to(protected)
            symlink_result = run_command(
                ["bash", producer],
                input_text=json.dumps(
                    {
                        "session_id": "symlink-session",
                        "tool_input": {"command": "echo safe"},
                    }
                ),
                env=env,
                cwd=workdir,
            )
            self.assertEqual(symlink_result.returncode, 2)
            self.assertEqual(protected.read_text(), "keep\n")
            self.assertTrue(poisoned.is_symlink())

    def test_rate_limit_is_shared_across_processes_and_cleaned_up(self):
        helper_script = self.extract_bash_block("# hook-state.sh")
        rate_script = self.extract_bash_block("# rate-limit-hook.sh")
        cleanup_script = self.extract_bash_block("# session-end-cleanup.sh")

        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            scripts = workdir / "scripts"
            scripts.mkdir()
            (scripts / "hook-state.sh").write_text(helper_script)
            rate_hook = scripts / "rate-limit-hook.sh"
            cleanup_hook = scripts / "session-end-cleanup.sh"
            rate_hook.write_text(rate_script)
            cleanup_hook.write_text(cleanup_script)

            state_root = workdir / "state"
            env = os.environ.copy()
            env.update(
                {
                    "CLAUDE_PLUGIN_ROOT": str(workdir),
                    "CLAUDE_HOOK_STATE_DIR": str(state_root),
                }
            )
            payload = json.dumps({"session_id": "rate-session"})

            for invocation in range(10):
                result = run_command(
                    ["bash", rate_hook],
                    input_text=payload,
                    env=env,
                    cwd=workdir,
                )
                self.assertEqual(
                    result.returncode,
                    0,
                    f"invocation {invocation + 1}: {result.stdout}{result.stderr}",
                )

            blocked = run_command(
                ["bash", rate_hook],
                input_text=payload,
                env=env,
                cwd=workdir,
            )
            self.assertEqual(blocked.returncode, 2)
            self.assertIn("Rate limit exceeded", blocked.stderr)
            state_file = state_root / "rate-session.command-rate.state"
            self.assertEqual(state_file.stat().st_mode & 0o777, 0o600)

            cleaned = run_command(
                ["bash", cleanup_hook],
                input_text=payload,
                env=env,
                cwd=workdir,
            )
            self.assertEqual(cleaned.returncode, 0, cleaned.stdout + cleaned.stderr)
            self.assertFalse(state_file.exists())

    def test_database_logging_keeps_hook_input_out_of_sql_text(self):
        database_script = self.extract_bash_block("# database-logging.sh")

        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            bin_dir = workdir / "bin"
            bin_dir.mkdir()
            args_log = workdir / "psql-args.log"
            stdin_log = workdir / "psql-stdin.sql"
            psql = bin_dir / "psql"
            psql.write_text(
                "#!/bin/bash\n"
                "printf '%s\\n' \"$@\" > \"$PSQL_ARGS_LOG\"\n"
                "cat > \"$PSQL_STDIN_LOG\"\n"
            )
            psql.chmod(0o755)

            payload = json.dumps({"note": "x'); DROP TABLE hook_logs; --"})
            env = os.environ.copy()
            env.update(
                {
                    "PATH": f"{bin_dir}:{env['PATH']}",
                    "DATABASE_URL": "postgresql://example.invalid/hooks",
                    "PSQL_ARGS_LOG": str(args_log),
                    "PSQL_STDIN_LOG": str(stdin_log),
                }
            )
            result = run_command(
                ["bash", "-c", database_script],
                input_text=payload,
                env=env,
                cwd=workdir,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            sql_text = stdin_log.read_text()
            arguments = args_log.read_text().splitlines()
            compact_payload = json.dumps(json.loads(payload), separators=(",", ":"))
            self.assertNotIn(payload, sql_text)
            self.assertNotIn("DROP TABLE", sql_text)
            self.assertIn(":'hook_data'::jsonb", sql_text)
            self.assertIn(f"--set=hook_data={compact_payload}", arguments)
            self.assertNotIn("-c", arguments)


class AgentDocumentationTests(unittest.TestCase):
    def test_all_ten_regressed_agent_frontmatters_are_valid(self):
        failures = []
        for agent_file in AGENT_FILES:
            result = run_command(["bash", AGENT_VALIDATOR, agent_file])
            if result.returncode != 0:
                failures.append(f"{agent_file}: {result.stdout}{result.stderr}")
        self.assertEqual(failures, [])

    def test_documented_agent_frontmatter_examples_are_parseable(self):
        documentation_root = (
            ROOT / "plugins/plugin-dev/skills/agent-development"
        )
        failures = []
        example_count = 0

        for documentation in documentation_root.rglob("*.md"):
            text = documentation.read_text()
            for match in re.finditer(
                r"```markdown\n(---\n.*?\n---)\n", text, re.DOTALL
            ):
                frontmatter = match.group(1)
                if "[identifier" in frontmatter or "[whenToUse" in frontmatter:
                    continue
                example_count += 1
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=".md"
                ) as fixture:
                    fixture.write(
                        frontmatter
                        + "\n\nYou are responsible for this documented agent example.\n"
                    )
                    fixture.flush()
                    result = run_command(
                        ["bash", AGENT_VALIDATOR, fixture.name]
                    )
                if result.returncode != 0:
                    failures.append(
                        f"{documentation}: {result.stdout}{result.stderr}"
                    )

        self.assertGreater(example_count, 0)
        self.assertEqual(failures, [])


class SecurityReminderTests(unittest.TestCase):
    def run_hook(self, home, session_id, file_path, content, tool_name="Write"):
        if tool_name == "Write":
            tool_input = {"file_path": file_path, "content": content}
        elif tool_name == "Edit":
            tool_input = {"file_path": file_path, "new_string": content}
        elif tool_name == "MultiEdit":
            tool_input = {
                "file_path": file_path,
                "edits": [{"new_string": part} for part in content],
            }
        elif tool_name == "NotebookEdit":
            tool_input = {
                "notebook_path": file_path,
                "new_source": content,
            }
        else:
            raise ValueError(f"Unsupported test tool: {tool_name}")

        payload = {
            "session_id": session_id,
            "hook_event_name": "PreToolUse",
            "tool_name": tool_name,
            "tool_input": tool_input,
        }
        env = os.environ.copy()
        env.update(
            {
                "HOME": str(home),
                "ENABLE_SECURITY_REMINDER": "1",
                "PYTHONDONTWRITEBYTECODE": "1",
            }
        )
        return run_command(
            ["python3", SECURITY_HOOK],
            input_text=json.dumps(payload),
            env=env,
        )

    def test_regex_exec_and_member_eval_do_not_trigger(self):
        with tempfile.TemporaryDirectory() as home:
            result = self.run_hook(
                home,
                "false-positive",
                "src/parser.ts",
                "const match = regex.exec(value); const x = object.eval(value);",
            )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_child_process_namespace_alias_exec_and_exec_sync_trigger(self):
        cases = (
            (
                "commonjs-alias",
                'const cp=require("child_process"); cp.exec(userInput);',
            ),
            (
                "esm-alias",
                'import * as cp from "node:child_process"; cp.execSync(input);',
            ),
            (
                "esm-default-alias",
                "import childProcess from 'node:child_process'; childProcess.exec(userInput);",
            ),
            (
                "esm-default-and-named-alias",
                "import cp, { spawn } from 'node:child_process'; cp.exec(userInput);",
            ),
            (
                "esm-combined-named-exec-alias",
                "import cp, { exec as run } from 'node:child_process'; run(userInput);",
            ),
            (
                "esm-default-and-namespace-alias",
                "import cp, * as child from 'node:child_process'; child.exec(userInput);",
            ),
            (
                "esm-named-alias",
                "import { exec as run } from 'node:child_process'; run(userInput);",
            ),
            (
                "commonjs-destructured-alias",
                "const {exec: run}=require('child_process'); run(userInput);",
            ),
            (
                "commonjs-inline-require",
                "require('child_process').exec(userInput);",
            ),
        )
        with tempfile.TemporaryDirectory() as home:
            for session_id, content in cases:
                with self.subTest(session_id=session_id):
                    result = self.run_hook(
                        home,
                        session_id,
                        "src/runner.ts",
                        content,
                    )
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertIn("child_process.exec()", result.stderr)

    def test_whitespace_case_multiple_findings_and_per_rule_state(self):
        with tempfile.TemporaryDirectory() as home:
            first = self.run_hook(
                home,
                "multiple",
                "src/runner.ts",
                "const a = exec (input); const b = EVAL (input);",
            )
            self.assertEqual(first.returncode, 2)
            self.assertIn("child_process.exec()", first.stderr)
            self.assertIn("eval()", first.stderr)

            retry = self.run_hook(
                home,
                "multiple",
                "src/runner.ts",
                "const a = exec (input); const b = EVAL (input);",
            )
            self.assertEqual(retry.returncode, 0, retry.stderr)

            new_rule = self.run_hook(
                home,
                "multiple",
                "src/runner.ts",
                "const a = exec (input); const b = EVAL (input); new Function (input);",
            )
            self.assertEqual(new_rule.returncode, 2)
            self.assertIn("new Function()", new_rule.stderr)
            self.assertNotIn("child_process.exec()", new_rule.stderr)
            self.assertNotIn("eval()", new_rule.stderr)

            state_path = (
                Path(home) / ".claude/security_warnings_state_multiple.json"
            )
            state = json.loads(state_path.read_text())
            self.assertEqual(len(state), 3)

    def test_windows_workflow_path_and_multiedit_content_trigger(self):
        with tempfile.TemporaryDirectory() as home:
            workflow = self.run_hook(
                home,
                "windows-path",
                r"C:\repo\.github\workflows\CI.YML",
                "name: CI",
            )
            self.assertEqual(workflow.returncode, 2)
            self.assertIn("GitHub Actions workflow", workflow.stderr)

            multi_edit = self.run_hook(
                home,
                "multi-edit",
                "src/runner.ts",
                ["const safe = true;", "const value = eVaL   (input);"],
                tool_name="MultiEdit",
            )
            self.assertEqual(multi_edit.returncode, 2)
            self.assertIn("eval()", multi_edit.stderr)

    def test_notebook_edit_dangerous_content_with_windows_path_and_state(self):
        with tempfile.TemporaryDirectory() as home:
            first = self.run_hook(
                home,
                "notebook-edit",
                r"C:\repo\notebooks\security.ipynb",
                "result = eval(user_input)",
                tool_name="NotebookEdit",
            )
            self.assertEqual(first.returncode, 2, first.stderr)
            self.assertIn("eval()", first.stderr)

            retry = self.run_hook(
                home,
                "notebook-edit",
                r"C:\repo\notebooks\security.ipynb",
                "result = eval(user_input)",
                tool_name="NotebookEdit",
            )
            self.assertEqual(retry.returncode, 0, retry.stderr)
            self.assertEqual(retry.stderr, "")

    def test_notebook_edit_safe_content_is_allowed(self):
        with tempfile.TemporaryDirectory() as home:
            result = self.run_hook(
                home,
                "notebook-edit-safe",
                "notebooks/report.ipynb",
                "result = json.loads(user_input)",
                tool_name="NotebookEdit",
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")

    def test_notebook_edit_is_registered_in_hook_matcher(self):
        configuration = json.loads(SECURITY_HOOK_CONFIG.read_text())
        matcher = configuration["hooks"]["PreToolUse"][0]["matcher"]

        self.assertEqual(matcher, "Edit|Write|MultiEdit|NotebookEdit")

    def test_session_id_cannot_escape_state_directory(self):
        with tempfile.TemporaryDirectory() as home:
            home_path = Path(home)
            escaped_state = home_path / "escaped.json"

            result = self.run_hook(
                home_path,
                "nested/../../escaped",
                "src/runner.ts",
                "eval(input);",
            )

            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertFalse(escaped_state.exists())
            state_files = list(
                (home_path / ".claude").glob("security_warnings_state_*.json")
            )
            self.assertEqual(len(state_files), 1)

            retry = self.run_hook(
                home_path,
                "nested/../../escaped",
                "src/runner.ts",
                "eval(input);",
            )
            self.assertEqual(retry.returncode, 0, retry.stderr)

    def test_existing_state_symlink_is_not_followed_or_replaced(self):
        with tempfile.TemporaryDirectory() as home:
            home_path = Path(home)
            state_dir = home_path / ".claude"
            state_dir.mkdir()
            target = home_path / "do-not-overwrite.txt"
            target.write_text("preserve this content")
            state_path = state_dir / "security_warnings_state_symlink.json"
            state_path.symlink_to(target)

            result = self.run_hook(
                home_path,
                "symlink",
                "src/runner.ts",
                "eval(input);",
            )

            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertEqual(target.read_text(), "preserve this content")
            self.assertTrue(state_path.is_symlink())


if __name__ == "__main__":
    unittest.main()
