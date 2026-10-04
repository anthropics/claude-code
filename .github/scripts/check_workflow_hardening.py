#!/usr/bin/env python3
"""Fail if a workflow job that calls Claude, or .github/egress-firewall.yaml, breaks a rule in CLAUDE.md,
"Security hardening for GitHub Actions". Run from the repository root. A job calls Claude when it runs the
Claude Code action, or when it or a local action it uses mentions ANTHROPIC_FEDERATION_RULE_ID.
"""

import json
import pathlib
import re
import shlex
import subprocess
import sys

FIREWALL_RUNNER = "ubuntu-24.04-firewall"
WORKFLOW_DIR = pathlib.Path(".github/workflows")
POLICY_PATH = pathlib.Path(".github/egress-firewall.yaml")
SIGN_IN_MARKER = "anthropic_federation_rule_id"
CLAUDE_ACTIONS = ("anthropics/claude-code-action", "anthropics/claude-code-base-action")
HELP = 'See CLAUDE.md, "Security hardening for GitHub Actions".'
# Claude Code runs auto mode only on claude-opus-4-6 and newer models. On an older model it
# falls back to its default permission mode, with no safety review.
AUTO_MODE_MIN_VERSION = (4, 6)
# The version in a model name: claude-opus-4-6, claude-sonnet-4-5-20250929, claude-3-5-sonnet-latest.
MODEL_VERSION = re.compile(
    r"claude-(?:(?:opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?"
    r"|(\d+)(?:-(\d{1,2}))?-(?:opus|sonnet|haiku))(?![\d.])"
)

# Key: "<workflow file name>:<job id>". Value: why that job is exempt from the table's rule.
EXEMPT_FROM_FIREWALL_RUNNER: dict[str, str] = {}
EXEMPT_FROM_AUTO_MODE: dict[str, str] = {}


def stop(message: str):
    sys.exit(f"::error::{message}")


def load_yaml(path: pathlib.Path):
    """Parse a YAML file with PyYAML, or with the yq command if PyYAML is absent."""
    try:
        import yaml
    except ImportError:
        try:
            result = subprocess.run(
                ["yq", "-o=json", ".", str(path)], check=True, capture_output=True, text=True
            )
        except FileNotFoundError:
            stop(
                f"Cannot read {path}: Python has no 'yaml' module and no 'yq' command was found. "
                "Add a step that runs 'pip install pyyaml' before this check."
            )
        except subprocess.CalledProcessError:
            stop(f"Cannot read {path}: 'yq' could not parse it. Check that the file is valid YAML.")
        return json.loads(result.stdout)
    try:
        with path.open(encoding="utf-8") as handle:
            return yaml.safe_load(handle)
    except yaml.YAMLError as error:
        stop(f"Cannot read {path}: it is not valid YAML ({error}).")


def contains_marker(node) -> bool:
    """Whether any key or string under node contains SIGN_IN_MARKER, ignoring case."""
    if isinstance(node, dict):
        return any(contains_marker(k) or contains_marker(v) for k, v in node.items())
    if isinstance(node, list):
        return any(contains_marker(item) for item in node)
    return isinstance(node, str) and SIGN_IN_MARKER in node.lower()


def load_local_action(uses: str):
    """The parsed action file of a local action (uses: ./path), or None."""
    if not uses.startswith("./"):
        return None
    for name in ("action.yml", "action.yaml"):
        action_file = pathlib.Path(uses) / name
        if action_file.is_file():
            action = load_yaml(action_file)
            return action if isinstance(action, dict) else {}
    return None


def steps_of(job: dict) -> list[dict]:
    return [step for step in job.get("steps") or [] if isinstance(step, dict)]


def runs_claude_code_action(step: dict) -> bool:
    """Whether the step runs the Claude Code action: the published action, or a
    local action that accepts a claude_args input."""
    uses = str(step.get("uses", ""))
    if uses.lower().startswith(CLAUDE_ACTIONS):
        return True
    action = load_local_action(uses)
    return action is not None and "claude_args" in (action.get("inputs") or {})


def job_calls_claude(job: dict) -> bool:
    if contains_marker(job):
        return True
    for step in steps_of(job):
        if runs_claude_code_action(step):
            return True
        action = load_local_action(str(step.get("uses", "")))
        if action is not None and contains_marker(action):
            return True
    return False


