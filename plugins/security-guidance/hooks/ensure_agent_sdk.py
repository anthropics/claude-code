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

# Shared state-dir resolver: SECURITY_WARNINGS_STATE_DIR → CLAUDE_CONFIG_DIR/security
# → ~/.claude/security. See _base.state_dir for resolution precedence. Re-aliased
# here to match the existing local name (state_dir was already a local var in
# main() and _maybe_emit_user_notice).
from _base import state_dir as _resolve_state_dir

# Outcome codes for the sdk_bootstrap metric. Values are stable for telemetry.
NOOP_SYSTEM = 0      # claude_agent_sdk already importable in system python
NOOP_VENV = 1        # venv already built and SDK imports from it
BUILT = 2            # venv created + SDK pip-installed this run
BUILD_FAILED = 3     # venv create or pip install raised/timed out
# Outcome 4 was previously SKIP_WIN32; retired now that the consumer glob in
# llm.py also matches Windows venv layout (Lib/site-packages). Don't reuse the
# value — telemetry rows from older plugin builds still emit 4.
SKIP_SENTINEL = 5    # another SessionStart is currently building
HOOK_PY_INCOMPATIBLE = 6  # hook interpreter is <3.10 — SDK syntax can't load
                          # here no matter how the venv was built. See #2071.
# --target fallback: when `python -m venv` can't bootstrap pip (ensurepip
# missing — Debian python3-venv not installed, or a python.org/pyenv build
# without ensurepip), fall back to `pip install --target <dir>` which needs
# only the system pip, not venv/ensurepip. Telemetry (v2.0.4 sdk_has_pip
# probe) confirmed ~95% of venv_ensurepip_fail users HAVE pip, so this
# recovers the agentic reviewer for them instead of degrading to pattern +
# single-shot review. See #2154 follow-up.
BUILT_TARGET = 7     # venv ensurepip failed → SDK pip-installed via --target
NOOP_TARGET = 8      # --target libs already present and importable
SKIP_COOLDOWN = 9    # a recent build was signal-killed (memory pressure) — not
                     # retrying this session to avoid burning the user's
                     # memory/CPU on a build that keeps getting killed. CCR
                     # repro confirmed the dominant Linux BUILD_FAILED is a
                     # SIGKILL/SIGSEGV of the memory-heavy venv+pip subprocess
                     # (rc<0, empty streams). See #2154 follow-up.

# How long to skip rebuilds after a signal kill. Retries at most once per
# window so a machine whose memory frees up still recovers (just not every
# session). Keyed by marker mtime.
SIGNAL_KILL_COOLDOWN_SEC = 24 * 3600


