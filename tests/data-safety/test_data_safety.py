#!/usr/bin/env python3

import concurrent.futures
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
import textwrap
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RALPH_SETUP = ROOT / "plugins/ralph-wiggum/scripts/setup-ralph-loop.sh"
RALPH_STOP = ROOT / "plugins/ralph-wiggum/hooks/stop-hook.sh"
RALPH_CANCEL = ROOT / "plugins/ralph-wiggum/scripts/cancel-ralph-loop.sh"
RALPH_COMMAND = ROOT / "plugins/ralph-wiggum/commands/ralph-loop.md"
RALPH_CANCEL_COMMAND = ROOT / "plugins/ralph-wiggum/commands/cancel-ralph.md"
RALPH_HELP = ROOT / "plugins/ralph-wiggum/commands/help.md"
RALPH_README = ROOT / "plugins/ralph-wiggum/README.md"
CLEAN_GONE = ROOT / "plugins/commit-commands/commands/clean_gone.md"
FIREWALL = ROOT / ".devcontainer/init-firewall.sh"
DEVCONTAINER_DOCKERFILE = ROOT / ".devcontainer/Dockerfile"
DEVCONTAINER_CONFIG = ROOT / ".devcontainer/devcontainer.json"
CLAUDE_CODE_PACKAGE_METADATA = (
    Path(__file__).with_name("claude-code-2.1.199-package.json")
)
MAX_SUPPORTED_ITERATIONS = 2_147_483_647


def run(command, *, cwd, env=None, input_text=None, check=True):
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"command failed ({result.returncode}): {command}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


class RalphSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.test_root = Path(self.tempdir.name)
        self.cwd = self.test_root / "project"
        self.cwd.mkdir()
        self.config_dir = self.test_root / "claude-config"

    def tearDown(self):
        self.tempdir.cleanup()

    def project_env(self):
        env = os.environ.copy()
        env["CLAUDE_PROJECT_DIR"] = str(self.cwd)
        env["CLAUDE_CONFIG_DIR"] = str(self.config_dir)
        return env

    def setup_loop(
        self,
        session,
        prompt="do work",
        promise=None,
        max_iterations=5,
        *,
        env=None,
        check=True,
    ):
        command = [
            "bash",
            str(RALPH_SETUP),
            "--session-id",
            session,
            "--prompt",
            prompt,
            "--max-iterations",
            str(max_iterations),
        ]
        if promise is not None:
            command.extend(["--completion-promise", promise])
        return run(
            command,
            cwd=self.cwd,
            env=env or self.project_env(),
            check=check,
        )

    def state(self, session):
        return self.config_dir / "ralph-loop" / f"{session}.local.md"

    def call_stop(
        self,
        session,
        transcript,
        *,
        stop_hook_active=False,
        last_assistant_message=None,
        cwd=None,
        env=None,
        check=True,
    ):
        payload_data = {
            "session_id": session,
            "transcript_path": str(transcript),
            "stop_hook_active": stop_hook_active,
            "cwd": str(cwd or self.cwd),
        }
        if last_assistant_message is not None:
            payload_data["last_assistant_message"] = last_assistant_message
        payload = json.dumps(payload_data)
        return run(
            ["bash", str(RALPH_STOP)],
            cwd=cwd or self.cwd,
            env=env or self.project_env(),
            input_text=payload,
            check=check,
        )

    def call_cancel(self, session, *, cwd=None, env=None):
        return run(
            ["bash", str(RALPH_CANCEL), "--session-id", session],
            cwd=cwd or self.cwd,
            env=env or self.project_env(),
        )

    def transcript(self, name, assistant_text):
        path = self.cwd / name
        path.write_text(
            json.dumps(
                {
                    "message": {
                        "role": "assistant",
                        "content": [{"type": "text", "text": assistant_text}],
                    }
                }
            )
            + "\n",
            encoding="utf-8",
        )
        return path

    def replace_state_field(self, session, field, value):
        state_path = self.state(session)
        state = state_path.read_text(encoding="utf-8")
        updated, replacements = re.subn(
            rf"^{re.escape(field)}:[^\n]*$",
            f"{field}: {value}",
            state,
            count=1,
            flags=re.MULTILINE,
        )
        self.assertEqual(replacements, 1)
        state_path.write_text(updated, encoding="utf-8")
        return updated

    def test_command_does_not_expand_arguments_in_shell_block(self):
        command = RALPH_COMMAND.read_text(encoding="utf-8")
        executable_blocks = re.findall(r"```!\n(.*?)```", command, flags=re.DOTALL)
        self.assertTrue(all("$ARGUMENTS" not in block for block in executable_blocks))
        self.assertNotIn("setup-ralph-loop.sh\" $ARGUMENTS", command)

    def test_bash_commands_use_the_current_session_environment_variable(self):
        for path in (RALPH_COMMAND, RALPH_CANCEL_COMMAND, RALPH_HELP, RALPH_README):
            with self.subTest(path=path.name):
                content = path.read_text(encoding="utf-8")
                self.assertIn("CLAUDE_CODE_SESSION_ID", content)
                self.assertNotIn("CLAUDE_SESSION_ID", content)

    def test_setup_and_cancel_fall_back_to_current_session_environment(self):
        env = self.project_env()
        env["CLAUDE_CODE_SESSION_ID"] = "current-session"
        env["CLAUDE_SESSION_ID"] = "legacy-wrong-session"

        setup_result = run(
            ["bash", str(RALPH_SETUP), "--prompt", "environment fallback"],
            cwd=self.cwd,
            env=env,
        )

        self.assertIn("current-session", setup_result.stdout)
        self.assertTrue(self.state("current-session").exists())
        self.assertFalse(self.state("legacy-wrong-session").exists())

        cancel_result = run(
            ["bash", str(RALPH_CANCEL)],
            cwd=self.cwd,
            env=env,
        )

        self.assertIn("Cancelled Ralph loop", cancel_result.stdout)
        self.assertFalse(self.state("current-session").exists())

    def test_prompt_metacharacters_are_literal_and_sessions_are_isolated(self):
        marker = self.cwd / "INJECTED"
        hostile = f"work; printf injected > {marker} #"
        self.setup_loop("session-a", hostile, promise="A")
        self.setup_loop("session-b", "second prompt", promise="B")

        self.assertFalse(marker.exists())
        self.assertIn(hostile, self.state("session-a").read_text(encoding="utf-8"))
        self.assertIn("second prompt", self.state("session-b").read_text(encoding="utf-8"))
        self.assertNotEqual(self.state("session-a"), self.state("session-b"))

    def test_state_is_private_and_never_appears_as_repository_work(self):
        run(["git", "init", "--initial-branch=main"], cwd=self.cwd)

        self.setup_loop("private-state", "TOKEN=private-example")

        status = run(
            ["git", "status", "--short", "--untracked-files=all"],
            cwd=self.cwd,
        )
        state_path = self.state("private-state")
        self.assertEqual(status.stdout, "")
        self.assertTrue(state_path.exists())
        self.assertNotIn(str(self.cwd), str(state_path))
        self.assertEqual(stat.S_IMODE(state_path.parent.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(state_path.stat().st_mode), 0o600)

    def test_setup_refuses_state_symlink_without_touching_target(self):
        state_dir = self.config_dir / "ralph-loop"
        state_dir.mkdir(parents=True)
        target = self.cwd / "protected.txt"
        target.write_text("keep\n", encoding="utf-8")
        (state_dir / "session-a.local.md").symlink_to(target)

        result = run(
            [
                "bash",
                str(RALPH_SETUP),
                "--session-id",
                "session-a",
                "--prompt",
                "new prompt",
            ],
            cwd=self.cwd,
            env=self.project_env(),
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(target.read_text(encoding="utf-8"), "keep\n")
        self.assertTrue((state_dir / "session-a.local.md").is_symlink())

    def test_all_ralph_paths_refuse_a_symbolic_link_config_root(self):
        real_config = self.test_root / "real-config"
        env = self.project_env()
        env["CLAUDE_CONFIG_DIR"] = str(real_config)
        self.setup_loop("existing", env=env)
        expected_state = (
            real_config / "ralph-loop" / "existing.local.md"
        ).read_text(encoding="utf-8")
        self.config_dir.symlink_to(real_config, target_is_directory=True)

        setup = self.setup_loop(
            "new-session", env=self.project_env(), check=False
        )
        stop = self.call_stop(
            "existing",
            self.cwd / "unused.jsonl",
            last_assistant_message="not complete",
            env=self.project_env(),
            check=False,
        )
        cancel = run(
            ["bash", str(RALPH_CANCEL), "--session-id", "existing"],
            cwd=self.cwd,
            env=self.project_env(),
            check=False,
        )

        self.assertNotEqual(setup.returncode, 0)
        self.assertIn("symbolic link", setup.stderr)
        self.assertEqual(0, stop.returncode)
        self.assertEqual("block", json.loads(stop.stdout)["decision"])
        self.assertIn("unsafe private state path", stop.stderr)
        self.assertNotEqual(cancel.returncode, 0)
        self.assertIn("unsafe private Ralph state path", cancel.stderr)
        self.assertEqual(
            expected_state,
            (real_config / "ralph-loop" / "existing.local.md").read_text(
                encoding="utf-8"
            ),
        )
        self.assertFalse(
            (real_config / "ralph-loop" / "new-session.local.md").exists()
        )

    def test_all_ralph_paths_refuse_a_symbolic_link_state_root(self):
        real_state_dir = self.test_root / "real-state"
        real_state_dir.mkdir()
        self.config_dir.mkdir()
        (self.config_dir / "ralph-loop").symlink_to(
            real_state_dir, target_is_directory=True
        )
        state_path = real_state_dir / "existing.local.md"
        state_path.write_text(
            textwrap.dedent(
                """\
                ---
                active: true
                iteration: 1
                max_iterations: 5
                completion_promise: null
                session_id: existing
                ---
                keep this prompt
                """
            ),
            encoding="utf-8",
        )
        expected_state = state_path.read_text(encoding="utf-8")

        setup = self.setup_loop("new-session", check=False)
        stop = self.call_stop(
            "existing",
            self.cwd / "unused.jsonl",
            last_assistant_message="not complete",
            check=False,
        )
        cancel = run(
            ["bash", str(RALPH_CANCEL), "--session-id", "existing"],
            cwd=self.cwd,
            env=self.project_env(),
            check=False,
        )

        self.assertNotEqual(setup.returncode, 0)
        self.assertEqual(0, stop.returncode)
        self.assertEqual("block", json.loads(stop.stdout)["decision"])
        self.assertIn("unsafe private state path", stop.stderr)
        self.assertNotEqual(cancel.returncode, 0)
        self.assertEqual(expected_state, state_path.read_text(encoding="utf-8"))
        self.assertFalse((real_state_dir / "new-session.local.md").exists())

    def test_concurrent_setup_never_overwrites_same_session_state(self):
        for index in range(10):
            session = f"concurrent-setup-{index}"
            prompts = (f"first prompt {index}", f"second prompt {index}")
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                results = list(
                    pool.map(
                        lambda prompt: self.setup_loop(
                            session,
                            prompt=prompt,
                            check=False,
                        ),
                        prompts,
                    )
                )

            self.assertEqual(
                1,
                sum(result.returncode == 0 for result in results),
                [(result.returncode, result.stderr) for result in results],
            )
            state = self.state(session).read_text(encoding="utf-8")
            winning_prompts = [prompt for prompt in prompts if prompt in state]
            self.assertEqual(1, len(winning_prompts))
            self.call_cancel(session)

    def test_setup_refuses_a_symbolic_link_project_root(self):
        real_project = self.cwd / "real-project"
        linked_project = self.cwd / "linked-project"
        real_project.mkdir()
        linked_project.symlink_to(real_project, target_is_directory=True)
        env = self.project_env()
        env["CLAUDE_PROJECT_DIR"] = str(linked_project)

        result = self.setup_loop("session-a", env=env, check=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a safe project directory", result.stderr)
        self.assertFalse((real_project / ".claude").exists())

    def test_setup_accepts_zero_and_portable_max_iteration_boundaries(self):
        zero = self.setup_loop("zero-limit", max_iterations=0)
        self.assertIn("Max iterations: no plugin limit", zero.stdout)
        self.assertIn(
            "max_iterations: 0",
            self.state("zero-limit").read_text(encoding="utf-8"),
        )

        upper = self.setup_loop(
            "upper-limit",
            max_iterations=MAX_SUPPORTED_ITERATIONS,
        )
        self.assertIn(
            f"Max iterations: {MAX_SUPPORTED_ITERATIONS}",
            upper.stdout,
        )
        self.assertIn(
            f"max_iterations: {MAX_SUPPORTED_ITERATIONS}",
            self.state("upper-limit").read_text(encoding="utf-8"),
        )

    def test_setup_normalizes_leading_zero_decimal_limit(self):
        result = self.setup_loop("leading-zero", max_iterations="0008")

        self.assertIn("Max iterations: 8", result.stdout)
        self.assertIn(
            "max_iterations: 8",
            self.state("leading-zero").read_text(encoding="utf-8"),
        )

    def test_setup_rejects_oversized_decimal_before_writing_state(self):
        invalid_limits = (
            str(MAX_SUPPORTED_ITERATIONS + 1),
            ("0" * 200) + str(MAX_SUPPORTED_ITERATIONS + 1),
            "9" * 200,
        )

        for index, invalid_limit in enumerate(invalid_limits):
            session = f"oversized-{index}"
            with self.subTest(limit=invalid_limit):
                result = self.setup_loop(
                    session,
                    max_iterations=invalid_limit,
                    check=False,
                )

                self.assertNotEqual(result.returncode, 0)
                self.assertIn(str(MAX_SUPPORTED_ITERATIONS), result.stderr)
                self.assertFalse(self.state(session).exists())

    def test_stop_state_machine_reaches_max_across_active_continuations(self):
        self.setup_loop("continuations", max_iterations=3)
        transcript = self.transcript("continuations.jsonl", "not complete")

        first = self.call_stop("continuations", transcript)
        self.assertEqual(json.loads(first.stdout)["decision"], "block")
        self.assertIn(
            "iteration: 2",
            self.state("continuations").read_text(encoding="utf-8"),
        )

        second = self.call_stop(
            "continuations",
            transcript,
            stop_hook_active=True,
        )
        self.assertEqual(json.loads(second.stdout)["decision"], "block")
        self.assertIn(
            "iteration: 3",
            self.state("continuations").read_text(encoding="utf-8"),
        )

        third = self.call_stop(
            "continuations",
            transcript,
            stop_hook_active=True,
        )
        self.assertIn("max iterations (3) reached", third.stdout)
        self.assertFalse(self.state("continuations").exists())

    def test_concurrent_stops_serialize_iteration_updates(self):
        self.setup_loop("concurrent-stops", max_iterations=5)
        transcript = self.transcript("concurrent-stops.jsonl", "not complete")

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(
                pool.map(
                    lambda _: self.call_stop(
                        "concurrent-stops", transcript, check=False
                    ),
                    range(2),
                )
            )

        for result in results:
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual("block", json.loads(result.stdout)["decision"])
        self.assertIn(
            "iteration: 3",
            self.state("concurrent-stops").read_text(encoding="utf-8"),
        )

    def test_concurrent_stop_and_cancel_cannot_recreate_cancelled_state(self):
        transcript = self.transcript("stop-cancel.jsonl", "not complete")

        for index in range(20):
            session = f"stop-cancel-{index}"
            self.setup_loop(session, max_iterations=5)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                stop_future = pool.submit(
                    self.call_stop, session, transcript, check=False
                )
                cancel_future = pool.submit(
                    run,
                    ["bash", str(RALPH_CANCEL), "--session-id", session],
                    cwd=self.cwd,
                    env=self.project_env(),
                    check=False,
                )
                stop = stop_future.result()
                cancel = cancel_future.result()

            self.assertEqual(0, stop.returncode, stop.stderr)
            self.assertEqual(0, cancel.returncode, cancel.stderr)
            self.assertFalse(self.state(session).exists())

    def test_deleted_project_blocks_without_replaying_the_prompt(self):
        original_prompt = "edit only the original project"
        self.setup_loop(
            "deleted-project", prompt=original_prompt, max_iterations=5
        )
        env = self.project_env()
        shutil.rmtree(self.cwd)

        stop = self.call_stop(
            "deleted-project",
            self.test_root / "unused.jsonl",
            last_assistant_message="not complete",
            cwd=self.test_root,
            env=env,
            check=False,
        )

        self.assertEqual(0, stop.returncode, stop.stderr)
        response = json.loads(stop.stdout)
        self.assertEqual("block", response["decision"])
        self.assertNotEqual(original_prompt, response["reason"])
        self.assertIn("unavailable", response["reason"])
        self.assertIn(
            "iteration: 1",
            self.state("deleted-project").read_text(encoding="utf-8"),
        )

        cancel = run(
            ["bash", str(RALPH_CANCEL), "--session-id", "deleted-project"],
            cwd=self.test_root,
            env=env,
            check=False,
        )
        self.assertEqual(0, cancel.returncode, cancel.stderr)
        self.assertFalse(self.state("deleted-project").exists())

    def test_replaced_project_blocks_without_replaying_the_prompt(self):
        original_prompt = "edit only the original project"
        self.setup_loop(
            "replaced-project", prompt=original_prompt, max_iterations=5
        )
        original_identity = (self.cwd.stat().st_dev, self.cwd.stat().st_ino)
        moved_project = self.test_root / "moved-original-project"
        self.cwd.rename(moved_project)
        self.cwd.mkdir()
        self.assertNotEqual(
            original_identity,
            (self.cwd.stat().st_dev, self.cwd.stat().st_ino),
        )

        stop = self.call_stop(
            "replaced-project",
            self.test_root / "unused.jsonl",
            last_assistant_message="not complete",
            check=False,
        )

        self.assertEqual(0, stop.returncode, stop.stderr)
        response = json.loads(stop.stdout)
        self.assertEqual("block", response["decision"])
        self.assertNotEqual(original_prompt, response["reason"])
        self.assertIn("changed", response["reason"])
        self.assertIn(
            "iteration: 1",
            self.state("replaced-project").read_text(encoding="utf-8"),
        )

    def test_cancel_recovers_lock_after_owner_is_killed(self):
        session = "killed-lock-owner"
        self.setup_loop(session)
        holder_script = textwrap.dedent(
            f"""\
            source {str(RALPH_SETUP.parent / 'ralph-state.sh')!r}
            ralph_resolve_state_path {session!r}
            ralph_acquire_state_lock {session!r}
            trap ralph_release_state_lock EXIT
            printf 'acquired\\n'
            while :; do sleep 1; done
            """
        )
        holder = subprocess.Popen(
            ["bash", "-c", holder_script],
            cwd=self.cwd,
            env=self.project_env(),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.addCleanup(
            lambda: holder.kill() if holder.poll() is None else None
        )
        self.assertEqual("acquired\n", holder.stdout.readline())

        holder.kill()
        holder.communicate(timeout=5)
        cancel = self.call_cancel(session)

        self.assertIn("Cancelled Ralph loop", cancel.stdout)
        self.assertFalse(self.state(session).exists())
        self.assertFalse(
            (self.config_dir / "ralph-loop" / f".{session}.lock").exists()
        )

    def test_cancel_recovers_stale_lock_when_pid_was_reused(self):
        session = "reused-lock-pid"
        self.setup_loop(session)
        lock_dir = self.config_dir / "ralph-loop" / f".{session}.lock"
        lock_dir.mkdir(mode=0o700)
        (lock_dir / "owner.json").write_text(
            json.dumps(
                {
                    "pid": os.getpid(),
                    "identity": "different-process-start-identity",
                }
            ),
            encoding="utf-8",
        )

        cancel = self.call_cancel(session)

        self.assertIn("Cancelled Ralph loop", cancel.stdout)
        self.assertFalse(self.state(session).exists())
        self.assertFalse(lock_dir.exists())

    def test_cancel_recovers_aged_ownerless_lock(self):
        session = "ownerless-lock"
        self.setup_loop(session)
        lock_dir = self.config_dir / "ralph-loop" / f".{session}.lock"
        lock_dir.mkdir(mode=0o700)
        old_timestamp = time.time() - 10
        os.utime(lock_dir, (old_timestamp, old_timestamp))

        cancel = self.call_cancel(session)

        self.assertIn("Cancelled Ralph loop", cancel.stdout)
        self.assertFalse(self.state(session).exists())
        self.assertFalse(lock_dir.exists())

    def test_cancel_recovers_aged_malformed_owner_lock(self):
        session = "malformed-owner-lock"
        self.setup_loop(session)
        lock_dir = self.config_dir / "ralph-loop" / f".{session}.lock"
        lock_dir.mkdir(mode=0o700)
        owner_file = lock_dir / "owner.json"
        owner_file.write_text('{"pid":', encoding="utf-8")
        owner_file.chmod(0o600)
        old_timestamp = time.time() - 10
        os.utime(owner_file, (old_timestamp, old_timestamp))
        os.utime(lock_dir, (old_timestamp, old_timestamp))

        cancel = self.call_cancel(session)

        self.assertIn("Cancelled Ralph loop", cancel.stdout)
        self.assertFalse(self.state(session).exists())
        self.assertFalse(lock_dir.exists())

    def test_reclaimer_stands_down_when_delayed_owner_is_published(self):
        session = "delayed-lock-owner"
        self.setup_loop(session)
        lock_dir = self.config_dir / "ralph-loop" / f".{session}.lock"
        lock_dir.mkdir(mode=0o700)
        old_timestamp = time.time() - 10
        os.utime(lock_dir, (old_timestamp, old_timestamp))

        identity = run(
            [
                "bash",
                "-c",
                'source "$1"; ralph_process_identity "$2"',
                "ralph-process-identity",
                str(RALPH_SETUP.parent / "ralph-state.sh"),
                str(os.getpid()),
            ],
            cwd=self.cwd,
            env=self.project_env(),
        ).stdout.strip()
        self.assertTrue(identity)

        cancel = subprocess.Popen(
            ["bash", str(RALPH_CANCEL), "--session-id", session],
            cwd=self.cwd,
            env=self.project_env(),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.addCleanup(
            lambda: cancel.kill() if cancel.poll() is None else None
        )
        reclaim_marker = lock_dir / ".reclaim"
        deadline = time.monotonic() + 2
        while not reclaim_marker.exists() and time.monotonic() < deadline:
            self.assertIsNone(cancel.poll(), "cancel exited before the recheck")
            time.sleep(0.002)
        self.assertTrue(reclaim_marker.is_dir())

        owner_file = lock_dir / "owner.json"
        owner_file.write_text(
            json.dumps({"pid": os.getpid(), "identity": identity}),
            encoding="utf-8",
        )
        owner_file.chmod(0o600)

        deadline = time.monotonic() + 2
        while reclaim_marker.exists() and time.monotonic() < deadline:
            time.sleep(0.002)
        self.assertFalse(reclaim_marker.exists())
        self.assertIsNone(cancel.poll())
        self.assertTrue(self.state(session).exists())

        owner_file.unlink()
        lock_dir.rmdir()
        stdout, stderr = cancel.communicate(timeout=5)
        self.assertEqual(0, cancel.returncode, stderr)
        self.assertIn("Cancelled Ralph loop", stdout)
        self.assertFalse(self.state(session).exists())

    def test_delayed_publisher_never_overwrites_replacement_lock_owner(self):
        session = "replaced-lock-during-publish"
        self.setup_loop(session)
        ready = self.test_root / "publisher-ready"
        resume = self.test_root / "publisher-resume"
        holder_script = textwrap.dedent(
            f"""\
            source {str(RALPH_SETUP.parent / 'ralph-state.sh')!r}
            ralph_resolve_state_path {session!r}
            eval "$(declare -f ralph_directory_identity | sed '1s/ralph_directory_identity/ralph_original_directory_identity/')"
            ralph_directory_identity() {{
              local identity
              identity=$(ralph_original_directory_identity "$1") || return 1
              if [[ "$1" = "$RALPH_STATE_LOCK_DIR" && ! -e {str(ready)!r} ]]; then
                touch {str(ready)!r}
                while [[ ! -e {str(resume)!r} ]]; do sleep 0.01; done
              fi
              printf '%s\\n' "$identity"
            }}
            if ralph_acquire_state_lock {session!r}; then
              printf 'unexpectedly-acquired\\n'
              ralph_release_state_lock
            else
              printf 'publication-failed-safely\\n'
            fi
            """
        )
        holder = subprocess.Popen(
            ["bash", "-c", holder_script],
            cwd=self.cwd,
            env=self.project_env(),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.addCleanup(
            lambda: holder.kill() if holder.poll() is None else None
        )

        deadline = time.monotonic() + 2
        while not ready.exists() and time.monotonic() < deadline:
            self.assertIsNone(holder.poll(), "publisher exited before pausing")
            time.sleep(0.002)
        self.assertTrue(ready.exists())

        lock_dir = self.config_dir / "ralph-loop" / f".{session}.lock"
        moved_lock = self.test_root / "original-publishing-lock"
        lock_dir.rename(moved_lock)
        lock_dir.mkdir(mode=0o700)
        replacement_owner = lock_dir / "owner.json"
        expected_owner = '{"sentinel":"replacement-lock-owner"}\n'
        replacement_owner.write_text(expected_owner, encoding="utf-8")
        replacement_owner.chmod(0o600)
        resume.touch()

        stdout, stderr = holder.communicate(timeout=5)
        self.assertEqual(0, holder.returncode, stderr)
        self.assertIn("publication-failed-safely", stdout)
        self.assertEqual(
            expected_owner,
            replacement_owner.read_text(encoding="utf-8"),
        )

    def test_stop_active_continuation_detects_completion_tag(self):
        self.setup_loop("completion", promise="DONE", max_iterations=5)

        first = self.call_stop(
            "completion",
            self.transcript("completion-first.jsonl", "not complete"),
        )
        self.assertEqual(json.loads(first.stdout)["decision"], "block")

        second = self.call_stop(
            "completion",
            self.transcript(
                "completion-second.jsonl",
                "All checks passed\n<promise>DONE</promise>",
            ),
            stop_hook_active=True,
        )

        self.assertIn("detected exact completion tag", second.stdout)
        self.assertFalse(self.state("completion").exists())

    def test_current_assistant_message_takes_priority_over_stale_transcript(self):
        self.setup_loop("current-message", promise="DONE", max_iterations=5)
        stale_transcript = self.transcript(
            "current-message.jsonl", "work is still in progress"
        )

        result = self.call_stop(
            "current-message",
            stale_transcript,
            last_assistant_message="All checks passed\n<promise>DONE</promise>",
        )

        self.assertIn("detected exact completion tag", result.stdout)
        self.assertFalse(self.state("current-message").exists())

    def test_current_assistant_message_does_not_require_a_valid_transcript(self):
        self.setup_loop("current-malformed", promise="DONE", max_iterations=5)
        malformed_transcript = self.cwd / "current-malformed.jsonl"
        malformed_transcript.write_text("{broken json\n", encoding="utf-8")

        result = self.call_stop(
            "current-malformed",
            malformed_transcript,
            last_assistant_message="<promise>DONE</promise>",
        )

        self.assertIn("detected exact completion tag", result.stdout)
        self.assertFalse(self.state("current-malformed").exists())

    def test_stop_active_continuation_blocks_corrupted_state(self):
        self.setup_loop("corrupted-active", max_iterations=3)
        expected_state = self.replace_state_field(
            "corrupted-active",
            "iteration",
            "1+1",
        )
        transcript = self.transcript("corrupted-active.jsonl", "not complete")

        result = self.call_stop(
            "corrupted-active",
            transcript,
            stop_hook_active=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        self.assertIn("invalid numeric", result.stderr)
        self.assertEqual(
            self.state("corrupted-active").read_text(encoding="utf-8"),
            expected_state,
        )

    def test_stop_active_continuation_blocks_missing_transcript(self):
        self.setup_loop("missing-transcript-active", max_iterations=3)
        state_before = self.state("missing-transcript-active").read_text(
            encoding="utf-8"
        )

        result = self.call_stop(
            "missing-transcript-active",
            self.cwd / "missing.jsonl",
            stop_hook_active=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        self.assertIn("transcript file not found", result.stderr)
        self.assertEqual(
            self.state("missing-transcript-active").read_text(encoding="utf-8"),
            state_before,
        )

    def test_stop_hook_active_must_be_boolean(self):
        self.setup_loop("invalid-active-type", max_iterations=3)
        state_before = self.state("invalid-active-type").read_text(encoding="utf-8")
        transcript = self.transcript("invalid-active-type.jsonl", "not complete")

        result = self.call_stop(
            "invalid-active-type",
            transcript,
            stop_hook_active="true",
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stop_hook_active must be a boolean", result.stderr)
        self.assertEqual(
            self.state("invalid-active-type").read_text(encoding="utf-8"),
            state_before,
        )

    def test_docs_explain_runtime_continuation_limit_and_state_lifecycle(self):
        for path in (RALPH_HELP, RALPH_README):
            with self.subTest(path=path.name):
                content = path.read_text(encoding="utf-8")
                self.assertIn("8 consecutive Stop-hook continuations", content)
                self.assertIn("stop_hook_active", content)
                self.assertIn("/cancel-ralph", content)

    def test_project_root_is_stable_when_hook_cwd_changes(self):
        self.setup_loop("session-a", prompt="continue")
        nested = self.cwd / "nested-repository"
        nested.mkdir()
        run(["git", "init", "--initial-branch=nested"], cwd=nested)
        transcript = self.transcript("transcript.jsonl", "not complete")

        result = self.call_stop("session-a", transcript, cwd=nested)

        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        self.assertTrue(self.state("session-a").exists())
        self.assertIn("iteration: 2", self.state("session-a").read_text())

    def test_stop_blocks_when_session_moves_to_another_project(self):
        self.setup_loop("project-switch", prompt="continue in project a")
        state_before = self.state("project-switch").read_text(encoding="utf-8")
        project_b = self.test_root / "project-b"
        project_b.mkdir()

        result = self.call_stop(
            "project-switch",
            self.cwd / "unused.jsonl",
            cwd=project_b,
            env=self.project_env(),
            last_assistant_message="not complete",
            check=False,
        )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("block", json.loads(result.stdout)["decision"])
        self.assertIn("different project", result.stderr)
        self.assertIn("/cancel-ralph", json.loads(result.stdout)["reason"])
        self.assertEqual(
            state_before,
            self.state("project-switch").read_text(encoding="utf-8"),
        )

    def test_git_top_level_is_used_when_project_env_is_unset(self):
        run(["git", "init", "--initial-branch=main"], cwd=self.cwd)
        env = self.project_env()
        env.pop("CLAUDE_PROJECT_DIR", None)
        self.setup_loop("session-a", env=env)
        nested = self.cwd / "nested"
        nested.mkdir()
        transcript = self.transcript("transcript.jsonl", "not complete")

        result = self.call_stop(
            "session-a",
            transcript,
            cwd=nested,
            env=env,
        )

        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        self.assertTrue(self.state("session-a").exists())

    def test_cancel_uses_the_same_project_root_from_a_subdirectory(self):
        self.setup_loop("session-a")
        nested = self.cwd / "nested"
        nested.mkdir()

        result = self.call_cancel("session-a", cwd=nested)

        self.assertIn("Cancelled Ralph loop", result.stdout)
        self.assertFalse(self.state("session-a").exists())

    def test_iteration_update_preserves_same_named_prompt_lines(self):
        prompt = "first line\niteration: keep this prompt line exactly\nlast line"
        self.setup_loop("session-a", prompt=prompt)
        state_path = self.state("session-a")
        body_before = state_path.read_text(encoding="utf-8").split("---\n", 2)[2]
        transcript = self.transcript("transcript.jsonl", "not complete")

        result = self.call_stop("session-a", transcript)

        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        state_after = state_path.read_text(encoding="utf-8")
        body_after = state_after.split("---\n", 2)[2]
        self.assertEqual(body_before, body_after)
        self.assertIn("iteration: 2", state_after.split("---\n", 2)[1])
        self.assertIn("iteration: keep this prompt line exactly", body_after)

    def test_stop_rejects_oversized_or_expression_state_without_mutation(self):
        tampered_values = (
            ("iteration", "0"),
            ("iteration", str(MAX_SUPPORTED_ITERATIONS + 1)),
            ("iteration", "9" * 200),
            ("iteration", "not-a-number"),
            ("iteration", "1+1"),
            ("max_iterations", str(MAX_SUPPORTED_ITERATIONS + 1)),
            ("max_iterations", "9" * 200),
            ("max_iterations", "1+1"),
        )

        for index, (field, value) in enumerate(tampered_values):
            session = f"tampered-{index}"
            with self.subTest(field=field, value=value):
                self.setup_loop(session, max_iterations=0)
                expected_state = self.replace_state_field(session, field, value)
                transcript = self.transcript(
                    f"tampered-{index}.jsonl",
                    "not complete",
                )

                result = self.call_stop(
                    session,
                    transcript,
                    check=False,
                )

                self.assertEqual(result.returncode, 0)
                self.assertEqual(json.loads(result.stdout)["decision"], "block")
                self.assertIn("invalid numeric", result.stderr)
                self.assertEqual(
                    self.state(session).read_text(encoding="utf-8"),
                    expected_state,
                )

    def test_stop_treats_leading_zero_state_as_decimal(self):
        self.setup_loop("leading-zero-state", max_iterations=0)
        self.replace_state_field("leading-zero-state", "max_iterations", "0008")
        self.replace_state_field("leading-zero-state", "iteration", "0008")
        transcript = self.transcript("leading-zero-state.jsonl", "not complete")

        result = self.call_stop(
            "leading-zero-state",
            transcript,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("max iterations (8) reached", result.stdout)
        self.assertFalse(self.state("leading-zero-state").exists())

    def test_stop_reaches_portable_iteration_bound_without_overflow(self):
        self.setup_loop("boundary", max_iterations=0)
        self.replace_state_field(
            "boundary",
            "iteration",
            str(MAX_SUPPORTED_ITERATIONS - 1),
        )
        transcript = self.transcript("boundary.jsonl", "not complete")

        advance = self.call_stop("boundary", transcript, check=False)

        self.assertEqual(advance.returncode, 0, advance.stderr)
        self.assertEqual(json.loads(advance.stdout)["decision"], "block")
        self.assertIn(
            f"iteration: {MAX_SUPPORTED_ITERATIONS}",
            self.state("boundary").read_text(encoding="utf-8"),
        )

        state_at_boundary = self.state("boundary").read_text(encoding="utf-8")
        cannot_advance = self.call_stop("boundary", transcript, check=False)

        self.assertEqual(cannot_advance.returncode, 0, cannot_advance.stderr)
        self.assertEqual(json.loads(cannot_advance.stdout)["decision"], "block")
        self.assertIn("cannot advance", cannot_advance.stderr)
        self.assertEqual(
            self.state("boundary").read_text(encoding="utf-8"),
            state_at_boundary,
        )

    def test_stop_removes_state_when_maximum_boundary_is_reached(self):
        self.setup_loop(
            "boundary-stop",
            max_iterations=MAX_SUPPORTED_ITERATIONS,
        )
        self.replace_state_field(
            "boundary-stop",
            "iteration",
            str(MAX_SUPPORTED_ITERATIONS),
        )
        transcript = self.transcript("boundary-stop.jsonl", "not complete")

        result = self.call_stop("boundary-stop", transcript, check=False)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("max iterations", result.stdout)
        self.assertFalse(self.state("boundary-stop").exists())

    def test_bare_promise_does_not_complete_but_exact_tag_does(self):
        self.setup_loop("bare", promise="DONE")
        bare_result = self.call_stop("bare", self.transcript("bare.jsonl", "DONE"))
        self.assertEqual(json.loads(bare_result.stdout)["decision"], "block")
        self.assertTrue(self.state("bare").exists())

        self.setup_loop("tagged", promise="DONE")
        tagged_result = self.call_stop(
            "tagged", self.transcript("tagged.jsonl", "All set\n<promise>DONE</promise>")
        )
        self.assertIn("detected exact completion tag", tagged_result.stdout)
        self.assertFalse(self.state("tagged").exists())

    def test_malformed_jsonl_blocks_and_preserves_state(self):
        self.setup_loop("session-a", promise="DONE")
        transcript = self.transcript("broken.jsonl", "not done")
        with transcript.open("a", encoding="utf-8") as stream:
            stream.write("{broken json\n")

        result = self.call_stop("session-a", transcript)

        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        self.assertIn("malformed", result.stderr)
        self.assertTrue(self.state("session-a").exists())
        self.assertIn("iteration: 1", self.state("session-a").read_text(encoding="utf-8"))


class CleanGoneSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.repo = Path(self.tempdir.name) / "repo"
        self.remote = Path(self.tempdir.name) / "remote.git"
        self.repo.mkdir()
        run(["git", "init", "--initial-branch=main"], cwd=self.repo)
        run(["git", "config", "user.name", "Regression Test"], cwd=self.repo)
        run(["git", "config", "user.email", "test@example.invalid"], cwd=self.repo)
        (self.repo / "tracked.txt").write_text("base\n", encoding="utf-8")
        (self.repo / ".gitignore").write_text(".local-cache/\n", encoding="utf-8")
        run(["git", "add", "tracked.txt", ".gitignore"], cwd=self.repo)
        run(["git", "commit", "-m", "base"], cwd=self.repo)
        run(["git", "init", "--bare", str(self.remote)], cwd=self.repo)
        run(["git", "remote", "add", "origin", str(self.remote)], cwd=self.repo)
        run(["git", "push", "-u", "origin", "main"], cwd=self.repo)

    def tearDown(self):
        self.tempdir.cleanup()

    def make_gone_tracking(self, branch):
        tip = run(["git", "rev-parse", branch], cwd=self.repo).stdout.strip()
        run(["git", "config", f"branch.{branch}.remote", "origin"], cwd=self.repo)
        run(
            ["git", "config", f"branch.{branch}.merge", f"refs/heads/{branch}"],
            cwd=self.repo,
        )
        run(["git", "update-ref", f"refs/remotes/origin/{branch}", tip], cwd=self.repo)
        run(["git", "update-ref", "-d", f"refs/remotes/origin/{branch}"], cwd=self.repo)

    def branch_exists(self, branch):
        return (
            run(
                ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
                cwd=self.repo,
                check=False,
            ).returncode
            == 0
        )

    def test_only_clean_fully_merged_gone_branch_is_removed(self):
        # A healthy upstream with a misleading commit subject must never match.
        run(["git", "switch", "-c", "healthy"], cwd=self.repo)
        (self.repo / "tracked.txt").write_text("healthy\n", encoding="utf-8")
        run(["git", "commit", "-am", "[gone] legitimate subject"], cwd=self.repo)
        run(["git", "push", "-u", "origin", "healthy"], cwd=self.repo)
        run(["git", "switch", "main"], cwd=self.repo)

        # Dirty and untracked work in an associated worktree must be preserved.
        run(["git", "branch", "gone-dirty", "main"], cwd=self.repo)
        self.make_gone_tracking("gone-dirty")
        dirty_worktree = Path(self.tempdir.name) / "dirty-worktree"
        run(["git", "worktree", "add", str(dirty_worktree), "gone-dirty"], cwd=self.repo)
        (dirty_worktree / "tracked.txt").write_text("dirty\n", encoding="utf-8")
        (dirty_worktree / "untracked.txt").write_text("keep\n", encoding="utf-8")

        # A gone branch with a unique commit must be preserved even when clean.
        run(["git", "switch", "-c", "gone-unique"], cwd=self.repo)
        (self.repo / "unique.txt").write_text("unique\n", encoding="utf-8")
        run(["git", "add", "unique.txt"], cwd=self.repo)
        run(["git", "commit", "-m", "unique work"], cwd=self.repo)
        run(["git", "switch", "main"], cwd=self.repo)
        self.make_gone_tracking("gone-unique")

        # Ignored files may still contain valuable local state and must not be
        # deleted along with an otherwise clean associated worktree.
        run(["git", "branch", "gone-ignored", "main"], cwd=self.repo)
        self.make_gone_tracking("gone-ignored")
        ignored_worktree = Path(self.tempdir.name) / "ignored-worktree"
        run(
            ["git", "worktree", "add", str(ignored_worktree), "gone-ignored"],
            cwd=self.repo,
        )
        ignored_cache = ignored_worktree / ".local-cache"
        ignored_cache.mkdir()
        (ignored_cache / "valuable.txt").write_text("keep\n", encoding="utf-8")

        # This branch is gone, clean, and fully merged into main, so it is safe.
        run(["git", "switch", "-c", "gone-merged"], cwd=self.repo)
        (self.repo / "merged.txt").write_text("merged\n", encoding="utf-8")
        run(["git", "add", "merged.txt"], cwd=self.repo)
        run(["git", "commit", "-m", "merged work"], cwd=self.repo)
        run(["git", "switch", "main"], cwd=self.repo)
        run(["git", "merge", "--ff-only", "gone-merged"], cwd=self.repo)
        self.make_gone_tracking("gone-merged")
        merged_worktree = Path(self.tempdir.name) / "merged-worktree"
        run(["git", "worktree", "add", str(merged_worktree), "gone-merged"], cwd=self.repo)

        markdown = CLEAN_GONE.read_text(encoding="utf-8")
        match = re.search(r"```bash\n(.*?)\n```", markdown, flags=re.DOTALL)
        self.assertIsNotNone(match)
        result = run(["bash", "-c", match.group(1)], cwd=self.repo)

        self.assertTrue(self.branch_exists("healthy"))
        self.assertTrue(self.branch_exists("gone-dirty"))
        self.assertTrue(dirty_worktree.exists())
        self.assertEqual((dirty_worktree / "untracked.txt").read_text(), "keep\n")
        self.assertTrue(self.branch_exists("gone-unique"))
        self.assertTrue(self.branch_exists("gone-ignored"))
        self.assertTrue((ignored_cache / "valuable.txt").exists())
        self.assertFalse(self.branch_exists("gone-merged"))
        self.assertFalse(merged_worktree.exists())
        self.assertGreaterEqual(
            result.stdout.count(
                "associated worktree has tracked, untracked, or ignored files"
            ),
            2,
        )
        self.assertIn("commits not merged", result.stdout)

    def test_hidden_index_flags_preserve_modified_worktrees_and_branches(self):
        worktrees = {}
        for branch, flag in (
            ("gone-assume-unchanged", "--assume-unchanged"),
            ("gone-skip-worktree", "--skip-worktree"),
        ):
            run(["git", "branch", branch, "main"], cwd=self.repo)
            self.make_gone_tracking(branch)
            worktree = Path(self.tempdir.name) / branch
            run(["git", "worktree", "add", str(worktree), branch], cwd=self.repo)
            run(["git", "update-index", flag, "tracked.txt"], cwd=worktree)
            (worktree / "tracked.txt").write_text(
                f"valuable {flag} work\n", encoding="utf-8"
            )
            self.assertEqual(
                run(
                    ["git", "status", "--porcelain", "--untracked-files=all"],
                    cwd=worktree,
                ).stdout,
                "",
            )
            worktrees[branch] = worktree

        markdown = CLEAN_GONE.read_text(encoding="utf-8")
        match = re.search(r"```bash\n(.*?)\n```", markdown, flags=re.DOTALL)
        self.assertIsNotNone(match)
        result = run(["bash", "-c", match.group(1)], cwd=self.repo)

        for branch, worktree in worktrees.items():
            with self.subTest(branch=branch):
                self.assertTrue(self.branch_exists(branch))
                self.assertTrue(worktree.exists())
                self.assertIn("valuable", (worktree / "tracked.txt").read_text())
        self.assertGreaterEqual(result.stdout.count("index visibility flags"), 2)


class DevcontainerSafetyTests(unittest.TestCase):
    def test_claude_code_install_is_pinned_to_the_engine_fixture_version(self):
        metadata = json.loads(
            CLAUDE_CODE_PACKAGE_METADATA.read_text(encoding="utf-8")
        )
        expected_version = metadata["version"]
        dockerfile = DEVCONTAINER_DOCKERFILE.read_text(encoding="utf-8")
        config = json.loads(DEVCONTAINER_CONFIG.read_text(encoding="utf-8"))

        version_match = re.search(
            r"^ARG CLAUDE_CODE_VERSION=([^\s]+)$",
            dockerfile,
            flags=re.MULTILINE,
        )
        self.assertIsNotNone(version_match)
        self.assertEqual(expected_version, version_match.group(1))
        self.assertEqual(
            expected_version,
            config["build"]["args"]["CLAUDE_CODE_VERSION"],
        )

    def test_node_image_satisfies_claude_code_package_engine(self):
        metadata = json.loads(
            CLAUDE_CODE_PACKAGE_METADATA.read_text(encoding="utf-8")
        )
        node_requirement = metadata["engines"]["node"]
        requirement_match = re.fullmatch(
            r"\s*>=\s*(\d+)\.(\d+)\.(\d+)\s*", node_requirement
        )
        self.assertIsNotNone(
            requirement_match,
            f"unsupported Node.js engine constraint: {node_requirement}",
        )

        dockerfile = DEVCONTAINER_DOCKERFILE.read_text(encoding="utf-8")
        image_match = re.search(
            r"^FROM\s+(?:--platform=\S+\s+)?node:(\d+)(?:[.-]\S+)?"
            r"(?:\s+AS\s+\S+)?\s*$",
            dockerfile,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        self.assertIsNotNone(image_match, "Node.js base image not found")

        image_version = (int(image_match.group(1)), 0, 0)
        required_version = tuple(int(part) for part in requirement_match.groups())
        self.assertGreaterEqual(
            image_version,
            required_version,
            (
                f"node:{image_match.group(1)} does not satisfy "
                f"{metadata['name']}@{metadata['version']} "
                f"engines.node={node_requirement}"
            ),
        )


class FirewallSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.cwd = Path(self.tempdir.name)
        self.bin = self.cwd / "bin"
        self.bin.mkdir()
        self.log = self.cwd / "commands.log"
        self._make_stubs()
        self.env = os.environ.copy()
        self.env["PATH"] = f"{self.bin}:{self.env['PATH']}"
        self.env["FIREWALL_TEST_LOG"] = str(self.log)

    def tearDown(self):
        self.tempdir.cleanup()

    def write_executable(self, name, content):
        path = self.bin / name
        path.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")
        path.chmod(path.stat().st_mode | stat.S_IXUSR)

    def _make_stubs(self):
        recorder = """
            #!/bin/bash
            command_name="${0##*/}"
            printf '%s' "$command_name" >> "$FIREWALL_TEST_LOG"
            printf ' <%s>' "$@" >> "$FIREWALL_TEST_LOG"
            printf '\n' >> "$FIREWALL_TEST_LOG"
            if [[ "$command_name" = "ip6tables" \
              && "${FIREWALL_TEST_FAIL_FIRST_IPV6_POLICY:-0}" = "1" \
              && ! -e "$FIREWALL_TEST_IPV6_FAILURE_MARKER" ]]; then
              : > "$FIREWALL_TEST_IPV6_FAILURE_MARKER"
              exit 42
            fi
        """
        for name in ("iptables", "ip6tables", "ipset"):
            self.write_executable(name, recorder)

        self.write_executable(
            "iptables-save",
            """
            #!/bin/bash
            printf 'iptables-save' >> "$FIREWALL_TEST_LOG"
            printf ' <%s>' "$@" >> "$FIREWALL_TEST_LOG"
            printf '\n' >> "$FIREWALL_TEST_LOG"
            """,
        )
        self.write_executable(
            "dig",
            """
            #!/bin/bash
            printf 'dig' >> "$FIREWALL_TEST_LOG"
            printf ' <%s>' "$@" >> "$FIREWALL_TEST_LOG"
            printf '\n' >> "$FIREWALL_TEST_LOG"
            record_type="$3"
            domain="$4"
            if [[ "$domain" = "statsig.anthropic.com" \
              && "${FIREWALL_TEST_STATSIG_ANTHROPIC_NXDOMAIN:-0}" = "1" ]]; then
              exit 0
            fi
            case "$domain" in
              claude.ai) address_v4=192.0.2.21; address_v6=2001:db8::21 ;;
              platform.claude.com) address_v4=192.0.2.22; address_v6=2001:db8::22 ;;
              downloads.claude.ai) address_v4=192.0.2.23; address_v6=2001:db8::23 ;;
              raw.githubusercontent.com) address_v4=192.0.2.24; address_v6=2001:db8::24 ;;
              *) address_v4=192.0.2.10; address_v6=2001:db8::10 ;;
            esac
            if [[ "$record_type" = "A" ]]; then
              printf '%s. 60 IN A %s\n' "$domain" "$address_v4"
            elif [[ "$record_type" = "AAAA" ]]; then
              printf '%s. 60 IN AAAA %s\n' "$domain" "$address_v6"
            fi
            """,
        )
        self.write_executable(
            "ip",
            """
            #!/bin/bash
            printf 'ip' >> "$FIREWALL_TEST_LOG"
            printf ' <%s>' "$@" >> "$FIREWALL_TEST_LOG"
            printf '\n' >> "$FIREWALL_TEST_LOG"
            if [[ "$1" = "-4" ]]; then
              echo 'default via 172.17.0.1 dev eth0'
            elif [[ "$1" = "-6" ]]; then
              echo 'default via 2001:db8::1 dev eth0'
            fi
            """,
        )
        self.write_executable(
            "curl",
            """
            #!/bin/bash
            printf 'curl' >> "$FIREWALL_TEST_LOG"
            printf ' <%s>' "$@" >> "$FIREWALL_TEST_LOG"
            printf '\n' >> "$FIREWALL_TEST_LOG"
            url="${!#}"
            case "$url" in
              https://api.github.com/meta)
                [[ "${FIREWALL_TEST_FAIL_META:-0}" = 0 ]] || exit 22
                printf '%s\n' '{"web":["192.30.252.0/22","2606:50c0::/32"],"api":["192.30.252.0/22"],"git":["192.30.252.0/22","2606:50c0::/32"]}'
                ;;
              https://example.com) exit 28 ;;
              https://api.github.com/zen) echo 'Keep it logically awesome' ;;
              *) exit 2 ;;
            esac
            """,
        )

    def command_log(self):
        return self.log.read_text(encoding="utf-8").splitlines()

    def test_initial_ipv6_policy_failure_runs_fail_closed_cleanup(self):
        env = self.env.copy()
        env["FIREWALL_TEST_FAIL_FIRST_IPV6_POLICY"] = "1"
        env["FIREWALL_TEST_IPV6_FAILURE_MARKER"] = str(
            self.cwd / "ipv6-policy-failed"
        )

        result = run(["bash", str(FIREWALL)], cwd=self.cwd, env=env, check=False)

        self.assertEqual(result.returncode, 42)
        self.assertIn("Firewall initialization failed", result.stderr)
        lines = self.command_log()
        failed_ipv6_policy = lines.index("ip6tables <-P> <OUTPUT> <DROP>")
        cleanup_lines = lines[failed_ipv6_policy + 1 :]
        for command_name in ("iptables", "ip6tables"):
            for chain in ("OUTPUT", "INPUT", "FORWARD"):
                self.assertIn(
                    f"{command_name} <-P> <{chain}> <DROP>", cleanup_lines
                )
            self.assertIn(f"{command_name} <-F>", cleanup_lines)

    def test_missing_ipv6_tool_still_fail_closes_available_ipv4_family(self):
        (self.bin / "ip6tables").unlink()
        env = self.env.copy()
        env["PATH"] = str(self.bin)

        result = run(
            ["/bin/bash", str(FIREWALL)], cwd=self.cwd, env=env, check=False
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("Required command is unavailable: ip6tables", result.stderr)
        self.assertIn("Firewall initialization failed", result.stderr)
        lines = self.command_log()
        for chain in ("OUTPUT", "INPUT", "FORWARD"):
            self.assertIn(f"iptables <-P> <{chain}> <DROP>", lines)
        self.assertIn("iptables <-F>", lines)
        self.assertFalse(any(line.startswith("ip6tables ") for line in lines))

    def test_missing_ipv4_tool_still_fail_closes_available_ipv6_family(self):
        (self.bin / "iptables").unlink()
        env = self.env.copy()
        env["PATH"] = str(self.bin)

        result = run(
            ["/bin/bash", str(FIREWALL)], cwd=self.cwd, env=env, check=False
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("Required command is unavailable: iptables", result.stderr)
        self.assertIn("Firewall initialization failed", result.stderr)
        lines = self.command_log()
        for chain in ("OUTPUT", "INPUT", "FORWARD"):
            self.assertIn(f"ip6tables <-P> <{chain}> <DROP>", lines)
        self.assertIn("ip6tables <-F>", lines)
        self.assertFalse(any(line.startswith("iptables ") for line in lines))

    def test_remote_failure_leaves_ipv4_and_ipv6_default_drop(self):
        env = self.env.copy()
        env["FIREWALL_TEST_FAIL_META"] = "1"

        result = run(["bash", str(FIREWALL)], cwd=self.cwd, env=env, check=False)

        self.assertNotEqual(result.returncode, 0)
        lines = self.command_log()
        v4_drop = lines.index("iptables <-P> <OUTPUT> <DROP>")
        v6_drop = lines.index("ip6tables <-P> <OUTPUT> <DROP>")
        first_flush = lines.index("iptables <-F>")
        meta_fetch = next(i for i, line in enumerate(lines) if "https://api.github.com/meta" in line)
        self.assertLess(v4_drop, first_flush)
        self.assertLess(v6_drop, first_flush)
        self.assertLess(v4_drop, meta_fetch)
        self.assertLess(v6_drop, meta_fetch)
        self.assertTrue(
            any(i > meta_fetch and line == "iptables <-F>" for i, line in enumerate(lines))
        )
        self.assertTrue(
            any(i > meta_fetch and line == "ip6tables <-F>" for i, line in enumerate(lines))
        )

    def test_success_path_is_symmetric_and_destination_scoped(self):
        result = run(["bash", str(FIREWALL)], cwd=self.cwd, env=self.env)
        self.assertIn("Firewall verification passed", result.stdout)
        lines = self.command_log()

        dns_rules = [line for line in lines if "<--dport> <53>" in line]
        self.assertTrue(dns_rules)
        self.assertTrue(all("<-d>" in line for line in dns_rules))
        self.assertFalse(any(".0/24" in line for line in lines))
        self.assertTrue(any(line.startswith("ip6tables <-A> <OUTPUT>") for line in lines))
        self.assertTrue(
            any(
                line.startswith("ipset <add> <allowed-domains-v6>")
                and "<2001:db8::10>" in line
                for line in lines
            )
        )
        self.assertTrue(
            any(
                line.startswith("ipset <add> <github-ranges-v6>")
                and "<2606:50c0::/32>" in line
                for line in lines
            )
        )
        ssh_rules = [line for line in lines if "<--dport> <22>" in line]
        self.assertTrue(ssh_rules)
        self.assertTrue(all("<--match-set> <github-ranges-v" in line for line in ssh_rules))
        self.assertIn(
            "iptables <-A> <OUTPUT> <-p> <tcp> <-d> <172.17.0.1/32> <-j> <ACCEPT>",
            lines,
        )
        self.assertIn(
            "iptables <-A> <INPUT> <-p> <tcp> <-s> <172.17.0.1/32> <-j> <ACCEPT>",
            lines,
        )
        self.assertIn(
            "ip6tables <-A> <OUTPUT> <-p> <tcp> <-d> <2001:db8::1/128> <-j> <ACCEPT>",
            lines,
        )
        self.assertIn(
            "ip6tables <-A> <INPUT> <-p> <tcp> <-s> <2001:db8::1/128> <-j> <ACCEPT>",
            lines,
        )

    def test_required_claude_code_hosts_are_resolved_and_allowed(self):
        required_hosts = {
            "claude.ai": ("192.0.2.21", "2001:db8::21"),
            "platform.claude.com": ("192.0.2.22", "2001:db8::22"),
            "downloads.claude.ai": ("192.0.2.23", "2001:db8::23"),
            "raw.githubusercontent.com": ("192.0.2.24", "2001:db8::24"),
        }

        run(["bash", str(FIREWALL)], cwd=self.cwd, env=self.env)
        lines = self.command_log()

        for host, (address_v4, address_v6) in required_hosts.items():
            with self.subTest(host=host):
                self.assertIn(f"dig <+noall> <+answer> <A> <{host}>", lines)
                self.assertIn(f"dig <+noall> <+answer> <AAAA> <{host}>", lines)
                self.assertIn(
                    f"ipset <add> <allowed-domains-v4> <{address_v4}> <-exist>",
                    lines,
                )
                self.assertIn(
                    f"ipset <add> <allowed-domains-v6> <{address_v6}> <-exist>",
                    lines,
                )

    def test_required_icmpv6_control_traffic_is_allowed_before_reject(self):
        run(["bash", str(FIREWALL)], cwd=self.cwd, env=self.env)
        lines = self.command_log()
        final_reject = lines.index("ip6tables <-A> <OUTPUT> <-j> <REJECT>")

        for message_type in (1, 2, 3, 4, 133, 134, 135, 136):
            for chain in ("INPUT", "OUTPUT"):
                rule = (
                    f"ip6tables <-A> <{chain}> <-p> <ipv6-icmp> "
                    f"<--icmpv6-type> <{message_type}> <-j> <ACCEPT>"
                )
                with self.subTest(message_type=message_type, chain=chain):
                    self.assertIn(rule, lines)
                    self.assertLess(lines.index(rule), final_reject)

    def test_decommissioned_statsig_hostname_is_not_required(self):
        env = self.env.copy()
        env["FIREWALL_TEST_STATSIG_ANTHROPIC_NXDOMAIN"] = "1"

        result = run(["bash", str(FIREWALL)], cwd=self.cwd, env=env, check=False)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(
            any("<statsig.anthropic.com>" in line for line in self.command_log())
        )


if __name__ == "__main__":
    unittest.main()
