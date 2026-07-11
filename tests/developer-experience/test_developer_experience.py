#!/usr/bin/env python3

import ast
import json
import os
import re
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CODE_REVIEW_COMMAND = ROOT / "plugins/code-review/commands/code-review.md"
CODE_REVIEW_README = ROOT / "plugins/code-review/README.md"
PR_REVIEW_COMMAND = ROOT / "plugins/pr-review-toolkit/commands/review-pr.md"
FEATURE_AGENTS = tuple((ROOT / "plugins/feature-dev/agents").glob("*.md"))
DEVCONTAINER_SCRIPT = ROOT / "Script/run_devcontainer_claude_code.ps1"
REPOSITORY_TEST_RUNNER = ROOT / "scripts/test-repository.sh"
CONTENT_QUALITY_WORKFLOW = ROOT / ".github/workflows/content-quality.yml"
MIGRATION_SKILL = (
    ROOT
    / "plugins/claude-opus-4-5-migration/skills/claude-opus-4-5-migration/SKILL.md"
)
EFFORT_REFERENCE = MIGRATION_SKILL.parent / "references/effort.md"
SDK_COMMAND = ROOT / "plugins/agent-sdk-dev/commands/new-sdk-app.md"
SDK_PY_VERIFIER = ROOT / "plugins/agent-sdk-dev/agents/agent-sdk-verifier-py.md"
SDK_TS_VERIFIER = ROOT / "plugins/agent-sdk-dev/agents/agent-sdk-verifier-ts.md"
COMMIT_COMMANDS = (
    ROOT / "plugins/commit-commands/commands/commit.md",
    ROOT / "plugins/commit-commands/commands/commit-push-pr.md",
)


def read(path):
    return path.read_text(encoding="utf-8")


def frontmatter(markdown):
    match = re.match(r"---\n(.*?)\n---\n", markdown, flags=re.DOTALL)
    if not match:
        raise AssertionError("missing YAML frontmatter")
    return match.group(1)