# Phase + err-kind integer encoding for sdk_bootstrap_phase / sdk_bootstrap_err.
#
# Earlier versions emitted these as STRINGS (e.g. "pip", "dns_fail"). CC's
# plugin-metrics pipeline silently drops plugin-emitted string values —
# only `bool|finite-number` plugin metrics reach BigQuery. (CC-core
# metrics like `subscription_type` are exempt because they're injected
# downstream of plugin validation.) Confirmed empirically: 185K
# BUILD_FAILED rows in BQ had `sdk_bootstrap_phase`/`sdk_bootstrap_err`
# = NULL despite the Python code emitting them. This left ~28K
# BUILD_FAILED sessions/day with no diagnostic split — flying blind on
# the real failure modes (pip-no-match vs dns-fail vs ssl-verify etc.).
#
# Fix: encode as small integers per the maps below. Values are
# APPEND-ONLY for telemetry stability. Reserve 99 as the "unknown /
# uncategorized" bucket so an unmapped err_kind (e.g., a new exception
# type) still emits a non-zero signal.
SDK_BOOTSTRAP_PHASE_CODES = {
    "pre":  1,  # pre-venv (state_dir.mkdir, sentinel open)
    "venv": 2,  # python -m venv --clear
    "pip":  3,  # pip install
    "main": 4,  # uncaught exception above main()
    "pip_target": 5,  # `pip install --target` fallback (venv ensurepip failed)
}
SDK_BOOTSTRAP_ERR_CODES = {
    "pip_no_match":         1,
    "dns_fail":             2,
    "conn_refused":         3,
    "ssl_verify":           4,
    "perm_denied":          5,
    "no_pip":               6,
    "disk_full":            7,
    "proxy_auth":           8,
    "stderr_timeout":       9,   # pip stderr containing "timeout"/"timed out"
    "subprocess_timeout":   10,  # subprocess.TimeoutExpired (>120s)
    "signal_killed":        16,  # venv/pip subprocess killed by a signal
                                 # (rc<0 or 128+sig) — OOM-killer SIGKILL /
                                 # RLIMIT_AS SIGSEGV, empty streams. The
                                 # actual rc rides in sdk_bootstrap_rc. This
                                 # is the dominant Linux failure (CCR repro).
    # Venv-stage specific categories added after PR #2112 telemetry surfaced
    # 2,406 phase=2/err=99 sessions in the first 3h of v2.0.1 — venv phase
    # failing in ways the original pip-flavored patterns didn't catch. These
    # all split out of what was previously collapsing to _uncategorized.
    "venv_ensurepip_fail":  11,  # Debian/Ubuntu missing python3-venv;
                                 # stderr mentions ensurepip non-zero exit
                                 # or "ensurepip is not available"
    "venv_path_too_long":   12,  # Windows MAX_PATH (260) or POSIX
                                 # ENAMETOOLONG — venv writes deep paths
                                 # under state_dir/agent-sdk-venv/Lib/...
    "venv_no_module":       13,  # `python3 -m venv` itself missing — "No
                                 # module named 'venv'" / "No module named venv"
    "venv_already_exists":  14,  # Errno 17 / "file exists" — sentinel race
                                 # past O_EXCL or stale dir survived --clear
    "venv_setup_failed":    15,  # Generic "virtual environment was not
                                 # created successfully" — catches the long
                                 # tail of venv setup failures that don't
                                 # match a more specific category above
    # 16–98 reserved for future categories; APPEND-ONLY.
    # 99 catches everything else (including "exc:<TypeName>" and "other:<tail>"
    # — the original string is debug-loggable but the integer is what makes
    # it to telemetry). For the "other:" tail, `sdk_bootstrap_stderr_sig`
    # carries a bounded integer hash so we can still distinguish patterns
    # in BQ aggregation.
    "_uncategorized":       99,
}

# Exception-type encoding for the "exc:<TypeName>" err_kinds (the generic
# `except Exception` path — venv/pip raised a Python exception rather than
# a CalledProcessError with categorizable stderr).
#
# #2154 telemetry surfaced that the dominant remaining venv BUILD_FAILED
# bucket (phase=venv, err=99) is ~99% `exc:` with stderr_sig=NULL — i.e.
# exceptions, not stderr-bearing subprocess failures — so the stderr_sig
# hash couldn't distinguish them. This maps the exception TYPE to a stable
# code so BQ can tell FileNotFoundError (python/venv binary missing) from
# PermissionError (read-only home) from a bare OSError, etc.
#
# All the FileNotFoundError/PermissionError/etc. entries are OSError
# subclasses, so they ALSO carry an errno (see _encode_errno) — the type
# code gives the Python class, errno gives the OS-level cause. APPEND-ONLY.
SDK_BOOTSTRAP_EXC_CODES = {
    "FileNotFoundError":  1,   # interpreter/venv path component missing
    "PermissionError":    2,   # read-only home, sandboxed FS
    "NotADirectoryError": 3,
    "IsADirectoryError":  4,
    "FileExistsError":    5,   # (sentinel race is handled separately; this
                               # is FileExistsError from elsewhere in venv)
    "OSError":            6,   # bare OSError — errno carries the real cause
    "BlockingIOError":    7,
    "BrokenPipeError":    8,
    "ConnectionError":    9,
    "TimeoutError":       10,  # distinct from subprocess.TimeoutExpired
    "InterruptedError":   11,
    "MemoryError":        12,
    "UnicodeDecodeError": 13,
    "ValueError":         14,
    "RuntimeError":       15,
    # 16–98 reserved; APPEND-ONLY.
    "_other_exc":         99,  # an exception type not in this map
}


def _encode_phase(s):
    """Map err_phase string to its telemetry integer code, or 0 if unset.
    Empty/None → 0 lets `if encoded:` cleanly skip emission. Per
    SDK_BOOTSTRAP_PHASE_CODES, valid codes are 1-4."""
    return SDK_BOOTSTRAP_PHASE_CODES.get((s or "").strip(), 0)


