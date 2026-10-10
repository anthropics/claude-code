"""The default review model follows the newest Opus instead of a pinned release."""
import http.server
import json
import sys
import threading
import time
import types

import pytest

from conftest import (
    VULN_PY, edit_payload, metrics_of, run_hook, stop_payload, ups_payload,
)

import llm

SCHEMA = {"type": "object", "properties": {"hasVulnerabilities": {"type": "boolean"}}}
PINNED = "claude-opus-5-5"


class _Api(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.gets.append((self.path, dict(self.headers)))
        if self.server.models_status != 200:
            return self._send(self.server.models_status, {"type": "error"})
        self._send(200, self.server.models_body)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n))
        self.server.posts.append(body)
        self._send(200, {
            "id": "msg_stub", "type": "message", "role": "assistant",
            "model": body["model"], "stop_reason": "end_turn",
            "content": [{"type": "text", "text": json.dumps(
                {"hasVulnerabilities": False, "vulnerabilities": []})}],
            "usage": {"input_tokens": 1, "output_tokens": 1},
        })

    def _send(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def _models(*ids):
    return {"data": [{"type": "model", "id": i} for i in ids], "has_more": False}


@pytest.fixture
def api(tmp_path, monkeypatch):
    srv = http.server.HTTPServer(("127.0.0.1", 0), _Api)
    srv.gets, srv.posts = [], []
    srv.models_status = 200
    srv.models_body = _models(
        "claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5",
        "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-5-20251101",
    )
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    for var in ("SECURITY_REVIEW_MODEL", "SG_AGENTIC_MODEL", "SG_DUAL_OR",
                "CLAUDE_CODE_EXECPATH", "SG_AGENTIC_CLI_PATH", *llm._PROVIDER_ENV_VARS):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{srv.server_port}")
    monkeypatch.setenv("SECURITY_WARNINGS_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("NO_PROXY", "*")
    monkeypatch.setenv("no_proxy", "*")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(llm, "ANTHROPIC_AUTH_TOKEN", "")
    monkeypatch.setattr(llm, "HAS_API_CREDENTIALS", True)
    monkeypatch.setattr(llm, "_auth_prefer_token", False)
    monkeypatch.setattr(llm, "_review_model_memo", None, raising=False)
    try:
        yield srv
    finally:
        srv.shutdown()


def _new_process(monkeypatch):
    """Each hook fire is a fresh process: only the on-disk cache carries over."""
    monkeypatch.setattr(llm, "_review_model_memo", None, raising=False)


def _review():
    return llm._call_claude_dual_or(
        "review this", SCHEMA,
        bool_key="hasVulnerabilities", list_key="vulnerabilities",
    )


class TestNewestOpus:
    def test_highest_version_wins_whatever_the_order(self):
        ids = ["claude-opus-4-7", "claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"]
        assert llm._newest_opus(ids) == "claude-opus-5-5"
        assert llm._newest_opus(reversed(ids)) == "claude-opus-5-5"

    def test_minor_version_compares_as_a_number(self):
        assert llm._newest_opus(["claude-opus-5-9", "claude-opus-5-10"]) == "claude-opus-5-10"

    def test_snapshot_date_is_not_a_version(self):
        ids = ["claude-opus-4-20250514", "claude-opus-4-1-20250805", "claude-opus-4-5-20251101"]
        assert llm._newest_opus(ids) == "claude-opus-4-5-20251101"

    def test_other_families_and_malformed_ids_are_ignored(self):
        ids = [
            "claude-fable-5-1", "claude-sonnet-5-5", "claude-haiku-4-5",
            "claude-opus-9-preview", "bedrock/claude-opus-9", "claude-opus-9 --flag",
            "us.anthropic.claude-opus-9", None, 7, "claude-opus-4-7",
        ]
        assert llm._newest_opus(ids) == "claude-opus-4-7"

    def test_no_opus_listed(self):
        assert llm._newest_opus(["claude-sonnet-5-5", "gpt-x"]) is None


class TestReviewRequestModel:
    def test_review_uses_the_newest_opus_the_endpoint_lists(self, api):
        assert _review() == {"hasVulnerabilities": False, "vulnerabilities": []}
        assert [p["model"] for p in api.posts] == ["claude-opus-5-5"]

    def test_a_release_newer_than_the_pinned_default_is_picked_up(self, api):
        api.models_body = _models("claude-opus-6", "claude-opus-5-5")
        _review()
        assert [p["model"] for p in api.posts] == ["claude-opus-6"]

    def test_gateway_listing_only_an_older_opus_gets_that_one(self, api):
        api.models_body = _models("claude-opus-4-8", "claude-sonnet-5")
        _review()
        assert [p["model"] for p in api.posts] == ["claude-opus-4-8"]

    def test_truncated_listing_does_not_pick_an_older_opus(self, api):
        api.models_body = {**_models("org-model-2", "org-model-1", "claude-opus-4-7"),
                           "has_more": True}
        _review()
        assert [p["model"] for p in api.posts] == [PINNED]

    def test_truncated_listing_still_picks_a_newer_opus(self, api):
        api.models_body = {**_models("claude-opus-6", "org-model-1"), "has_more": True}
        _review()
        assert [p["model"] for p in api.posts] == ["claude-opus-6"]

    def test_lookup_asks_for_one_modest_page(self, api):
        _review()
        assert api.gets[0][0] == "/v1/models?limit=100"

    def test_lookup_authenticates_like_the_review_call(self, api):
        _review()
        path, headers = api.gets[0]
        assert path.startswith("/v1/models")
        lowered = {k.lower(): v for k, v in headers.items()}
        assert lowered["x-api-key"] == "test-key"
        assert lowered["anthropic-version"] == "2023-06-01"

    def test_oauth_only_session_sends_the_bearer_token(self, api, monkeypatch):
        monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "")
        monkeypatch.setattr(llm, "ANTHROPIC_AUTH_TOKEN", "oauth-token")
        _review()
        lowered = {k.lower(): v for k, v in api.gets[0][1].items()}
        assert lowered["authorization"] == "Bearer oauth-token"
        assert "oauth-2025-04-20" in lowered["anthropic-beta"]
        assert "x-api-key" not in lowered

    def test_explicit_model_is_used_as_is_without_a_lookup(self, api, monkeypatch):
        monkeypatch.setenv("SECURITY_REVIEW_MODEL", "claude-sonnet-5")
        _review()
        assert [p["model"] for p in api.posts] == ["claude-sonnet-5"]
        assert api.gets == []


class TestLookupFailure:
    @pytest.mark.parametrize("status", [401, 403, 404, 500])
    def test_falls_back_to_the_pinned_default(self, api, status):
        api.models_status = status
        _review()
        assert [p["model"] for p in api.posts] == [PINNED]

    @pytest.mark.parametrize("body", [
        {"data": []}, {"data": "nope"}, {"object": "list"}, [], "text",
        {"data": [{"id": "gpt-x"}, {"name": "claude-opus-9"}, "claude-opus-9"]},
    ])
    def test_unusable_listing_falls_back_to_the_pinned_default(self, api, body):
        api.models_body = body
        assert llm.default_review_model() == PINNED

    def test_unreachable_endpoint_falls_back_to_the_pinned_default(self, api, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:1")
        assert llm.default_review_model() == PINNED

    def test_no_credentials_means_no_lookup(self, api, monkeypatch):
        monkeypatch.setattr(llm, "HAS_API_CREDENTIALS", False)
        assert llm.default_review_model() == PINNED
        assert api.gets == []

    def test_failure_is_not_retried_on_every_hook_fire(self, api, monkeypatch):
        api.models_status = 500
        assert llm.default_review_model() == PINNED
        _new_process(monkeypatch)
        assert llm.default_review_model() == PINNED
        assert len(api.gets) == 1

    def test_failure_is_retried_after_the_retry_window(self, api, monkeypatch):
        api.models_status = 500
        assert llm.default_review_model() == PINNED
        api.models_status = 200
        later = time.time() + llm._REVIEW_MODEL_RETRY_SECONDS + 1
        monkeypatch.setattr(llm.time, "time", lambda: later)
        _new_process(monkeypatch)
        assert llm.default_review_model() == "claude-opus-5-5"


class TestCache:
    def test_one_lookup_serves_later_hook_fires(self, api, monkeypatch):
        assert llm.default_review_model() == "claude-opus-5-5"
        _new_process(monkeypatch)
        api.models_body = _models("claude-opus-6")
        assert llm.default_review_model() == "claude-opus-5-5"
        assert len(api.gets) == 1

    def test_one_lookup_per_process(self, api):
        llm.default_review_model()
        llm.default_review_model()
        assert len(api.gets) == 1

    def test_new_release_is_seen_once_the_cache_expires(self, api, monkeypatch):
        assert llm.default_review_model() == "claude-opus-5-5"
        api.models_body = _models("claude-opus-6", "claude-opus-5-5")
        later = time.time() + llm._REVIEW_MODEL_TTL_SECONDS + 1
        monkeypatch.setattr(llm.time, "time", lambda: later)
        _new_process(monkeypatch)
        assert llm.default_review_model() == "claude-opus-6"

    def test_cache_from_another_endpoint_is_not_reused(self, api, monkeypatch):
        assert llm.default_review_model() == "claude-opus-5-5"
        other = http.server.HTTPServer(("127.0.0.1", 0), _Api)
        other.gets, other.posts = [], []
        other.models_status = 200
        other.models_body = _models("claude-opus-4-8")
        threading.Thread(target=other.serve_forever, daemon=True).start()
        try:
            monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{other.server_port}")
            _new_process(monkeypatch)
            assert llm.default_review_model() == "claude-opus-4-8"
        finally:
            other.shutdown()

    @pytest.mark.parametrize("model", [
        "claude-opus-9 --dangerously-skip-permissions", "../../etc/passwd",
        "claude-fable-5-1", 7, ["claude-opus-9"],
    ])
    def test_tampered_cache_entry_is_ignored(self, api, monkeypatch, tmp_path, model):
        assert llm.default_review_model() == "claude-opus-5-5"
        cache = tmp_path / "state" / llm._REVIEW_MODEL_CACHE_FILE
        entry = json.loads(cache.read_text())
        entry["model"] = model
        cache.write_text(json.dumps(entry))
        _new_process(monkeypatch)
        assert llm.default_review_model() == "claude-opus-5-5"
        assert len(api.gets) == 2

    @pytest.mark.parametrize("content", ["", "not json", "[]", '{"at": "soon"}', '{"at": 1e999}'])
    def test_corrupt_cache_file_is_ignored(self, api, monkeypatch, tmp_path, content):
        (tmp_path / "state").mkdir()
        (tmp_path / "state" / llm._REVIEW_MODEL_CACHE_FILE).write_text(content)
        assert llm.default_review_model() == "claude-opus-5-5"

    def test_future_dated_cache_entry_is_ignored(self, api, monkeypatch, tmp_path):
        assert llm.default_review_model() == "claude-opus-5-5"
        cache = tmp_path / "state" / llm._REVIEW_MODEL_CACHE_FILE
        entry = json.loads(cache.read_text())
        entry["at"] = time.time() + 10 * 365 * 24 * 3600
        cache.write_text(json.dumps(entry))
        api.models_body = _models("claude-opus-6")
        _new_process(monkeypatch)
        assert llm.default_review_model() == "claude-opus-6"

    def test_unwritable_state_dir_still_resolves(self, api, monkeypatch, tmp_path):
        blocker = tmp_path / "file"
        blocker.write_text("x")
        monkeypatch.setenv("SECURITY_WARNINGS_STATE_DIR", str(blocker / "state"))
        assert llm.default_review_model() == "claude-opus-5-5"

    def test_endpoint_url_is_not_written_to_disk(self, api, monkeypatch, tmp_path):
        llm.default_review_model()
        cache = (tmp_path / "state" / llm._REVIEW_MODEL_CACHE_FILE).read_text()
        assert "127.0.0.1" not in cache


@pytest.fixture
def fake_sdk(monkeypatch):
    """Stand-in for claude_agent_sdk that records the options of each spawn."""
    spawned = []

    class ClaudeAgentOptions:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            spawned.append(kwargs)

    class AssistantMessage:
        pass

    class ResultMessage:
        subtype = "success"
        usage = {}
        total_cost_usd = 0.0
        structured_output = {"findings": [], "hasVulnerabilities": False,
                             "vulnerabilities": []}

    async def query(prompt, options):
        yield ResultMessage()

    sdk = types.ModuleType("claude_agent_sdk")
    sdk.ClaudeAgentOptions = ClaudeAgentOptions
    sdk.AssistantMessage = AssistantMessage
    sdk.ResultMessage = ResultMessage
    sdk.query = query
    monkeypatch.setitem(sys.modules, "claude_agent_sdk", sdk)
    return spawned


class TestSdkPaths:
    """Reviews that run through the Agent SDK name the CLI's own `opus` alias,
    so the CLI that drives the model is the one that picks it."""

    def test_agentic_review_defaults_to_the_cli_alias(self, api, fake_sdk, tmp_path):
        llm.agentic_review(str(tmp_path), [("a.py", "+x = 1\n")], ["a.py"])
        assert fake_sdk[0]["model"] == "opus"
        assert fake_sdk[0]["fallback_model"] is None
        assert api.gets == []

    def test_agentic_review_override_falls_back_to_the_alias(self, api, fake_sdk,
                                                             tmp_path, monkeypatch):
        monkeypatch.setenv("SG_AGENTIC_MODEL", "claude-sonnet-5")
        llm.agentic_review(str(tmp_path), [("a.py", "+x = 1\n")], ["a.py"])
        assert fake_sdk[0]["model"] == "claude-sonnet-5"
        assert fake_sdk[0]["fallback_model"] == "opus"

    @pytest.mark.parametrize("provider_var", [
        "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY",
    ])
    def test_3p_review_defaults_to_the_cli_alias(self, api, fake_sdk, monkeypatch,
                                                 provider_var):
        monkeypatch.setenv(provider_var, "1")
        _review()
        assert fake_sdk[0]["model"] == "opus"
        assert fake_sdk[0]["fallback_model"] is None
        assert api.gets == [] and api.posts == []

    def test_3p_review_keeps_an_explicit_provider_id(self, api, fake_sdk, monkeypatch):
        monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", "1")
        monkeypatch.setenv("SECURITY_REVIEW_MODEL", "us.anthropic.claude-opus-4-7")
        _review()
        assert fake_sdk[0]["model"] == "us.anthropic.claude-opus-4-7"


class TestStopHookProcess:
    """The hook as Claude Code runs it: one process per fire, config from env."""

    def _env(self, api, hook_env):
        env = dict(hook_env)
        env["ANTHROPIC_BASE_URL"] = f"http://127.0.0.1:{api.server_port}"
        env.pop("SECURITY_REVIEW_MODEL", None)
        return env

    def _edit_then_stop(self, repo, env, session_id):
        run_hook(ups_payload(repo, session_id=session_id), env)
        (repo / "app.py").write_text(VULN_PY + f"# {session_id}\n")
        run_hook(edit_payload(repo, repo / "app.py", VULN_PY, session_id=session_id), env)
        rc, so, se = run_hook(stop_payload(repo, session_id=session_id), env)
        m = metrics_of(so)
        assert m.get("skip_reason") is None and m["files_reviewed"] == 1, (m, se)

    def test_stop_review_runs_on_the_newest_opus(self, api, hook_env, workspace):
        _, repo = workspace
        env = self._env(api, hook_env)
        self._edit_then_stop(repo, env, "s1")
        assert [p["model"] for p in api.posts] == ["claude-opus-5-5"]
        self._edit_then_stop(repo, env, "s2")
        assert [p["model"] for p in api.posts] == ["claude-opus-5-5"] * 2
        assert len(api.gets) == 1

    def test_stop_review_honors_the_override(self, api, hook_env, workspace):
        _, repo = workspace
        env = self._env(api, hook_env)
        env["SECURITY_REVIEW_MODEL"] = "claude-sonnet-5"
        self._edit_then_stop(repo, env, "s1")
        assert [p["model"] for p in api.posts] == ["claude-sonnet-5"]
        assert api.gets == []


class TestPricing:
    def test_current_opus_is_not_priced_as_the_unknown_model_default(self):
        import _base
        with _base._USAGE_LOCK:
            before = _base._USAGE["cost"]
        _base._record_usage({"input_tokens": 1_000_000, "output_tokens": 1_000_000},
                            "claude-opus-5-5")
        with _base._USAGE_LOCK:
            after = _base._USAGE["cost"]
        assert after - before == pytest.approx(24.0)
