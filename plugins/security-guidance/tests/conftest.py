import http.server
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

HOOKS_DIR = Path(__file__).resolve().parent.parent / "hooks"
HOOK_SCRIPT = HOOKS_DIR / "security_reminder_hook.py"

sys.path.insert(0, str(HOOKS_DIR))

GIT_ENV = {
    "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com",
    "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
}


def git(cwd, *args):
    r = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True,
        env={**os.environ, **GIT_ENV},
    )
    assert r.returncode == 0, r.stderr
    return r.stdout


def make_repo(path, files=None):
    path.mkdir(parents=True, exist_ok=True)
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "commit.gpgsign", "false")
    for name, content in (files or {"README.md": "init\n"}).items():
        p = path / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    git(path, "add", "-A")
    git(path, "commit", "-q", "-m", "init")
    return path


def commit_file(repo, name, content, msg="change"):
    p = repo / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    git(repo, "add", "-A")
    out = subprocess.run(
        ["git", "commit", "-m", msg], cwd=repo, capture_output=True, text=True,
        env={**os.environ, **GIT_ENV},
    )
    assert out.returncode == 0, out.stderr
    sha = git(repo, "rev-parse", "HEAD").strip()
    return sha, out.stdout + out.stderr


VULN_PY = (
    "import subprocess\n"
    "def run(user):\n"
    "    subprocess.call('ls ' + user, shell=True)\n"
)


@pytest.fixture
def workspace(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    repo = make_repo(ws / "sub", {"app.py": "print('hi')\n"})
    (ws / "node_modules" / "junk").mkdir(parents=True)
    return ws, repo


class _Stub(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n:
            self.rfile.read(n)
        self.server.calls.append(self.path)
        if self.server.delay:
            time.sleep(self.server.delay)
        if self.server.status == 200:
            vulns = list(self.server.vulns)
            body = json.dumps({
                "id": "msg_stub", "type": "message", "role": "assistant",
                "model": "stub", "stop_reason": "end_turn",
                "content": [{"type": "text", "text": json.dumps(
                    {"hasVulnerabilities": bool(vulns), "vulnerabilities": vulns})}],
                "usage": {"input_tokens": 1, "output_tokens": 1},
            }).encode()
        else:
            body = b'{"type":"error","error":{"type":"invalid_request_error","message":"stub"}}'
        self.send_response(self.server.status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_HEAD = do_GET = do_POST

    def log_message(self, *a):
        pass


@pytest.fixture
def stub_api():
    srv = http.server.HTTPServer(("127.0.0.1", 0), _Stub)
    srv.calls = []
    srv.status = 200
    srv.delay = 0
    srv.vulns = []
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        yield srv
    finally:
        srv.shutdown()


@pytest.fixture
def hook_env(tmp_path, stub_api):
    state = tmp_path / "state"
    state.mkdir()
    env = {k: v for k, v in os.environ.items()
           if k not in ("ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_REMOTE",
                        "CLAUDE_PROJECT_DIR", "HTTP_PROXY", "HTTPS_PROXY",
                        "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy",
                        "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX",
                        "CLAUDE_CODE_USE_FOUNDRY")}
    env.update(GIT_ENV)
    env.update({
        "SECURITY_WARNINGS_STATE_DIR": str(state),
        "ANTHROPIC_API_KEY": "test-key",
        "ANTHROPIC_BASE_URL": f"http://127.0.0.1:{stub_api.server_port}",
        "NO_PROXY": "*", "no_proxy": "*",
        "SG_AGENTIC_COMMIT_REVIEW": "0",
        "SECURITY_GUIDANCE_COMMIT_REVIEW": "on",
        "SG_PUSH_SWEEP": "on",
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    return env


def run_hook(payload, env, python=sys.executable):
    r = subprocess.run(
        [python, str(HOOK_SCRIPT)], input=json.dumps(payload),
        capture_output=True, text=True, env=env, timeout=120,
    )
    return r.returncode, r.stdout, r.stderr


STUB_VULN = {
    "filePath": "app.py", "category": "command_injection", "severity": "high",
    "vulnerableCode": "subprocess.call('ls ' + user, shell=True)",
    "description": "user input reaches a shell", "recommendation": "pass an argv list",
}


def metrics_of(stdout):
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                m = json.loads(line).get("metrics")
            except json.JSONDecodeError:
                continue
            if m is not None:
                return m
    return None


def bash_payload(cwd, command, stdout="", stderr="", session_id="s1", tool_use_id=None):
    p = {
        "session_id": session_id,
        "hook_event_name": "PostToolUse",
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "tool_response": {"stdout": stdout, "stderr": stderr, "interrupted": False},
        "cwd": str(cwd),
    }
    if tool_use_id:
        p["tool_use_id"] = tool_use_id
    return p


def edit_payload(cwd, file_path, new_string="x", session_id="s1"):
    return {
        "session_id": session_id,
        "hook_event_name": "PostToolUse",
        "tool_name": "Edit",
        "tool_input": {"file_path": str(file_path), "old_string": "", "new_string": new_string},
        "tool_response": {},
        "cwd": str(cwd),
    }


def stop_payload(cwd, event="Stop", session_id="s1"):
    return {
        "session_id": session_id,
        "hook_event_name": event,
        "stop_hook_active": False,
        "cwd": str(cwd),
    }


def ups_payload(cwd, session_id="s1"):
    return {
        "session_id": session_id,
        "hook_event_name": "UserPromptSubmit",
        "prompt": "hi",
        "cwd": str(cwd),
    }