def _encode_err_kind(s):
    """Map err_kind string to its telemetry integer code, or 0 if unset.
    Direct hits use the static map; "exc:<X>" and "other:<tail>" both
    collapse to _uncategorized (99) — the raw string survives in debug
    logs, only the integer reaches BQ."""
    s = (s or "").strip()
    if not s:
        return 0
    if s in SDK_BOOTSTRAP_ERR_CODES:
        return SDK_BOOTSTRAP_ERR_CODES[s]
    # "signal_killed:<rc>" carries the returncode in sdk_bootstrap_rc; the
    # category maps to the signal_killed code.
    if s.startswith("signal_killed"):
        return SDK_BOOTSTRAP_ERR_CODES["signal_killed"]
    # Prefix matches for the catch-all categories
    if s.startswith("exc:") or s.startswith("other:") or s == "other":
        return SDK_BOOTSTRAP_ERR_CODES["_uncategorized"]
    # Unknown string — still emit as uncategorized rather than dropping
    return SDK_BOOTSTRAP_ERR_CODES["_uncategorized"]


def _encode_rc(err_kind):
    """Extract the subprocess returncode embedded in a 'signal_killed:<rc>'
    err_kind (e.g. -11 SIGSEGV / -9 SIGKILL / 139 shell-wrapped). Emitted as
    sdk_bootstrap_rc so BQ can tell OOM-killer (-9) from RLIMIT_AS (-11).
    Returns 0 when absent/non-numeric."""
    if not err_kind or not err_kind.startswith("signal_killed:"):
        return 0
    try:
        return int(err_kind.split(":", 1)[1])
    except (ValueError, IndexError):
        return 0


def _is_signal_kill(returncode) -> bool:
    """A subprocess killed by a signal rather than a clean non-zero exit.
    subprocess.run (no shell, as used here) reports negative rc = -signum
    (SIGKILL→-9 OOM-killer, SIGSEGV→-11 RLIMIT_AS, SIGABRT→-6). The 128+sig
    forms (134/137/139) are defensive for any shell-wrapped path. Paired with
    empty stdout+stderr this is the memory-kill signature (CCR repro)."""
    if returncode is None:
        return False
    return returncode < 0 or returncode in (134, 137, 139)


def _cooldown_remaining(state_dir) -> float:
    """Seconds left in the signal-kill cooldown (0 if none/expired). Reads the
    marker's mtime; a missing/unreadable marker means not in cooldown."""
    marker = Path(state_dir) / "agent-sdk-venv.cooldown"
    try:
        age = time.time() - marker.stat().st_mtime
    except OSError:
        return 0.0
    return max(0.0, SIGNAL_KILL_COOLDOWN_SEC - age)


