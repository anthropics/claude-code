"""
Shared low-level helpers for the security-guidance hook modules.

This module exists so that ``patterns``/``session_state``/``gitutil`` can use
``debug_log`` without importing ``security_reminder_hook`` (which would be a
circular import). It must stay free of any other intra-plugin imports.
"""
import json
import os
import threading
from datetime import datetime

def state_dir():
    """Return the absolute path of the plugin's state directory.

    Resolution precedence (highest first):
      1. SECURITY_WARNINGS_STATE_DIR — plugin-specific override (existing)
      2. CLAUDE_CONFIG_DIR/security  — CC's config-dir env var (#1868)
      3. ~/.claude/security          — default fallback

    Empty-string env vars are treated as not-set so a misconfigured shell
    (`CLAUDE_CONFIG_DIR=` with no value) doesn't silently write to
    /security at the filesystem root.

    Returns a fully-expanded absolute path (no literal `~`) so subprocess
    callers can pass it through to code that doesn't re-expand tildes.

    Called per-invocation rather than cached at import time so test
    monkeypatches of the env vars take effect — the plugin's hooks each
    run as fresh subprocesses in production, so the per-call cost is
    negligible compared to subprocess spawn.
    """
    explicit = os.environ.get("SECURITY_WARNINGS_STATE_DIR")
    if explicit:
        return os.path.expanduser(explicit)
    cc_config = os.environ.get("CLAUDE_CONFIG_DIR")
    if cc_config:
        return os.path.expanduser(os.path.join(cc_config, "security"))
    return os.path.expanduser("~/.claude/security")