def permission_mode_problem(step: dict, exempt: bool, inherited_env: dict) -> str | None:
    """The message for a step whose permission mode is wrong, or None if it is right.

    A step must set auto mode, on a model that supports it. A step of a job in
    EXEMPT_FROM_AUTO_MODE must set no mode at all. inherited_env is the workflow's and the
    job's 'env'.
    """
    inputs = step.get("with") or {}
    lines = str(inputs.get("claude_args", "")).splitlines()
    text = " ".join(line for line in lines if not line.strip().startswith("#"))
    try:
        args = shlex.split(text, comments=True)
    except ValueError:
        return "'claude_args' has a quote that is never closed. Close it"
    modes = []
    for index, arg in enumerate(args):
        if arg == "--dangerously-skip-permissions":
            return (
                "remove '--dangerously-skip-permissions' from 'claude_args': "
                "it turns off permission checks"
            )
        if arg == "--permission-mode":
            modes.append(args[index + 1] if index + 1 < len(args) else "")
        elif arg.startswith("--permission-mode="):
            modes.append(arg.split("=", 1)[1])
    if exempt and modes:
        return (
            "remove '--permission-mode' from 'claude_args': this job is listed in "
            "EXEMPT_FROM_AUTO_MODE (.github/scripts/check_workflow_hardening.py), and a job listed "
            "there must not set a permission mode"
        )
    if not modes and not exempt:
        return "add '--permission-mode auto' to 'claude_args' under the step's 'with:'"
    for mode in modes:
        if mode == "":
            return (
                "'claude_args' has '--permission-mode' with nothing after it. "
                "Write '--permission-mode auto'"
            )
        if mode != "auto":
            return (
                f"'claude_args' has '--permission-mode {mode}'. "
                "Change it to '--permission-mode auto'"
            )
    env = {**inherited_env, **(step.get("env") or {})}
    models = [
        ("the step's 'model'", inputs.get("model", "")),
        ("ANTHROPIC_MODEL", env.get("ANTHROPIC_MODEL", "")),
    ]
    models += [
        (f"'{flag}' in 'claude_args'", value)
        for flag in ("--model", "--fallback-model")
        for value in flag_values(args, flag)
    ]
    settings = [("the step's 'settings'", inputs.get("settings", ""))]
    settings += [
        ("'--settings' in 'claude_args'", value) for value in flag_values(args, "--settings")
    ]
    for where, value in settings:
        text = settings_text(value)
        if text is None:
            return (
                f"{where} names a file outside the repository, which this check cannot read. "
                "Use inline settings or a file inside the repository"
            )
        if "defaultMode" in text:
            return f"remove 'defaultMode' from {where}: settings must not set a permission mode"
        try:
            parsed = json.loads(text) if text else {}
        except ValueError:
            parsed = {}
        if isinstance(parsed, dict) and "model" in parsed:
            models.append((f"'model' in {where}", parsed["model"]))
    if not exempt:
        for where, model in models:
            if predates_auto_mode(str(model or "")):
                return (
                    f"{where} is '{model}', which Claude Code does not run in auto mode: it "
                    "falls back to the default permission mode. Use claude-opus-4-6 or a newer model"
                )
    return None


def flag_values(args: list[str], flag: str) -> list[str]:
    """The values a flag in claude_args is given, as '--flag value' or '--flag=value'."""
    values = [
        args[index + 1] for index, arg in enumerate(args) if arg == flag and index + 1 < len(args)
    ]
    return values + [arg.split("=", 1)[1] for arg in args if arg.startswith(f"{flag}=")]


def predates_auto_mode(model: str) -> bool:
    """Whether the model is older than AUTO_MODE_MIN_VERSION. A name with no version, such as
    'opus' or 'default', stands for a current model, except 'haiku' (claude-haiku-4-5)."""
    if model.strip().lower() == "haiku":
        return True
    match = MODEL_VERSION.search(model.lower())
    if not match:
        return False
    major, minor = match.group(1, 2) if match.group(1) else match.group(3, 4)
    return (int(major), int(minor or 0)) < AUTO_MODE_MIN_VERSION


def settings_text(value) -> str | None:
    """The settings JSON a 'settings' value stands for: the value itself, or the contents of
    the file it names when it is a path inside the repository. None when it names a path
    outside the repository."""
    text = str(value or "").strip()
    if not text or text.startswith("{"):
        return text
    path = pathlib.Path(text)
    root = pathlib.Path.cwd().resolve()
    try:
        resolved = path.resolve()
        resolved.relative_to(root)
    except (OSError, ValueError):
        return None
    if resolved.is_file():
        return resolved.read_text(encoding="utf-8", errors="replace")
    return text


