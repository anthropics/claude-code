#!/usr/bin/env python3
"""SessionStart bootstrap: ensure claude_agent_sdk is importable for the
agentic commit reviewer.

If claude_agent_sdk already imports in the current python3, this is a no-op.
Otherwise it creates a venv at ~/.claude/security/agent-sdk-venv and installs
the SDK there. security_reminder_hook.py prepends that venv's site-packages to
sys.path before attempting the SDK import, so the venv is used as a
fallback only when the system install is missing.

The venv lives under ~/.claude/security/ (same dir the plugin already uses
for per-session state) so it persists across plugin updates — rebuilding
on every update is 30-60s of wasted work for a package that changes far
less often than the plugin does.
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Outcome codes for the sdk_bootstrap metric. Values are stable for telemetry.
NOOP_SYSTEM = 0      # claude_agent_sdk already importable in system python
NOOP_VENV = 1        # venv already built and SDK imports from it
BUILT = 2            # venv created + SDK pip-installed this run
BUILD_FAILED = 3     # venv create or pip install raised/timed out
SKIP_WIN32 = 4       # Windows; consumer glob doesn't handle Lib/ layout
SKIP_SENTINEL = 5    # another SessionStart is currently building


def _sdk_on_syspath() -> bool:
    # find_spec is ~10ms; actually importing the SDK pulls in
    # transitive deps and costs ~800ms — too heavy for a
    # per-SessionStart no-op check that most sessions hit.
    try:
        return importlib.util.find_spec("claude_agent_sdk") is not None
    except Exception:
        return False


def _plugin_version_int() -> int:
    # Same encoding as security_reminder_hook._read_plugin_version_int so
    # metrics rows from both hooks join on pv.
    try:
        p = Path(__file__).parent.parent / ".claude-plugin" / "plugin.json"
        v = json.loads(p.read_text())["version"]
        major, minor, patch = (int(x) for x in v.split(".")[:3])
        return major * 10000 + minor * 100 + patch
    except Exception:
        return 0


def main() -> tuple[int, str, str]:
    """Run the bootstrap. Returns (outcome, err_phase, err_kind).

    err_phase / err_kind are non-empty only on BUILD_FAILED — they let
    telemetry split bootstrap failures by root cause.
    """
    # Windows venv layout (Lib/site-packages, no python* subdir) isn't
    # handled by the consumer's glob in security_reminder_hook.py; skip the
    # bootstrap entirely rather than build a venv that's never read.
    if sys.platform == "win32":
        return SKIP_WIN32, "", ""


    if _sdk_on_syspath():
        return NOOP_SYSTEM, "", ""

    state_dir = Path(
        os.environ.get("SECURITY_WARNINGS_STATE_DIR")
        or os.path.expanduser("~/.claude/security")
    )
    venv = state_dir / "agent-sdk-venv"
    venv_py = venv / "bin" / "python"

    # Another SessionStart (concurrent CC instance, same plugin) may already
    # be building. The sentinel lives NEXT TO the venv, not inside it —
    # `python -m venv --clear` wipes the target dir's contents, so an
    # in-venv sentinel would be deleted the instant we create the venv.
    # Stale sentinels (>5min) from a SIGKILL'd build are ignored.
    sentinel = state_dir / "agent-sdk-venv.building"
    if sentinel.exists():
        try:
            if time.time() - sentinel.stat().st_mtime < 300:
                return SKIP_SENTINEL, "", ""
            sentinel.unlink(missing_ok=True)
        except OSError:
            return SKIP_SENTINEL, "", ""

    # If a venv already exists and its python can import the SDK, done.
    if venv_py.exists():
        try:
            r = subprocess.run(
                [str(venv_py), "-c", "import claude_agent_sdk"],
                capture_output=True, timeout=10,
            )
            if r.returncode == 0:
                return NOOP_VENV, "", ""
        except Exception:
            pass  # broken venv; rebuild below

    err_phase = ""
    err_kind = ""
    we_own_sentinel = False
    try:
        state_dir.mkdir(parents=True, exist_ok=True)
        # O_EXCL makes the sentinel an atomic lock — if two SessionStarts
        # race past the exists() check above, only one creates it.
        try:
            os.close(os.open(sentinel, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
        except FileExistsError:
            return SKIP_SENTINEL, "", ""
        we_own_sentinel = True
        err_phase = "venv"
        subprocess.run(
            [sys.executable, "-m", "venv", "--clear", str(venv)],
            capture_output=True, timeout=60, check=True,
        )
        # Some machines route pip through a private registry; we
        # don't pass --index-url here so we inherit that default. Outside
        # the user's machine, pip's own default registry applies — that's the same
        # exposure the user would have running `pip install` themselves, so
        # we're not widening the supply-chain surface.
        err_phase = "pip"
        subprocess.run(
            [str(venv_py), "-m", "pip", "install", "--quiet",
             "--disable-pip-version-check", "claude-agent-sdk"],
            capture_output=True, timeout=120, check=True,
        )
        return BUILT, "", ""
    except subprocess.CalledProcessError as e:
        # Capture a stderr fingerprint so telemetry can split BUILD_FAILED by
        # root cause (no-network, package-not-found, dns-fail, etc.).
        # Categorize first, then keep a short raw tail for the long tail of
        # unexpected modes.
        stderr_b = e.stderr or b""
        if isinstance(stderr_b, bytes):
            stderr_str = stderr_b.decode("utf-8", errors="replace")
        else:
            stderr_str = str(stderr_b)
        s = stderr_str.lower()
        if "no matching distribution" in s or "could not find a version" in s:
            err_kind = "pip_no_match"
        elif "name or service not known" in s or "name resolution" in s \
                or "nodename nor servname" in s or "temporary failure in name" in s:
            err_kind = "dns_fail"
        elif "connection refused" in s or "connection reset" in s:
            err_kind = "conn_refused"
        elif "ssl" in s and ("verify" in s or "certificate" in s):
            err_kind = "ssl_verify"
        elif "permission denied" in s or "read-only file system" in s:
            err_kind = "perm_denied"
        elif "no module named pip" in s or "no module named ensurepip" in s:
            err_kind = "no_pip"
        elif "no space left" in s or "disk quota" in s:
            err_kind = "disk_full"
        elif "proxy" in s and ("authent" in s or "tunnel" in s or "407" in s):
            err_kind = "proxy_auth"
        elif "timeout" in s or "timed out" in s:
            err_kind = "stderr_timeout"
        else:
            # First 60 chars of the last non-empty stderr line — bounded to
            # stay inside CC's metric value-length budget. Real failure modes
            # we haven't categorized show up here as a low-cardinality bucket.
            tail = next(
                (ln.strip() for ln in reversed(stderr_str.splitlines()) if ln.strip()),
                "",
            )[:60]
            err_kind = f"other:{tail}" if tail else "other"
        return BUILD_FAILED, err_phase, err_kind
    except subprocess.TimeoutExpired:
        return BUILD_FAILED, err_phase, "subprocess_timeout"
    except Exception as e:
        return BUILD_FAILED, err_phase, f"exc:{type(e).__name__}"
    finally:
        # Only remove the sentinel if THIS process created it. The
        # FileExistsError path above means another process owns the lock;
        # unconditionally unlinking here would delete its sentinel and let
        # a third concurrent SessionStart `venv --clear` over the in-flight
        # build.
        if we_own_sentinel:
            sentinel.unlink(missing_ok=True)


if __name__ == "__main__":
    # Tell the harness this is async — venv create + pip install can take
    # 30-60s on a cold cache, well past the default sync hook timeout.
    # SessionStart runs before the user's first prompt; doing this in the
    # background means the first commit-review of the session usually finds
    # the venv ready.
    print(json.dumps({"async": True, "asyncTimeout": 180000}), flush=True)
    t0 = time.perf_counter()
    try:
        outcome, err_phase, err_kind = main()
    except Exception as exc:
        outcome, err_phase, err_kind = (
            BUILD_FAILED, "main", f"exc:{type(exc).__name__}"
        )
    # CC's async-hook registry scans stdout line-by-line after process exit
    # and takes the FIRST non-{"async":...} JSON line as the hook response;
    # its `metrics` key is forwarded to the hook metrics event on the
    # next attachments pass. Must be a single line — the registry splits on
    # \n and json-parses each independently. Values must be bool|number OR
    # short strings (CC accepts string metric values if they're not
    # null). Stay inside the 10-key emit cap.
    metrics: dict[str, object] = {
        "sdk_bootstrap": outcome,
        "sdk_bootstrap_ms": round((time.perf_counter() - t0) * 1000),
    }
    if err_kind:
        # Truncate defensively; categorized values are <40 chars but the
        # `other:<tail>` mode could be longer. err_phase may be empty for
        # pre-venv failures (state_dir.mkdir perm-denied, sentinel O_EXCL
        # raising a non-FileExistsError OSError) — emit as "pre" so the
        # err_kind isn't silently dropped.
        metrics["sdk_bootstrap_phase"] = (err_phase or "pre")[:16]
        metrics["sdk_bootstrap_err"] = err_kind[:96]
    pv = _plugin_version_int()
    if pv:
        metrics["pv"] = pv
    print(json.dumps({"metrics": metrics}), flush=True)