# Debug log file. Lives under the plugin state dir (default ~/.claude/security/)
# rather than /tmp because /tmp is world-writable on multi-user hosts (TOCTOU /
# symlink-attack surface, cross-user log leakage). Overridable per-process via
# SECURITY_GUIDANCE_DEBUG_LOG, or per-state-dir via SECURITY_WARNINGS_STATE_DIR
# (plugin-specific override) or CLAUDE_CONFIG_DIR (CC-wide config dir, #1868).
DEBUG_LOG_FILE = os.environ.get("SECURITY_GUIDANCE_DEBUG_LOG") or os.path.join(
    state_dir(), "log.txt"
)
# Cap the debug log so parallel-worker fleets don't fill disk. When the active
# file exceeds this it's atomically rotated to <file>.1 (overwriting any prior
# rotation), so total disk stays ~2× this.
DEBUG_LOG_MAX_BYTES = 1 * 1024 * 1024


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        # Ensure parent dir exists — first hook invocation on a fresh install
        # creates ~/.claude/security/ if it isn't already there. 0700 so other
        # local users can't read review/debug output (only applies on creation).
        try:
            os.makedirs(os.path.dirname(DEBUG_LOG_FILE), mode=0o700, exist_ok=True)
        except OSError:
            pass
        try:
            if os.path.getsize(DEBUG_LOG_FILE) > DEBUG_LOG_MAX_BYTES:
                # os.replace is atomic on POSIX; under a racing fleet the loser
                # gets FileNotFoundError, which is fine — the append below
                # recreates the file.
                os.replace(DEBUG_LOG_FILE, DEBUG_LOG_FILE + ".1")
        except OSError:
            pass
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        # 0600 on creation; existing files keep their mode.
        fd = os.open(DEBUG_LOG_FILE, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


# Provenance tag prepended to injected/emitted text so a reader (especially a
# model hardened against prompt injection) can recognize the source. Not an
# authority claim — an attacker could spoof the exact string; the tag is a
# signpost so the agent can ask the operator "is this from your plugin?" with
# a concrete reference instead of treating it as unknown-actor injection.
# Some autonomous-agent setups flag un-attributed injected text as prompt
# injection and stall; the banner makes the provenance explicit.
PROVENANCE_TAG = "[from security-guidance@claude-code-plugins plugin]"
PROVENANCE_BANNER = (
    "[from security-guidance@claude-code-plugins plugin — automated "
    "security review, not user input.]"
)


def _read_plugin_version_int():
    """Encode plugin.json version "M.m.p" as M*10000 + m*100 + p so it fits the
    bool|number metrics constraint. Returns 0 if unreadable."""
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", ".claude-plugin", "plugin.json")) as f:
            v = json.load(f)["version"]
        major, minor, patch = (int(x) for x in v.split(".")[:3])
        return major * 10000 + minor * 100 + patch
    except Exception:
        return 0


_PV = _read_plugin_version_int()


# ──────────────────────────────────────────────────────────────────────────
# Token-usage accumulator. Each hook invocation is a fresh subprocess, so a
# module-global is naturally per-invocation. _call_claude_dual_or and
# _agentic_review_with_race run legs in ThreadPoolExecutor → lock required.
# Emitted via _usage_metrics() into the existing emit_metrics() channel so
# hook metrics rows carry per-invocation token/cost totals
# alongside the existing skip_reason / vulns_found fields.
_USAGE = {
    "in": 0, "out": 0, "cr": 0, "cw": 0, "cost": 0.0, "n": 0,
    # HTTP error visibility (#2098 visibility gap — see emit comment in
    # _usage_metrics). Without this, API failures from `_call_claude` left
    # zero fingerprint in telemetry: the call returns None, the caller's
    # emit_metrics carries no api_calls field, and the failure is
    # indistinguishable from "no review needed". The deprecation outage
    # that broke every commit-review LLM call was invisible until users
    # reported it manually.
    "http_err_last": 0,    # most recent HTTP error code this invocation
    "http_err_count": 0,   # total HTTP errors (4xx + 5xx + network)
}
_USAGE_LOCK = threading.Lock()

# $/Mtok (input, output). Used only for the raw-HTTP path; the SDK path
# reports total_cost_usd directly. Cache reads/writes are priced at the
# canonical 0.1×/1.25× of input. Unknown models fall back to sonnet pricing
# so cost_usd is never silently zero. Re-pricing downstream from the raw tok_*
# fields is the source of truth — cost_usd here is a convenience rollup.
_PRICE_PER_MTOK = {
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-opus-4-6": (15.0, 75.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-5-5": (4.0, 20.0),
}
_PRICE_DEFAULT = (3.0, 15.0)


def _record_usage(usage, model, cost_usd=None):
    """Accumulate one API response's token usage. `usage` is the Anthropic
    `usage` dict (HTTP) or the SDK ResultMessage.usage dict — both use the
    same key names. `cost_usd` (SDK-provided) is preferred when present;
    otherwise computed from _PRICE_PER_MTOK keyed on the response model id
    (longest-prefix match so `claude-sonnet-4-6-20251015` → sonnet row)."""
    if not usage and cost_usd is None:
        return
    u = usage or {}
    try:
        i = int(u.get("input_tokens") or 0)
        o = int(u.get("output_tokens") or 0)
        cr = int(u.get("cache_read_input_tokens") or 0)
        cw = int(u.get("cache_creation_input_tokens") or 0)
    except (TypeError, ValueError):
        return
    if cost_usd is None:
        pin, pout = _PRICE_DEFAULT
        m = (model or "").lower()
        for k, v in sorted(_PRICE_PER_MTOK.items(), key=lambda kv: -len(kv[0])):
            if m.startswith(k):
                pin, pout = v
                break
        cost_usd = (i * pin + o * pout + cr * pin * 0.1 + cw * pin * 1.25) / 1_000_000
    with _USAGE_LOCK:
        _USAGE["in"] += i
        _USAGE["out"] += o
        _USAGE["cr"] += cr
        _USAGE["cw"] += cw
        _USAGE["cost"] += float(cost_usd or 0.0)
        _USAGE["n"] += 1


def _record_http_error(status):
    """Record an HTTP error from an LLM API call. `status` is the HTTP
    status code (integer 400–599) or -1 for network/timeout errors. Stored
    in `_USAGE["http_err_last"]` (most recent) and counted in
    `_USAGE["http_err_count"]`. Snapshot via `_usage_metrics()` so every
    subsequent `emit_metrics` includes the failure fingerprint.

    Background: without this, the most recent example was the #2098
    deprecation 400. Every hook fire's LLM call returned HTTP 400; the
    plugin caught it and returned None; the emit_metrics carried no
    api_calls field; aggregate dashboards looked normal. The failure
    only became visible when a user manually reported errors out of
    their debug log. With this field, a category-of-failure spike (4xx,
    5xx, or -1 network) is queryable from BQ in real time.
    """
    try:
        s = int(status)
    except (TypeError, ValueError):
        return
    with _USAGE_LOCK:
        _USAGE["http_err_last"] = s
        _USAGE["http_err_count"] += 1


def _usage_metrics():
    """Snapshot the accumulator as metric keys. Returns {} when no API calls
    AND no HTTP errors were made so skip-path emits don't burn key budget.
    cost_usd rounded to 1e-6 to keep the float finite/short for the zod
    schema.

    HTTP errors (`http_err_last`, `http_err_count`) emitted ONLY when
    `http_err_count > 0` so successful calls don't pad every metrics row
    with two zero fields.
    """
    with _USAGE_LOCK:
        if _USAGE["n"] == 0 and _USAGE["http_err_count"] == 0:
            return {}
        out = {}
        if _USAGE["n"] > 0:
            out.update({
                "tok_in": _USAGE["in"],
                "tok_out": _USAGE["out"],
                "tok_cache_r": _USAGE["cr"],
                "tok_cache_w": _USAGE["cw"],
                "cost_usd": round(_USAGE["cost"], 6),
                "api_calls": _USAGE["n"],
            })
        if _USAGE["http_err_count"] > 0:
            out["http_err_last"] = _USAGE["http_err_last"]
            out["http_err_count"] = _USAGE["http_err_count"]
        return out