def fenced(markdown, language):
    match = re.search(
        rf"^[ \t]*```{re.escape(language)}[ \t]*\n(.*?)^[ \t]*```[ \t]*$",
        markdown,
        flags=re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise AssertionError(f"missing {language} example")
    return textwrap.dedent(match.group(1)).rstrip()


class ReviewWorkflowContractTests(unittest.TestCase):
    def test_o01_all_review_agents_share_the_validation_gate(self):
        command = read(CODE_REVIEW_COMMAND)
        step_five = re.search(
            r"^5\. (.*?)(?=^6\. )", command, flags=re.MULTILINE | re.DOTALL
        )
        self.assertIsNotNone(step_five)
        validation = step_five.group(1)
        self.assertIn("all four agents", validation)
        self.assertIn("agents 1, 2, 3, or 4", validation)
        self.assertIn("same validation gate", validation)
        self.assertIn("CLAUDE.md agents must never bypass validation", validation)

        step_six = re.search(
            r"^6\. (.*?)(?=^7\. )", command, flags=re.MULTILINE | re.DOTALL
        )
        self.assertIsNotNone(step_six)
        self.assertIn("every unvalidated candidate", step_six.group(1))
        self.assertIn("Every candidate", read(CODE_REVIEW_README))

    def test_o02_inline_comments_use_bundled_gh_cli_only(self):
        command = read(CODE_REVIEW_COMMAND)
        self.assertNotIn("mcp__github_inline_comment__", command)
        self.assertIn("Bash(gh api:*)", frontmatter(command))
        self.assertIn("gh api --method POST", command)
        self.assertIn("--input - <<'GITHUB_REVIEW_COMMENT'", command)
        self.assertIn("shell expansion is disabled", command)

    def test_o03_default_and_all_pr_reviews_are_read_only(self):
        command = read(PR_REVIEW_COMMAND)
        self.assertIn("empty argument list and `all` as strictly read-only", command)
        self.assertIn("**all** - Run all applicable read-only reviews", command)
        self.assertIn(
            "Only when `simplify` is explicitly present in `$ARGUMENTS`",
            command,
        )
        self.assertIn(
            "excluded from the default and `all` modes",
            command,
        )
        self.assertIn('"Agent"', frontmatter(command))
        self.assertNotIn('"Task"', frontmatter(command))


class ToolAndScriptContractTests(unittest.TestCase):
    @staticmethod
    def _run_devcontainer_with_mock_commands(
        machine_list,
        container_ids,
        *,
        execute_inner_command=False,
        claude_exit_code=0,
    ):
        pwsh = shutil.which("pwsh")
        if os.name == "nt":
            raise AssertionError(
                "the native-command fixture requires a POSIX host"
            )
        if not pwsh:
            raise AssertionError(
                "pwsh is required to execute the O-09 native-command fixture"
            )

        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            bin_directory = temporary / "bin"
            workspace = temporary / "workspace"
            command_log = temporary / "commands.jsonl"
            bin_directory.mkdir()
            workspace.mkdir()

            fake_command = textwrap.dedent(
                """\
                #!/usr/bin/env python3
                import json
                import os
                import subprocess
                import sys
                from pathlib import Path

                command = Path(sys.argv[0]).name
                arguments = sys.argv[1:]
                with open(os.environ["MOCK_COMMAND_LOG"], "a", encoding="utf-8") as stream:
                    stream.write(json.dumps({"command": command, "args": arguments}) + "\\n")

                if command == "podman" and arguments[:3] == ["machine", "list", "--format"]:
                    sys.stdout.write(os.environ["MOCK_MACHINE_LIST"])
                elif command == "podman" and arguments[:1] == ["ps"]:
                    sys.stdout.write(os.environ["MOCK_CONTAINER_IDS"])
                elif (
                    command == "podman"
                    and arguments[:1] == ["exec"]
                    and os.environ["MOCK_EXECUTE_INNER_COMMAND"] == "1"
                ):
                    completed = subprocess.run(arguments[3:], check=False)
                    raise SystemExit(completed.returncode)
                elif command == "zsh" and arguments[:1] == ["-c"]:
                    completed = subprocess.run(
                        ["/bin/zsh", *arguments],
                        check=False,
                    )
                    raise SystemExit(completed.returncode)
                elif command == "claude":
                    raise SystemExit(int(os.environ["MOCK_CLAUDE_EXIT_CODE"]))
                """
            )
            commands = ["podman", "devcontainer"]
            if execute_inner_command:
                commands.extend(("zsh", "claude"))
            for command in commands:
                path = bin_directory / command
                path.write_text(fake_command, encoding="utf-8")
                path.chmod(0o755)

            environment = os.environ.copy()
            environment.update(
                {
                    "PATH": f"{bin_directory}{os.pathsep}{environment['PATH']}",
                    "MOCK_COMMAND_LOG": str(command_log),
                    "MOCK_MACHINE_LIST": json.dumps(machine_list),
                    "MOCK_CONTAINER_IDS": container_ids,
                    "MOCK_EXECUTE_INNER_COMMAND": (
                        "1" if execute_inner_command else "0"
                    ),
                    "MOCK_CLAUDE_EXIT_CODE": str(claude_exit_code),
                }
            )
            result = subprocess.run(
                [pwsh, "-NoProfile", "-File", str(DEVCONTAINER_SCRIPT), "-Backend", "podman"],
                cwd=workspace,
                env=environment,
                text=True,
                capture_output=True,
                check=False,
                timeout=15,
            )
            commands = [
                json.loads(line)
                for line in command_log.read_text(encoding="utf-8").splitlines()
            ]
            return result, commands

    def test_o04_feature_agents_use_current_claude_code_tools(self):
        expected = {"Glob", "Grep", "Read", "Bash", "WebFetch", "WebSearch"}
        removed = {"LS", "NotebookRead", "KillShell", "BashOutput", "TodoWrite"}
        self.assertEqual(3, len(FEATURE_AGENTS))

        for path in FEATURE_AGENTS:
            with self.subTest(path=path.name):
                tools_line = re.search(r"^tools: (.+)$", read(path), re.MULTILINE)
                self.assertIsNotNone(tools_line)
                tools = {item.strip() for item in tools_line.group(1).split(",")}
                self.assertEqual(expected, tools)
                self.assertTrue(removed.isdisjoint(tools))
                self.assertIn("Bash", tools)

    def test_o09_every_native_container_command_checks_last_exit_code(self):
        script = read(DEVCONTAINER_SCRIPT)
        lines = script.splitlines()
        native_call = re.compile(
            r"^\s*(?:"
            r"(?:\$machineListOutput\s*=\s*)?& podman (?:machine|system) |"
            r"docker info\b|"
            r"& devcontainer\b|"
            r"\$containerIdOutput\s*=\s*& \$Backend ps\b|"
            r"& \$Backend exec\b"
            r")"
        )
        calls = [index for index, line in enumerate(lines) if native_call.search(line)]
        self.assertEqual(8, len(calls), "update the contract when native calls change")

        for index in calls:
            with self.subTest(command=lines[index].strip()):
                self.assertLess(index + 1, len(lines))
                check = lines[index + 1].strip()
                self.assertTrue(check.startswith("Assert-NativeCommandSucceeded"))
                self.assertIn("-ExitCode $LASTEXITCODE", check)

        self.assertIn("if ($ExitCode -ne 0)", script)
        self.assertIn("-ErrorAction Continue", script)
        self.assertIn("exit $ExitCode", script)

    def test_o09_pwsh_runtime_is_required_by_local_and_ci_quality_gates(self):
        runner = read(REPOSITORY_TEST_RUNNER)
        workflow = read(CONTENT_QUALITY_WORKFLOW)

        required_tools = re.search(
            r"^required_tools=\(([^)]*)\)$", runner, re.MULTILINE
        )
        self.assertIsNotNone(required_tools)
        self.assertIn("pwsh", required_tools.group(1).split())
        self.assertRegex(workflow, r"(?m)^\s+pwsh --version$")

    def test_o09_podman_machine_setup_is_idempotent(self):
        script = read(DEVCONTAINER_SCRIPT)
        self.assertIn("podman machine list --format json", script)
        self.assertIn("ConvertFrom-Json -ErrorAction Stop", script)
        self.assertRegex(
            script,
            re.compile(
                r"if \(-not \$machineExists\) \{.*?"
                r"& podman machine init \$machineName",
                re.DOTALL,
            ),
        )
        self.assertRegex(
            script,
            re.compile(
                r"if \(-not \$machineIsRunning\) \{.*?"
                r"& podman machine start \$machineName -q",
                re.DOTALL,
            ),
        )

    def test_o09_container_lookup_rejects_zero_or_multiple_matches(self):
        script = read(DEVCONTAINER_SCRIPT)
        self.assertIn("if ($containerIds.Count -eq 0)", script)
        self.assertIn("if ($containerIds.Count -gt 1)", script)
        self.assertIn("$containerId = $containerIds[0]", script)
        self.assertNotIn(
            "$containerId = ($containerIdOutput -join [Environment]::NewLine).Trim()",
            script,
        )

    def test_o09_runtime_fixture_covers_rerun_and_container_cardinality(self):
        result, commands = self._run_devcontainer_with_mock_commands(
            [{"Name": "claudeVM", "Running": True}],
            "container-one\n",
        )
        podman_calls = [
            entry["args"] for entry in commands if entry["command"] == "podman"
        ]
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertNotIn(["machine", "init", "claudeVM"], podman_calls)
        self.assertNotIn(["machine", "start", "claudeVM", "-q"], podman_calls)
        self.assertIn(
            [
                "exec",
                "-it",
                "container-one",
                "zsh",
                "-c",
                "claude || exit $?; exec zsh",
            ],
            podman_calls,
        )

        result, commands = self._run_devcontainer_with_mock_commands(
            [],
            "container-one\n",
        )
        podman_calls = [
            entry["args"] for entry in commands if entry["command"] == "podman"
        ]
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn(["machine", "init", "claudeVM"], podman_calls)
        self.assertIn(["machine", "start", "claudeVM", "-q"], podman_calls)

        for container_ids in ("", "container-one\ncontainer-two\n"):
            with self.subTest(container_ids=container_ids):
                result, commands = self._run_devcontainer_with_mock_commands(
                    [{"Name": "claudeVM", "Running": True}],
                    container_ids,
                )
                podman_calls = [
                    entry["args"]
                    for entry in commands
                    if entry["command"] == "podman"
                ]
                self.assertEqual(1, result.returncode)
                self.assertFalse(any(call[:1] == ["exec"] for call in podman_calls))

    def test_o09_inner_claude_failure_is_preserved_without_starting_shell(self):
        result, commands = self._run_devcontainer_with_mock_commands(
            [{"Name": "claudeVM", "Running": True}],
            "container-one\n",
            execute_inner_command=True,
            claude_exit_code=42,
        )
        zsh_calls = [
            entry["args"] for entry in commands if entry["command"] == "zsh"
        ]
        claude_calls = [
            entry["args"] for entry in commands if entry["command"] == "claude"
        ]

        self.assertEqual(
            42,
            result.returncode,
            "zsh calls show whether an interactive shell started: "
            f"{zsh_calls!r}\ncommands={commands!r}\n"
            f"stdout={result.stdout}\nstderr={result.stderr}",
        )
        self.assertEqual([[]], claude_calls)
        self.assertNotIn([], zsh_calls)


class MigrationContractTests(unittest.TestCase):
    def test_o10_opus_41_source_ids_use_the_official_release_date(self):
        skill = read(MIGRATION_SKILL)
        expected = (
            "claude-opus-4-1-20250805",
            "anthropic.claude-opus-4-1-20250805-v1:0",
            "claude-opus-4-1@20250805",
        )
        for model_id in expected:
            self.assertIn(model_id, skill)
        self.assertNotIn("claude-opus-4-1-20250422", skill)
        self.assertNotIn("claude-opus-4-1@20250422", skill)

    def test_o12_effort_examples_match_the_current_sdk_contract(self):
        reference = read(EFFORT_REFERENCE)
        for obsolete in (
            "effort-2025-11-24",
            '"anthropic-beta"',
            "betas=[",
            "betas:",
        ):
            self.assertNotIn(obsolete, reference)
        self.assertGreaterEqual(reference.count("output_config"), 4)

        ast.parse(fenced(reference, "python"))
        json.loads(fenced(reference, "json"))

        typescript = fenced(reference, "typescript")
        self.assertNotIn("[...]", typescript)
        node = shutil.which("node")
        if node:
            source = (
                "const client = { messages: { create: async (request) => request } };\n"
                "async function example() {\n"
                f"{typescript}\n"
                "}\n"
            )
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".mjs", encoding="utf-8"
            ) as stream:
                stream.write(source)
                stream.flush()
                result = subprocess.run(
                    [node, "--check", stream.name],
                    text=True,
                    capture_output=True,
                    check=False,
                )
            self.assertEqual(0, result.returncode, result.stderr)

    def test_o13_effort_changes_require_an_explicit_user_request(self):
        skill = read(MIGRATION_SKILL)
        reference = read(EFFORT_REFERENCE)
        self.assertIn(
            "only when the user explicitly requests an effort level",
            skill,
        )
        self.assertIn(
            "A model-string migration by itself must not add or change effort",
            reference,
        )
        self.assertNotIn('Add effort parameter set to `"high"`', skill)
        self.assertNotIn('Add effort set to `"high"`', reference)