def _write_cooldown(state_dir) -> None:
    """Start/refresh the signal-kill cooldown so we stop re-attempting a build
    that keeps getting killed every session. Best-effort."""
    try:
        Path(state_dir).mkdir(parents=True, exist_ok=True)
        (Path(state_dir) / "agent-sdk-venv.cooldown").write_text(
            time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    except OSError:
        pass


def _encode_stderr_sig(err_kind):
    """Bounded integer hash of the stderr tail captured in "other:<tail>"
    err_kinds. Lets us distinguish patterns INSIDE the _uncategorized
    (code 99) bucket without unbounded cardinality.

    Returns 0 for non-"other:" err_kinds (so the field auto-omits from
    emit_metrics on categorized failures — see the emit block in main()).

    Strategy: take the tail's first ~30 chars (post-lowercase, post-trim),
    SHA-1, fold the first 2 bytes to 0–999. Different stderr messages
    cluster into different buckets; same stderr always maps to the same
    bucket. Cardinality is bounded at 1000, well below any "high
    cardinality" alarm — and a real failure mode typically produces
    near-identical stderr across thousands of machines, so 1000 buckets
    is comfortably wide.

    Why first ~30 chars: stderr like "ERROR: Command failed: <full
    path>" varies the tail wildly (paths) but the categorization signal
    is in the leading words. Dropping the suffix focuses the hash on
    the discriminative part.
    """
    if not err_kind or not err_kind.startswith("other:"):
        return 0
    import hashlib
    tail = err_kind[len("other:"):].strip().lower()[:30]
    if not tail:
        return 0
    h = hashlib.sha1(tail.encode("utf-8", errors="replace")).digest()
    return int.from_bytes(h[:2], "big") % 1000


def _encode_exc_kind(err_kind):
    """Map an "exc:<TypeName>[:errno]" err_kind to its exception-type code
    (SDK_BOOTSTRAP_EXC_CODES). Returns 0 for non-exc err_kinds (so the
    sdk_bootstrap_exc field auto-omits on stderr/categorized failures).
    Unmapped exception types → 99 (_other_exc)."""
    if not err_kind or not err_kind.startswith("exc:"):
        return 0
    # "exc:OSError:28" → "OSError"; "exc:RuntimeError" → "RuntimeError"
    name = err_kind[len("exc:"):].split(":", 1)[0].strip()
    if not name:
        return 0
    return SDK_BOOTSTRAP_EXC_CODES.get(name, SDK_BOOTSTRAP_EXC_CODES["_other_exc"])


def _encode_errno(err_kind):
    """Extract the OS errno from an "exc:<TypeName>:<errno>" err_kind.
    OSError-family exceptions embed their errno (ENOENT=2, EACCES=13,
    ENOSPC=28, …) — the OS-level cause is far more actionable than the
    Python class alone. Returns 0 when absent/non-numeric (field omitted)."""
    if not err_kind or not err_kind.startswith("exc:"):
        return 0
    parts = err_kind.split(":")
    if len(parts) < 3:
        return 0
    try:
        return int(parts[2])
    except (ValueError, IndexError):
        return 0


def _probe_has_pip() -> bool:
    """True iff the current interpreter can run pip (`-m pip --version`).

    Probed only on the venv_ensurepip_fail path (see __main__), NOT on the
    happy path — it's an extra subprocess we only want when diagnosing a
    failure. The result decides whether a `pip install --target` fallback
    (Option A) is even viable for this machine: ensurepip/venv missing but
    pip present → --target would work; pip also missing → it wouldn't, and
    the user needs a system package (python3-venv / a complete Python)."""
    try:
        r = subprocess.run(
            [sys.executable, "-m", "pip", "--version"],
            capture_output=True, timeout=10,
        )
        return r.returncode == 0
    except Exception:
        return False


def _probe_alt_python() -> int:
    """When the hook interpreter is <3.10 (HOOK_PY_INCOMPATIBLE), look for a
    3.10+ interpreter at well-known install locations that aren't necessarily
    on the hook's PATH — Homebrew (/opt/homebrew, /usr/local), python.org
    framework builds, and the `py`/distro layouts. Returns the HIGHEST version
    found encoded as major*100+minor (e.g. 312), or 0 if none.

    Purpose (telemetry only, for now): size how many of the macOS Python-3.9
    cohort actually HAVE a newer interpreter that sg-python.sh's PATH probe
    missed — i.e. how many are RECOVERABLE by an explicit-path search vs.
    genuinely 3.9-only. Emitted as sdk_alt_py. Existence-checks the versioned
    binaries (cheap); a later explicit-path search would version-verify before
    exec'ing. Probed only on the incompatible path, so healthy sessions never
    pay for it."""
    candidates = []
    for minor in (14, 13, 12, 11, 10):
        candidates += [
            f"/opt/homebrew/bin/python3.{minor}",        # Apple-Silicon Homebrew
            f"/usr/local/bin/python3.{minor}",           # Intel Homebrew / python.org shim
            f"/Library/Frameworks/Python.framework/Versions/3.{minor}/bin/python3",  # python.org
            f"/usr/bin/python3.{minor}",                 # distro-managed (Linux)
        ]
    best = 0
    for path in candidates:
        try:
            if os.access(path, os.X_OK):
                # path name encodes the minor; parse it back to a code
                base = os.path.basename(path)
                minor = None
                if base.startswith("python3."):
                    minor = int(base.split(".")[1])
                elif "/Versions/3." in path:
                    minor = int(path.split("/Versions/3.")[1].split("/")[0])
                if minor is not None:
                    best = max(best, 300 + minor)
        except (OSError, ValueError, IndexError):
            continue
    return best


def _pip_err_from_stderr(stderr_b):
    """Categorize a pip-install stderr into a known err_kind (the pip subset
    of SDK_BOOTSTRAP_ERR_CODES). Used by the --target fallback; mirrors the
    pip branches of main()'s inline categorizer. Kept as a sibling rather
    than extracting main()'s chain (which also has venv-phase branches) to
    avoid disturbing the working venv categorization."""
    if isinstance(stderr_b, bytes):
        s = stderr_b.decode("utf-8", errors="replace")
    else:
        s = str(stderr_b or "")
    low = s.lower()
    if "no matching distribution" in low or "could not find a version" in low:
        return "pip_no_match"
    if ("name or service not known" in low or "name resolution" in low
            or "nodename nor servname" in low or "temporary failure in name" in low):
        return "dns_fail"
    if "connection refused" in low or "connection reset" in low:
        return "conn_refused"
    if "ssl" in low and ("verify" in low or "certificate" in low):
        return "ssl_verify"
    if "permission denied" in low or "read-only file system" in low:
        return "perm_denied"
    if "no module named pip" in low or "no module named ensurepip" in low:
        return "no_pip"
    if "no space left" in low or "disk quota" in low:
        return "disk_full"
    if "proxy" in low and ("authent" in low or "tunnel" in low or "407" in low):
        return "proxy_auth"
    if "timeout" in low or "timed out" in low:
        return "stderr_timeout"
    tail = next((ln.strip() for ln in reversed(s.splitlines()) if ln.strip()), "")[:60]
    return f"other:{tail}" if tail else "other"


def _target_dir(state_dir) -> Path:
    return Path(state_dir) / "agent-sdk-libs"


def _target_sdk_importable(state_dir) -> bool:
    """True iff the --target libs dir has an importable claude_agent_sdk,
    probed with THIS interpreter (the one llm.py will import it from) and the
    target dir prepended to sys.path. Cheap dir-check first to avoid a
    subprocess on the common no-target path."""
    target = _target_dir(state_dir)
    if not (target / "claude_agent_sdk").is_dir():
        return False
    try:
        r = subprocess.run(
            [sys.executable, "-c",
             "import sys; sys.path.insert(0, sys.argv[1]); import claude_agent_sdk",
             str(target)],
            capture_output=True, timeout=10,
        )
        return r.returncode == 0
    except Exception:
        return False


def _build_via_target(state_dir) -> tuple[int, str, str]:
    """Fallback install when `python -m venv` can't bootstrap pip (ensurepip
    missing — Debian python3-venv absent, or a python.org/pyenv build without
    ensurepip). `pip install --target <dir>` needs only the system pip, not
    venv/ensurepip. v2.0.4 telemetry (sdk_has_pip) confirmed ~95% of
    venv_ensurepip_fail users have pip. The consumer (llm.py) adds this flat
    dir to sys.path. Returns (outcome, err_phase, err_kind).

    --upgrade so a stale/partial target dir from a prior failed attempt
    doesn't make pip refuse; --prefer-binary mirrors the venv path's wheel
    preference (ARM64 Windows cryptography)."""
    target = _target_dir(state_dir)
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install",
             "--target", str(target), "--upgrade",
             "--disable-pip-version-check", "--prefer-binary", "--no-cache-dir",
             "claude-agent-sdk"],
            capture_output=True, timeout=120, check=True,
        )
        return BUILT_TARGET, "", ""
    except subprocess.CalledProcessError as e:
        # A --target pip install is also memory-heavy, so it too can be
        # signal-killed under memory pressure — cool down, same as the venv path.
        if _is_signal_kill(e.returncode):
            _write_cooldown(state_dir)
            return BUILD_FAILED, "pip_target", f"signal_killed:{e.returncode}"
        return BUILD_FAILED, "pip_target", _pip_err_from_stderr(e.stderr)
    except subprocess.TimeoutExpired:
        return BUILD_FAILED, "pip_target", "subprocess_timeout"
    except Exception as e:
        errno = getattr(e, "errno", None)
        if isinstance(errno, int):
            return BUILD_FAILED, "pip_target", f"exc:{type(e).__name__}:{errno}"
        return BUILD_FAILED, "pip_target", f"exc:{type(e).__name__}"


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
    # Honesty check (fixes the misleading NOOP_VENV in #2071): the SDK
    # requires Python >=3.10 and uses 3.10+ syntax (match statements,
    # PEP 604 unions). On a 3.9 hook interpreter we CANNOT import it no
    # matter how the venv was built — llm.py runs in this same interpreter
    # and the syntax-level import will SyntaxError. macOS ships 3.9.6 as
    # the default `python3` and `/usr/bin` precedes Homebrew in PATH, so
    # this case is the default state for a large share of macOS users.
    #
    # sg-python.sh now prefers python3.10+ binaries so most users won't
    # reach this branch; the fallback to 3.9 is preserved for the
    # pattern-warning hooks that don't need the SDK. Reporting
    # HOOK_PY_INCOMPATIBLE here:
    #   (a) avoids 30-60s of wasted pip install,
    #   (b) avoids the lie where the venv_py probe says NOOP_VENV but the
    #       consumer import fails, and
    #   (c) gives telemetry a clean bucket to size the affected fleet.
    if sys.version_info < (3, 10):
        return (
            HOOK_PY_INCOMPATIBLE,
            "hook_py",
            f"py_{sys.version_info[0]}.{sys.version_info[1]}",
        )

    if _sdk_on_syspath():
        return NOOP_SYSTEM, "", ""

    state_dir = Path(_resolve_state_dir())
    venv = state_dir / "agent-sdk-venv"
    # Windows venvs put the interpreter at Scripts\python.exe; POSIX uses bin/python.
    if sys.platform == "win32":
        venv_py = venv / "Scripts" / "python.exe"
    else:
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

    # If a prior run installed the SDK via the --target fallback (ensurepip
    # path), reuse it. Only reached when there's no working venv, so healthy
    # NOOP_VENV users never pay for this probe.
    if _target_sdk_importable(state_dir):
        return NOOP_TARGET, "", ""

    # If a recent build was signal-killed (memory pressure), don't re-attempt
    # this session — the memory-heavy venv+pip just gets killed again, burning
    # the user's resources. Retry at most once per cooldown window. Reached
    # only after all no-op probes, so a machine that later gets the SDK via
    # system/venv/target still short-circuits above.
    if _cooldown_remaining(state_dir) > 0:
        return SKIP_COOLDOWN, "", ""

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
        #
        # --prefer-binary: on ARM64 Windows, pip's default resolver picks a
        # `cryptography` version with no published binary wheel and tries to
        # build from source, which needs Rust/Cargo (almost never present
        # on user machines). The build fails and the whole bootstrap returns
        # BUILD_FAILED. A binary wheel exists on PyPI for an adjacent
        # version (`cryptography-46.0.3-cp311-abi3-win_arm64.whl`);
        # --prefer-binary tells pip to pick it. Cross-platform safe: no-op
        # on platforms where the latest version already has a wheel.
        err_phase = "pip"
        # --no-cache-dir trims pip's peak memory (no cache read/write/unpack
        # buffering) — helps marginal low-memory machines get under the OOM
        # threshold that kills the dominant Linux builds (CCR repro).
        subprocess.run(
            [str(venv_py), "-m", "pip", "install", "--quiet",
             "--disable-pip-version-check", "--prefer-binary", "--no-cache-dir",
             "claude-agent-sdk"],
            capture_output=True, timeout=120, check=True,
        )
        return BUILT, "", ""
    except subprocess.CalledProcessError as e:
        # Signal kill (OOM-killer SIGKILL / RLIMIT_AS SIGSEGV) — rc<0, empty
        # streams. The dominant Linux failure. Record the rc, start a cooldown
        # so we stop retry-storming a build that keeps getting killed, and
        # skip the stderr categorization (there's nothing in stderr). err_phase
        # says whether it died creating the venv or installing via pip.
        if _is_signal_kill(e.returncode):
            _write_cooldown(state_dir)
            return BUILD_FAILED, err_phase, f"signal_killed:{e.returncode}"
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
        # Venv-specific patterns checked FIRST — they overlap with some pip
        # patterns (e.g. "no module named ensurepip" could match no_pip OR
        # venv_ensurepip_fail; the venv-stage interpretation is the right
        # one when err_phase=="venv"). Order is venv-most-specific →
        # pip-historical → generic.
        if err_phase == "venv" and (
            "ensurepip is not available" in s
            or ("ensurepip" in s and "returned non-zero" in s)
            or "the virtual environment was not created" in s and "ensurepip" in s
        ):
            err_kind = "venv_ensurepip_fail"
        elif err_phase == "venv" and (
            "[errno 36]" in s
            or "file name too long" in s
            or "path too long" in s
        ):
            err_kind = "venv_path_too_long"
        elif err_phase == "venv" and (
            "no module named venv" in s
            or "no module named 'venv'" in s
        ):
            err_kind = "venv_no_module"
        elif err_phase == "venv" and (
            "[errno 17]" in s
            or ("file exists" in s and "venv" in s)
        ):
            err_kind = "venv_already_exists"
        elif "no matching distribution" in s or "could not find a version" in s:
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
        elif err_phase == "venv" and (
            "virtual environment was not created" in s
            or "error: command" in s and "venv" in s
        ):
            # Generic venv-setup catch-all — matched AFTER the more specific
            # venv patterns above so we don't shadow them, but BEFORE the
            # other: fallback so generic venv setup failures get their own
            # bucket instead of polluting the long-tail signature space.
            err_kind = "venv_setup_failed"
        else:
            # First 60 chars of the last non-empty stderr line — bounded to
            # stay inside CC's metric value-length budget. Real failure modes
            # we haven't categorized show up here as a low-cardinality bucket.
            tail = next(
                (ln.strip() for ln in reversed(stderr_str.splitlines()) if ln.strip()),
                "",
            )[:60]
            err_kind = f"other:{tail}" if tail else "other"
        # venv couldn't bootstrap pip (ensurepip missing) but pip itself may
        # work — fall back to a flat `pip install --target`. Only this one
        # category falls through; every other venv/pip failure is terminal.
        # The finally block unlinks our sentinel first (so the target build
        # isn't blocked by it); _build_via_target does the target install.
        if err_kind == "venv_ensurepip_fail":
            if we_own_sentinel:
                sentinel.unlink(missing_ok=True)
                we_own_sentinel = False
            return _build_via_target(state_dir)
        return BUILD_FAILED, err_phase, err_kind
    except subprocess.TimeoutExpired:
        return BUILD_FAILED, err_phase, "subprocess_timeout"
    except Exception as e:
        # Embed errno for OSError-family exceptions ("exc:OSError:28") so
        # telemetry can decode the OS-level cause (ENOENT/EACCES/ENOSPC/…),
        # not just the Python class. #2154 follow-up: this is the dominant
        # remaining venv BUILD_FAILED bucket. See _encode_exc_kind/_encode_errno.
        errno = getattr(e, "errno", None)
        if isinstance(errno, int):
            return BUILD_FAILED, err_phase, f"exc:{type(e).__name__}:{errno}"
        return BUILD_FAILED, err_phase, f"exc:{type(e).__name__}"
    finally:
        # Only remove the sentinel if THIS process created it. The
        # FileExistsError path above means another process owns the lock;
        # unconditionally unlinking here would delete its sentinel and let
        # a third concurrent SessionStart `venv --clear` over the in-flight
        # build.
        if we_own_sentinel:
            sentinel.unlink(missing_ok=True)