def check_job(file_name: str, job_id: str, job: dict, workflow_env: dict) -> list[str]:
    key = f"{file_name}:{job_id}"
    where = f".github/workflows/{file_name}: job '{job_id}'"
    errors = []
    runs_on = job.get("runs-on")
    if isinstance(runs_on, list) and len(runs_on) == 1:
        runs_on = runs_on[0]
    if key in EXEMPT_FROM_FIREWALL_RUNNER:
        print(
            f"The egress-firewall runner is not required for job '{job_id}' in {file_name}. "
            f"Reason: {EXEMPT_FROM_FIREWALL_RUNNER[key]}."
        )
    elif runs_on != FIREWALL_RUNNER:
        if "runs-on" not in job:
            has = "no 'runs-on'"
        elif isinstance(job["runs-on"], str):
            has = f"'runs-on: {job['runs-on']}'"
        else:
            has = "a 'runs-on' list or group"
        errors.append(
            f"{where} calls Claude, so it must have 'runs-on: {FIREWALL_RUNNER}'. "
            f"It has {has}. {HELP}"
        )
    exempt = key in EXEMPT_FROM_AUTO_MODE
    if exempt:
        print(
            f"Auto permission mode is not required for job '{job_id}' in {file_name}. "
            f"Reason: {EXEMPT_FROM_AUTO_MODE[key]}."
        )
    if "defaultMode" in json.dumps(job):
        # Catches a settings file that an earlier step of the job writes, which the
        # step-level check cannot read.
        errors.append(
            f"{where} mentions 'defaultMode': settings must not set a permission mode. {HELP}"
        )
    for index, step in enumerate(steps_of(job), start=1):
        if not runs_claude_code_action(step):
            continue
        inherited_env = {**workflow_env, **(job.get("env") or {})}
        problem = permission_mode_problem(step, exempt, inherited_env)
        if problem:
            step_label = f"step '{step['name']}'" if "name" in step else f"step {index}"
            errors.append(f"{where}, {step_label}: {problem}. {HELP}")
    return errors


def check_policy() -> list[str]:
    if not POLICY_PATH.is_file():
        return [
            f"{POLICY_PATH} is missing. Jobs on the egress-firewall runner need it "
            f"to limit outbound network access. {HELP}"
        ]
    policy = load_yaml(POLICY_PATH)
    if not isinstance(policy, dict):
        return [
            f"{POLICY_PATH} is empty or is not a set of 'name: value' lines. It needs 'mode: enforce' "
            f"and an 'allow:' list of hosts. {HELP}"
        ]
    errors = []
    if "mode" not in policy:
        errors.append(f"{POLICY_PATH}: 'mode' is missing. Add 'mode: enforce'. {HELP}")
    elif policy["mode"] != "enforce":
        errors.append(
            f"{POLICY_PATH}: 'mode' is '{policy['mode']}'. It must be 'enforce'. {HELP}"
        )
    allow = policy.get("allow")
    if not isinstance(allow, list) or not allow:
        errors.append(
            f"{POLICY_PATH}: the 'allow' list is missing or empty. List under 'allow:' "
            f"each host the jobs need. {HELP}"
        )
    else:
        for host in allow:
            if "*" in str(host):
                errors.append(
                    f"{POLICY_PATH}: the 'allow' entry '{host}' contains '*'. "
                    f"Name each host in full. {HELP}"
                )
    return errors


def main() -> int:
    if not WORKFLOW_DIR.is_dir():
        stop(f"{WORKFLOW_DIR} not found. Run this check from the repository root.")
    errors = []
    checked = 0
    for path in sorted([*WORKFLOW_DIR.glob("*.yml"), *WORKFLOW_DIR.glob("*.yaml")]):
        workflow = load_yaml(path)
        jobs = workflow.get("jobs") if isinstance(workflow, dict) else None
        for job_id, job in (jobs or {}).items():
            if not isinstance(job, dict) or not job_calls_claude(job):
                continue
            checked += 1
            errors.extend(check_job(path.name, job_id, job, workflow.get("env") or {}))
    if checked:
        errors.extend(check_policy())
    for error in errors:
        print(f"::error::{error}")
    if errors:
        return 1
    if checked == 0:
        print("OK: no workflow job calls Claude, so there was nothing to check.")
    else:
        print(f"OK: checked {checked} job(s) that call Claude and found no problems.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