class AgentSdkTemplateContractTests(unittest.TestCase):
    def test_o14_python_agent_sdk_requires_python_310_or_newer(self):
        command = read(SDK_COMMAND)
        verifier = read(SDK_PY_VERIFIER)
        self.assertIn("Python 3.10 or newer", command)
        self.assertIn('requires-python = ">=3.10"', command)
        self.assertIn("Python 3.10 or newer", verifier)
        self.assertNotIn("Python 3.8+", verifier)

    def test_o15_typescript_template_is_runnable_and_typecheckable(self):
        command = read(SDK_COMMAND)
        verifier = read(SDK_TS_VERIFIER)
        self.assertIn(
            "npm install --save-dev typescript ts-node @types/node",
            command,
        )
        for dependency in ("typescript", "ts-node", "@types/node"):
            self.assertIn(dependency, command)
            self.assertIn(dependency, verifier)

        package_fragment = json.loads(fenced(command, "json"))
        scripts = package_fragment["scripts"]
        self.assertIn("ts-node", scripts["start"])
        self.assertEqual("tsc", scripts["build"])
        self.assertEqual("tsc --noEmit", scripts["typecheck"])
        self.assertIn("npm run typecheck", command)
        self.assertIn("npm run typecheck", verifier)


class CommitSafetyContractTests(unittest.TestCase):
    def test_o07_commit_workflows_inspect_untracked_files_and_stage_paths(self):
        for path in COMMIT_COMMANDS:
            with self.subTest(path=path.name):
                command = read(path)
                metadata = frontmatter(command)
                self.assertIn("Read", metadata)
                self.assertIn("git ls-files --others --exclude-standard", command)
                self.assertIn("Before reading any file contents", command)
                self.assertIn("Do not read a blocked file's contents", command)
                self.assertIn(
                    "Inspect every remaining existing candidate individually",
                    command,
                )
                self.assertIn("git diff -- <path>", command)
                self.assertIn("git diff --cached -- <path>", command)
                self.assertIn("git add -- <path>", command)
                self.assertIn("Never run `git add .`, `git add -A`", command)
                self.assertIn(".env", command)
                self.assertIn("credentials", command)
                self.assertIn("private keys", command)
                self.assertIn("safety-confirmed", command)
                self.assertIn("git diff --cached --name-only", command)
                self.assertNotIn("!`git diff HEAD`", command)


if __name__ == "__main__":
    unittest.main()