def _maybe_emit_user_notice(outcome: int, pv: int) -> str | None:
    """Return a one-time user-visible notice when the agentic reviewer is
    in a persistent broken state on this machine, or None if we've already
    shown the notice for this plugin version (or shouldn't show one).

    The marker file is plugin-version-keyed: a future plugin update can
    re-notify if behavior changes (e.g. we ship out-of-process SDK in v3
    and want to tell affected users it's fixed). Failures to write the
    marker degrade to "skip the notice this session" so we don't spam
    every SessionStart on a read-only home dir.

    Currently only HOOK_PY_INCOMPATIBLE qualifies. BUILD_FAILED is
    intentionally excluded — it covers transient causes (network failure,
    pip registry hiccup, in-flight rebuild) where the next session may
    succeed and a permanent notice would mislead.
    """
    if outcome != HOOK_PY_INCOMPATIBLE:
        return None
    try:
        state_dir = Path(_resolve_state_dir())
        marker = state_dir / f".agentic_unavailable_notice_v{pv or 0}"
        if marker.exists():
            return None
        state_dir.mkdir(parents=True, exist_ok=True)
        # Write timestamp + Python version so the marker is self-documenting
        # if a user goes looking. O_EXCL would be racier with no real win
        # (two concurrent SessionStarts both showing the notice once is fine).
        marker.write_text(
            f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} "
            f"py={sys.version_info[0]}.{sys.version_info[1]}\n"
        )
    except OSError:
        return None
    return (
        f"⚠ security-guidance plugin: the cross-file commit reviewer "
        f"(layer 3 of 3 — catches IDOR, auth-bypass, cross-file SSRF) "
        f"is unavailable in this environment. It requires Python ≥3.10, "
        f"but the hook is running on "
        f"{sys.version_info[0]}.{sys.version_info[1]}.\n\n"
        f"Pattern checks and the single-shot LLM diff review are still "
        f"active. To enable the deeper reviewer, install Python 3.10+ "
        f"(e.g. `brew install python` on macOS) and restart Claude Code.\n\n"
        f"This notice is shown once per plugin version. "
        f"See: github.com/anthropics/claude-plugins-official/issues/2071"
    )


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
    # \n and json-parses each independently.
    #
    # IMPORTANT — values must be bool|finite-number. The validation comment
    # has historically said "or short strings" but that was wrong: CC's
    # plugin-metrics pipeline silently drops plugin-emitted string values.
    # Stay inside the 10-key emit cap.
    metrics: dict[str, object] = {
        "sdk_bootstrap": outcome,
        "sdk_bootstrap_ms": round((time.perf_counter() - t0) * 1000),
    }
    if err_kind:
        # Encode phase + err_kind as integer codes (see
        # SDK_BOOTSTRAP_PHASE_CODES / SDK_BOOTSTRAP_ERR_CODES). Earlier
        # versions emitted these as strings and CC dropped them — restoring
        # the diagnostic split that 28K BUILD_FAILED/day need to triage by
        # root cause. err_phase defaults to "pre" when empty (pre-venv
        # failure path, e.g. state_dir.mkdir perm-denied).
        metrics["sdk_bootstrap_phase"] = _encode_phase(err_phase or "pre")
        metrics["sdk_bootstrap_err"] = _encode_err_kind(err_kind)
        # For "other:<tail>" (encoded err==99), emit a bounded integer
        # hash of the stderr tail so BQ can distinguish patterns inside
        # the _uncategorized bucket without unbounded cardinality. Zero
        # when err_kind is categorized — the schema reader treats 0 as
        # "no signal", matching the absence convention.
        sig = _encode_stderr_sig(err_kind)
        if sig:
            metrics["sdk_bootstrap_stderr_sig"] = sig
        # Exception-type + errno for the "exc:" bucket (the dominant
        # remaining venv BUILD_FAILED mode per #2154 telemetry). Both
        # auto-omit (0) on stderr/categorized failures.
        exc = _encode_exc_kind(err_kind)
        if exc:
            metrics["sdk_bootstrap_exc"] = exc
        exc_errno = _encode_errno(err_kind)
        if exc_errno:
            metrics["sdk_bootstrap_errno"] = exc_errno
        # Subprocess returncode for signal kills (-9 OOM-killer / -11
        # RLIMIT_AS / -6 abort). Confirms in prod which signal dominates the
        # Linux memory-kill bucket. 0 (omitted) for non-signal failures.
        rc = _encode_rc(err_kind)
        if rc:
            metrics["sdk_bootstrap_rc"] = rc
        # venv_ensurepip_fail (code 11) is the top categorizable venv
        # failure, and telemetry shows it's NOT just Debian — macOS has the
        # most distinct affected users. Probe whether this interpreter has
        # pip so we know if a `pip install --target` fallback (Option A)
        # would actually help, vs the user needing a system package. Probed
        # only here (not on the happy path) to avoid an extra subprocess
        # per healthy session.
        if _encode_err_kind(err_kind) == 11:
            metrics["sdk_has_pip"] = _probe_has_pip()
    # When the hook interpreter is <3.10 (HOOK_PY_INCOMPATIBLE), probe for a
    # 3.10+ interpreter at known non-PATH locations. Non-zero sdk_alt_py =
    # this user is RECOVERABLE by an explicit-path search in sg-python.sh; 0 =
    # genuinely 3.9-only (needs a user install). Sizes the macOS Py-3.9 cohort
    # (~13.6% of macOS sessions) before we build the search. Incompatible path
    # only — healthy sessions never run it.
    if outcome == HOOK_PY_INCOMPATIBLE:
        metrics["sdk_alt_py"] = _probe_alt_python()
    # Interpreter version (major*100 + minor, e.g. 309 / 312), emitted on
    # every bootstrap. Disambiguates the macOS cohort (Apple 3.9 vs a 3.10+
    # with broken ensurepip) for both venv_ensurepip_fail AND
    # HOOK_PY_INCOMPATIBLE (whose "py_3.9" err_kind otherwise collapses to
    # err=99, losing the version). Cheap — no subprocess, just sys.version_info.
    metrics["sdk_hook_py"] = sys.version_info[0] * 100 + sys.version_info[1]
    pv = _plugin_version_int()
    if pv:
        metrics["pv"] = pv
    response: dict[str, object] = {"metrics": metrics}
    # One-time user-visible notice when the agentic reviewer is dead on
    # arrival. Uses hookSpecificOutput.additionalContext (SessionStart's
    # supported channel for surfacing text to both the model and the user)
    # plus systemMessage as a belt-and-suspenders. Marker-file-gated so
    # this fires exactly once per plugin version per install — see
    # _maybe_emit_user_notice.
    notice = _maybe_emit_user_notice(outcome, pv)
    if notice:
        response["hookSpecificOutput"] = {
            "hookEventName": "SessionStart",
            "additionalContext": notice,
        }
        response["systemMessage"] = notice
    print(json.dumps(response), flush=True)
