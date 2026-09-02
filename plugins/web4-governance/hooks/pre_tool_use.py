#!/usr/bin/env python3
"""Hestia PreToolUse hook for Claude Code — synchronous policy gate.

Wired from .claude-plugin/plugin.json as the PreToolUse hook. Reads the
hook event JSON from stdin, asks the local Hestia daemon for a policy
decision, and exits with the appropriate code to allow / warn / deny
the tool call.

DESIGN
- **Synchronous on Claude Code's critical path.** Unlike the
  PostToolUse witness hook (fire-and-forget), this one MUST block until
  the daemon answers, because Claude Code uses the exit code to decide
  whether to run the tool.
- **Short budget.** Total deadline is `TOTAL_BUDGET_MS` (default 800 ms).
  If the daemon hasn't returned a `decided` verdict by then, we fall
  back to the local heuristic engine (the legacy `web4-governance`
  plugin's pre_tool_use.py).
- **Wait protocol (spec §3.4.1).** If the daemon returns
  `status: "evaluating"` with `nextPollMs: N`, we sleep N ms and
  re-query — up to `MAX_POLLS` times. Useful when (future) LLM-backed
  policy entities need a moment.
- **Action cache.** On a decision we store the action_id under
  /tmp/hestia-actions/<tool_use_id>.json so the PostToolUse hook can
  pair the outcome to the begin_action.
- **Exit semantics for Claude Code:**
    - `exit 0` (silent)               — allow, no message
    - `exit 0` with stderr message    — warn, surfaced to the agent
    - `exit 2` with stderr message    — DENY, Claude Code blocks the tool

ENV
  HESTIA_HOOK_DEBUG=1            log to ~/.hestia-claude/hook.log
  HESTIA_PRE_TOTAL_BUDGET_MS     override TOTAL_BUDGET_MS
  HESTIA_ENDPOINT                override endpoint discovery

FAIL-CLOSED IS NOT A SWITCH (dp, 2026-08-31: "there shouldn't be legacy fallback
period, and fail closed shouldn't be optional"). Any path that cannot get a daemon
verdict — daemon unreachable, budget exhausted, empty or unparseable event,
unexpected error — DENIES. There is no env var that relaxes this and no legacy
engine to fall back to. `HESTIA_PRE_FAIL_CLOSED`, `HESTIA_PRE_NO_FALLBACK` and
`HESTIA_LEGACY_FALLBACK` are gone; a launcher still exporting them is harmless and
has no effect. This closes GATE_BYPASS_CATALOG #2, in which an unreachable endpoint
plus a non-existent fallback path exited 0 with no stderr at all.
"""

from __future__ import annotations

import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional, Tuple

# ---- Config -----------------------------------------------------------

PLUGIN_ID = "claude-code"
HOST_AGENT = "claude-code"
PROTOCOL_VERSION = 1
HOOK_VERSION = "0.0.2"

STATE_DIR = Path.home() / ".hestia-claude"
ACTIONS_DIR = Path("/tmp/hestia-actions")
DEFAULT_HESTIA_HOME = Path.home() / ".hestia"
DEFAULT_ENDPOINT = "http://127.0.0.1:7711/mcp"

# Total time budget across all daemon round-trips + re-polls.
TOTAL_BUDGET_MS = int(os.environ.get("HESTIA_PRE_TOTAL_BUDGET_MS", "800"))
# Why the last daemon call failed — "timeout" (alive but starved), "refused"
# (nothing listening) or "unknown". Read by `deny_no_verdict` so the refusal can
# state what is known instead of asserting a cause it cannot observe. Module-level
# because the failure happens deep in the request path and the message is composed
# at the top; a hook process handles one call, so there is no cross-request bleed.
_LAST_FAILURE = "unknown"


def _set_last_failure(kind: str) -> None:
    global _LAST_FAILURE
    _LAST_FAILURE = kind


# Per-request HTTP timeout. Raised 0.5 -> 5.0 and made overridable (dp, 2026-08-11), propagating
# the society gate's 2026-08-07 fix that never reached this hook. 0.5s was the BINDING constraint,
# NOT TOTAL_BUDGET_MS: the call site takes min(REQUEST_TIMEOUT_S, remaining), so raising only the
# total budget was a no-op — every request died at 500ms under any daemon slowness (a loaded box, or
# the memory-sawtooth), fail-closing the member with "no policy verdict" while the daemon was merely
# slow, not down. Must stay below TOTAL_BUDGET_MS (set per-member in the launcher), which must itself
# stay below the engine's hook timeout, or a gate call rides past the engine deadline and fails OPEN.
REQUEST_TIMEOUT_S = float(os.environ.get("HESTIA_PRE_REQUEST_TIMEOUT_S", "5.0"))
# Cap on re-poll iterations during the "evaluating" wait protocol.
MAX_POLLS = 5
# Floor on poll sleep to avoid busy loops if daemon misbehaves.
MIN_POLL_SLEEP_MS = 50

# TOMBSTONE (dp ruling, 2026-08-31). `LEGACY_FALLBACK` lived here and named an
# operator-supplied path to the pre-port web4-governance gate. It is deleted, not
# defaulted: an env-supplied path whose ABSENCE means ALLOW is a bypass with a
# configuration switch on it, and it was the live half of GATE_BYPASS_CATALOG #2
# (unreachable endpoint + missing fallback = exit 0, no stderr). Nothing replaces
# it. No verdict now means deny, on every path.


def debug_log(msg: str) -> None:
    if os.environ.get("HESTIA_HOOK_DEBUG") != "1":
        return
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with (STATE_DIR / "hook.log").open("a") as f:
            f.write(f"{time.strftime('%H:%M:%S')} pre  {msg}\n")
    except OSError:
        pass


def discover_endpoint() -> Optional[str]:
    env = os.environ.get("HESTIA_ENDPOINT")
    if env:
        return env
    home = Path(os.environ.get("HESTIA_HOME", str(DEFAULT_HESTIA_HOME)))
    try:
        v = (home / "endpoint").read_text().strip()
        return v or None
    except OSError:
        return None



# ---------------------------------------------------------------------------
# THE GATE IS NOT THE AGENT'S TO EDIT — OR TO READ
# ---------------------------------------------------------------------------
#
# dp, 2026-07-28: "an agent that wants to do something it doesn't want governed
# can use this to turn off the gate, do whatever, then turn it back on like
# nothing happened. that wouldn't be an accident :)"
#
# Correct, and it is the hole that makes every other control optional. Gate
# integrity (#52) HASHES this file and reports drift on an operator endpoint —
# tamper-EVIDENT, and only to a human who looks. Nothing in the decision path
# consults it, so disable -> act -> restore leaves a clean record and a matching
# hash. The whole governance model rests on a file the governed party can write.
#
# THE PRINCIPLE, which we already use elsewhere: you do not get to modify the
# thing that governs you, for the same reason you do not get to rule on your own
# appeal. Gate custody belongs to a not-self party.
#
# WHY READ IS DENIED TOO, and not only write: reading this file is how you find
# its blind spots. Every false-positive class we hit this week was discoverable
# by reading the matcher. Denying read forces evasion to be blind probing, which
# is noisy, slow and leaves denials on the chain. It converts a silent read into
# an audible attempt.
#
# WHY THIS RUNS BEFORE THE DAEMON CALL AND NEVER CONSULTS IT: if this check
# required a verdict, then "kill the daemon, then edit the gate" would be the
# same evasion one layer over. Self-protection has to hold when everything else
# is down, so it is local, unconditional, and fails CLOSED.
#
# ON THE DELIBERATE JUDGE-BY-MENTION: for Bash this scans the WHOLE command for
# any mention of a self path, which is exactly the matching style that produced
# ten false positives this week and that policy::shell was written to fix. That
# is intentional and the stakes invert here. A false positive costs a rephrase;
# a false negative costs the entire governance model. `sed -i`, `cp`, `>`,
# `python -c`, `tee` and a heredoc all reach this file by different syntax, and
# an executable-position parse would have to be right about all of them.
#
# ONE SCOPED EXCEPTION (2026-08-07, kimi-code, claiming claude-code notice 1529):
# the daemon's destructive preset tells the member, in its reason string, that "a
# quoted heredoc body under cat/tee does not trip it" (presets.rs, backed by
# policy::shell) — but this hook runs FIRST and matched raw, so a report ABOUT the
# gate written by heredoc was refused by code the quoted law does not describe
# (FP8 through the Bash door; the Write door was carved out below when `content`
# left the haystack). `_blank_inert_heredoc_bodies` is that carve-out, here. It is
# deliberately NARROWER than policy::shell: only heredoc bodies are blanked, never
# quoted argument spans, because this gate matches PATHS and a path can sit at
# argument position — `tee "hooks/pre_tool_use.py"` must keep matching, while
# `rm "-rf"` shapes are the destructive preset's problem, not this one's. A
# heredoc body is stdin content: it can never name the destination, so blanking
# it cannot hide a write to the gate — the destination always sits in executable
# position (`> PATH`, `tee PATH`), where matching stays raw. Everything the parser
# cannot read confidently returns None and None means "match the raw command" —
# the fail-closed edge, unchanged.
#
# WHAT THIS IS NOT: containment. A determined agent can still reach the file by
# a path this misses, or kill the hook process. This is A1 — cooperative. What it
# removes is the CHEAP, SILENT version, and it removes "I didn't know" as an
# account, because the refusal names the rule.
_SELF = os.path.realpath(__file__)
_SELF_DIR = os.path.dirname(_SELF)
_SELF_MARKERS = (
    _SELF,
    _SELF_DIR,
    "plugins/claude-code/hooks",
    "hestia/hooks",
    # THE INSTALLERS ARE WRITE POSITIONS ON THIS GATE (claude-code disclosure 3a,
    # forum "the rung nobody built", 2026-08-07 — handed to kimi-code). Both sit
    # off every marker above by construction: `plugins/claude-code/install.sh`
    # one directory up, `deploy/install-members.sh` (#272) in a directory
    # no hook marker names. (#273, which carried install.sh, was CLOSED
    # unmerged in favour of #272 — the file lives only on that branch; the
    # marker pre-positions for its return, it names nothing on main today.)
    # Verified there by invocation: the gate ALLOWED
    # `bash <installer>` and only the script's own role check refused. Running
    # the installer overwrites the enforcing copy — it IS writing the gate, one
    # `cp` removed, and it belongs in the self-access class (witnessed,
    # escalatable) rather than in ordinary policy. Editing either script is the
    # same act one hop earlier, so the path-key match refusing it is intended.
    # Disclosed limit, same as every path marker: an invocation that never
    # spells the path (cd in, `bash install.sh`) matches nothing — A1 removes
    # the cheap silent version, it is not containment.
    "plugins/claude-code/install.sh",
    "deploy/install-members.sh",
)

# THE GOVERNANCE SURFACE, not just this file. Protecting only `pre_tool_use.py`
# was the first cut, and testing it found the gaps immediately: the SOCIETY gate
# (`society_pre_tool_use.py` — the one that actually parked a member today) and
# `witness.py` (the outcome recorder) were both reachable. Disarming the recorder
# is the worse attack of the two: it does not produce denials, it produces
# SILENCE, and silence is indistinguishable from "attempted nothing".
#
# Matched by filename anywhere, deliberately, so this holds for a peer's copy as
# well as mine. An agent editing ANOTHER member's gate is not a lesser act — it
# is disarming an entity that did not consent, and the record would name the
# victim rather than the author.
#
# `hestia_gate_core.py` added 2026-08-03, on the same reasoning one step ahead of it.
# PR #169 landed the shared policy core — the file that is to BECOME the single gate for
# all five harnesses, with the per-harness hooks reduced to adapter shims. It matched
# nothing here and nothing in `_SELF_MARKERS`, so the whole PR was written unrefused. That
# was verified by writing it, and disclosed in the PR rather than used.
#
# The failure mode consolidation creates: today, disarming the gate means editing five
# files and tripping this rule five times. After the shims land it means editing ONE file
# — and if that file is outside the rule, consolidation will have moved the entire policy
# surface somewhere unguarded while every per-harness protection still reads as intact.
# The rule would be green about five shims that no longer decide anything.
#
# Filename-anywhere is the right mechanism and not merely the convenient one: shims will
# import the core from several locations, so a directory marker would miss it — and the
# rationale directly above ("so this holds for a peer's copy as well as mine") is exactly
# the property needed when one file governs five members.
_GOVERNANCE_FILES = (
    "pre_tool_use.py",
    "society_pre_tool_use.py",
    "post_tool_use.py",
    "witness.py",
    "law_inject.py",
    "hestia_gate_core.py",
    # The shared in-process society-safety MECHANISM (#371): it carries the fail-closed contract
    # and interprets the daemon's verdict, so editing it can weaken a decision — governed like the
    # core it sits beside. Kept equal with the canonical list by the drift guard.
    "hestia_gate_mechanism.py",
    # The EXEMPTION LEDGER is a policy artifact too (codex NOT-SAME review of #175).
    # `gate_self_protection_test.py` holds `EXEMPT`, the list of shared files allowed to
    # escape the guard. Outside this tuple, the bypass was one unescalated write: add a new
    # decider to `plugins/_shared/`, add its name to EXEMPT, and every check passes. Its own
    # comment claimed adding an exemption was "as hard as adding a rule" while the code made
    # it free — an aspirational claim a reader would have trusted.
    "gate_self_protection_test.py",
)


# ---------------------------------------------------------------------------
# SPRINT B (gate-consolidation §6.B): THE SHARED GOVERNANCE-CLOSURE CLASSIFIER
# ---------------------------------------------------------------------------
# classify() is write-position keyed and accessor-agnostic (the PR #370 line): it
# replaces the live path through _touches_self, the text-match half of
# _touches_registration, and the Bash read/write split for gate-self classification.
# The local matchers below STAY, verbatim, as the Tier-2 fallback
# (_fallback_self_protection, before main()): on an import failure the closure
# protection must not silently vanish — the core's "mirrored, not imported" reasoning,
# pointed the other way.
# FLEET-CANONICAL SHARED ENGINE (dp, 2026-08-23): "the read should be from fleet generic
# ./hestia not ./claude".
#
# The default used to be derived from THIS hook's own location — `~/.claude/_shared` for
# claude-code. Measured 2026-08-23, that produced one shared engine per vendor and no
# agreement between them: claude-code read `~/.claude/_shared` (3 modules, 2026-08-14),
# kimi read the repo WORKING TREE (whatever branch the checkout sat on — 62 commits behind
# main at the time), codex had `~/.codex/_shared` holding a single module, gemini had none.
# Meanwhile `deploy/install-members.sh` wrote to `~/.hestia/shared`, which no member read
# and which did not exist. Installing would have stamped the deployment ledger CURRENT
# while every seat kept running a nine-day-old closure (#583).
#
# One fact, one name. `$HESTIA_HOME/shared` is the fleet path the installer already uses.
_HESTIA_HOME = os.environ.get("HESTIA_HOME") or os.path.join(
    os.path.expanduser("~"), ".hestia")


# THE LOADER IS THE ONE LAW-ADJACENT TEXT THAT CANNOT LIVE IN SHARED AUTHORITY, because it is
# what reaches shared authority. So it is duplicated by necessity across seats and must not be
# independently maintained: the two functions below are BYTE-IDENTICAL to the Codex seat's
# (#742, head 03a0ba8), one text, not a dialect. Review of #747 (GPT, 2026-09-01) held the
# merge on exactly the two places an earlier draft here differed from it:
#   * `except Exception` at module init let a SystemExit(0) raised by an installed module
#     escape before main(), ending the hook rc=0 -- an allow -- instead of the explicit
#     no-shared-authority rc=2. The boundary is BaseException, module INITIALISATION only,
#     re-raised as ImportError; main()'s own legitimate SystemExit stays outside it.
#   * inserting the selected dir at sys.path[0] only when its literal string was absent left
#     a decoy ahead of an already-present installed path. The selected dir is canonicalised,
#     equivalent spellings removed, and it goes first every time.
# Three claude-code resolution paths were deleted, not narrowed, on the way here: a repo
# `plugins/_shared` fallback taken when the installed dir was ABSENT (an existing empty
# tempdir suppressed it, so the negative test passed while branch-local law still answered);
# and `_load_mechanism()` / `_record_plane_e()` resolving `parents[2]/_shared` unconditionally
# at sys.path[0], measured live on build 561 as a 2026-08-14 engine answering marker-touching
# commands with floor-less grants. A missing installed engine is a fail-closed misdeployment,
# not permission to execute whatever law the checkout is sitting on.
# tools/loader_binds_installed_engine_test.py drives the controls on this seat;
# tools/installed_engine_loader_test.py (#742) drives the same shapes on Codex.
def _shared_runtime_dir():
    return os.environ.get("HESTIA_SHARED_DIR") or os.path.join(
        os.path.expanduser(os.environ.get("HESTIA_HOME", "~/.hestia")), "shared")


def _load_shared_module(name):
    """Load governing code only from the selected installed authority directory."""
    import importlib.util

    shared = _shared_runtime_dir()
    required = os.path.realpath(os.path.join(shared, name + ".py"))
    if not os.path.isfile(required):
        raise ImportError(
            f"installed Hestia shared module {name!r} is unavailable at {required!r}; "
            "run deploy/install-members.sh"
        )

    # Shared modules legitimately import one another by bare canonical name. Make only
    # the selected authority directory available to those imports; never add a checkout
    # fallback. Canonicalize it so a HESTIA_HOME/shared symlink and its build directory
    # cannot occupy two precedence positions.
    selected_dir = os.path.dirname(required)
    selected_key = os.path.normcase(selected_dir)
    retained = []
    for entry in sys.path:
        try:
            entry_key = os.path.normcase(os.path.realpath(os.fspath(entry) or os.getcwd()))
        except (TypeError, ValueError, OSError):
            retained.append(entry)
            continue
        if entry_key != selected_key:
            retained.append(entry)
    sys.path[:] = [selected_dir, *retained]

    cached = sys.modules.get(name)
    if cached is not None:
        cached_file = getattr(cached, "__file__", None)
        if cached_file and os.path.realpath(cached_file) == required:
            return cached
        sys.modules.pop(name, None)

    spec = importlib.util.spec_from_file_location(name, required)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot construct a loader for installed module {required!r}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException as exc:
        sys.modules.pop(name, None)
        # This boundary is module INITIALIZATION only. Convert even SystemExit(0) into
        # an ordinary loader failure so module-level callers reach the explicit
        # fail-closed posture; main()'s legitimate allow/deny SystemExit remains outside.
        raise ImportError(
            f"installed Hestia shared module {name!r} failed to initialize"
        ) from exc
    loaded_file = getattr(module, "__file__", None)
    if not loaded_file or os.path.realpath(loaded_file) != required:
        sys.modules.pop(name, None)
        raise ImportError(
            f"shared authority miswire: {name!r} resolved to {loaded_file!r}, "
            f"expected {required!r}"
        )
    return module


try:
    _closure_classify = _load_shared_module("hestia_governance_closure").classify
except Exception:  # noqa: BLE001 - Tier-2: the local matcher below stays in force
    _closure_classify = None

# The shell read/write classifier, from the SAME installed engine directory. Deliberately
# NOT wrapped in try/except: there is no local copy to fall back to any more, and a seat
# that cannot classify a command must not proceed to guess. An ImportError here is loud and
# denies every call, which is the ratified posture since fail-closed stopped being optional.
# deploy/install-members.sh points $HESTIA_HOME/shared at the verified build BEFORE it
# installs any hook, so a hook can never be newer than the engine it imports.
# GUARDED, and the guard is the whole point. An unguarded module-level import raises
# BEFORE main()'s handler exists, so the process dies with a traceback and exit 1 -- and
# under this harness's PreToolUse contract ONLY exit 2 blocks. Any other non-zero is a
# hook error the harness does not treat as a refusal, so a missing shared authority would
# have FAILED OPEN: the precise class deleted in #745. Caught here, refused in main().
try:
    _classifier = _load_shared_module("hestia_shell_classifier")
    _blank_inert_heredoc_bodies = _classifier._blank_inert_heredoc_bodies
    _is_read_only = _classifier._is_read_only
    _CLASSIFIER_UNAVAILABLE = None
except Exception as _exc:  # noqa: BLE001 -- any import failure is a missing authority
    _blank_inert_heredoc_bodies = None  # type: ignore[assignment]
    _is_read_only = None  # type: ignore[assignment]
    _CLASSIFIER_UNAVAILABLE = f"{type(_exc).__name__}: {_exc}"


# Commands whose arguments and stdin are DATA, never shell code — the same
# allowlist policy::shell uses, kept in sync with it deliberately. An allowlist,
# never a denylist: an unrecognised head is treated as interpreting, so
# `sh -c`, `eval`, `sed`, `awk`, `python3 -` and everything nobody has vetted keep
# their heredoc bodies fully scanned. Adding a name widens the gate; it belongs in
# a reviewed diff with the reason stated.
#
# `git` STAYS ABSENT and that is still correct — see `_git_stdin_is_data`, the
# other half of condition 2 rather than an entry here. A name in this list is a
# promise about every invocation of it, and `git` cannot make that promise.
# (Mirror of policy::shell's INERT_CONTENT_HEADS note; the shadow test below
# keeps adding `git` here a loud act, because the `git` arm decides first and a
# list entry would be unreachable — claude-code's sabotage finding, 2026-08-07.)
# --- `git`: the one head that is not a decision by itself ---------------------
#
# Mirror of policy::shell's `git_stdin_is_data` (claude-code, branch
# claude/git-stdin-is-argv-position), which lands adjudication a96b79c4's remedy
# (kimi-code, cross-vendor, UPHELD on deny 9199c25e): the same quoted heredoc
# body was ALLOWED under `cat` and DENIED under `git commit -F -`, because the
# head basename alone decided. The ruling named the remedy — argv-position-aware
# inertness for stdin consumers — and ruled OUT adding `git` to the head
# allowlist: a head-only list cannot tell `git commit -F -` from
# `git -c core.hooksPath=… commit`. This gate's copy exists for the FP8 shape:
# a commit message written by heredoc that names a GOVERNANCE PATH.
#
# The walk vouches for a SHAPE and fails closed at the first thing it does not
# recognise — the head allowlist's discipline, one level finer:
# 1. Every global option before the subcommand must be unable to introduce an
#    interpreter. `-c` is admitted only for _GIT_INERT_CONFIG_KEYS;
#    `--exec-path`, `--config-env` and anything unlisted stop the walk.
# 2. The subcommand must be a builtin whose stdin is content. Git itself refuses
#    to let an alias shadow a builtin, so `commit`/`tag`/`hash-object` cannot be
#    redefined — while clause 1 keeps a NEW alias off the command line (the
#    `git -c alias.x='!sh' x <<'X'` bypass).
# 3. Something must declare stdin to be that content: `-F -`, `--file=-`,
#    `--stdin`. `git commit -m x <<'X'` is not vouched for — unknown means
#    scanned, the same discipline as an unknown head.
#
# WHAT THIS DOES NOT CLAIM: that the repository is safe — a `commit-msg` hook on
# disk can do anything with the message, and a text matcher cannot see the
# filesystem. It says the command TEXT introduces no interpreter for its own
# stdin, the same standard already applied to `cat > f`.

# `git -c KEY=VALUE` keys that cannot change what git will EXECUTE. Deliberately
# two: inline config is the documented way to hand git new code (`core.hooksPath`,
# `core.pager`, `alias.*`, `core.fsmonitor`, `diff.*.textconv`,
# `credential.helper` …), so the default for an unlisted key is "this might
# introduce an interpreter".
# `git` global options taking no value that cannot re-point it at code.
# `git` global options taking a value (`--git-dir=X` or `--git-dir X`) that
# select WHERE git works, never WHAT it runs. `--exec-path` and `--config-env`
# are absent on purpose: both name code or config the command text itself chose.
def _touches_self(tool_name: str, tool_input: Any) -> Optional[Tuple[str, str, str]]:
    """`(marker, resource, key)` if this call reaches the gate's own code, else None.

    The TRIPLE, not the bare marker (5.2, claude-code notice 1474 §2): the first cut
    returned only the marker and discarded the haystack element that matched, so the
    deny message and the escalation text printed the PATTERN that fired where they
    promised the RESOURCE the call would reach — and because `_SELF_MARKERS` is an
    ordered first-match-wins tuple, the same file spelled two ways produced two
    different "destinations" (1474 §3a). The escalation record is the human's entire
    basis for approving; it must name the act, with the marker as the REASON.

    `resource` is the matched element itself: the path for a PATH-key match (raw or
    realpath'd), the matched text for a TEXT-key match. `key` says which input field
    it came from, so the caller can report a `command`/`new_string`/`content` match
    as PAYLOAD content rather than as a destination — the FP8 case, where the match
    is a document QUOTING the gate. The marker is unchanged and still goes to the
    daemon as `marker`: approvals key on it, and this fix moves the human-facing
    strings, not the keying.
    """
    if not isinstance(tool_input, dict):
        return None
    # PATH keys are resolved against cwd so `../hooks/pre_tool_use.py` is caught.
    # TEXT keys are matched RAW, and that distinction is load-bearing: the first
    # cut resolved every key, and `os.path.realpath()` on a non-path string
    # silently prepends the cwd — `realpath("fn main() {}")` is a real path under
    # wherever the session happens to be standing.
    #
    # Scope it honestly: this is cwd-DEPENDENT, not universal. It fires when the
    # session's cwd sits under a marker directory (the installed hooks dir, or a
    # tree matching `plugins/claude-code/hooks` / `hestia/hooks`), and in the
    # common case — cwd at a project root — it does not fire at all. It was found
    # by the "ordinary work is untouched" case in test_pre_tool_use_self.py, which
    # runs from the hooks directory and so stands exactly where it bites. Latent,
    # never observed in the wild, and cheap to remove.
    #
    # The false positive is not the expensive half. A spurious refusal costs a
    # rephrase; a spurious `gate_self_access` WITNESS costs the alert class its
    # meaning — this event exists to be rare and to be read as evidence about
    # intent, and an event type that fires on ordinary work gets muted by the
    # first operator who sees it, which is exactly the burial the block above
    # gave its own event type to avoid.
    #
    # Nothing is lost by matching `command` text raw: `../hooks/pre_tool_use.py` in a
    # shell command still contains both `hooks/` and a governance filename. What IS
    # given up is a symlinked alias inside a command string — admitted, and no
    # worse than the Bash surface's other known gaps.
    #
    # `content` LEFT the haystack 2026-08-07 (FP8/FP13, kimi-code; claimed from
    # claude-code's notice 1334). For a Write the DESTINATION is already below as
    # `file_path` plus its realpath, and the destination is what decides whether the
    # gate changes — the payload text names no resource this call touches. Scanning it
    # refused every document ABOUT the gate: eight recorded instances of a finding that
    # names the gate being unwriteable anywhere on disk, including drafts of the report
    # itself. Staging gate source at a scratch path and copying it in still refuses —
    # at the `cp`, an unknown head (`cp_onto_gate` in `_SURVIVE`). `new_string` STAYS:
    # Edit is the genuinely hard case (string replacement steers a file whose destination
    # never is the gate), and it keeps the old treatment until that case is earned.
    #
    # `command` got the SAME disease through the Bash door, one day later (claude-code
    # notice 1529 §7): a report about the gate written by heredoc is the FP8 shape
    # with `cat`/`tee` holding the pen. The fix is NOT to drop `command` from the
    # haystack — the destination of a shell write lives IN the command text, so raw
    # matching is the only thing standing over `> PATH` and `tee PATH`. Instead the
    # command is matched against `_blank_inert_heredoc_bodies`: quoted heredoc bodies
    # (the only span that can never name a destination) are blanked before matching;
    # everything else, quoted or not, is matched raw. The entries below are
    # (report_text, match_text, key) so the deny and the escalation still quote what
    # the member actually wrote, not the projection.
    resolved = []
    for key in ("file_path", "path", "notebook_path"):
        v = tool_input.get(key)
        if isinstance(v, str) and v:
            resolved.append((v, v, key))
            try:
                rp = os.path.realpath(v)
                resolved.append((rp, rp, key))
            except (OSError, ValueError):
                pass
    for key in ("command", "new_string"):
        v = tool_input.get(key)
        if isinstance(v, str) and v:
            match = v
            if key == "command":
                proj = _blank_inert_heredoc_bodies(v)
                if proj is not None:
                    match = proj
            resolved.append((v, match, key))
    if not resolved:
        # No target key and no command we recognised — an unknown tool shape. Scan
        # `content` after all: an absent destination must not read as absent risk.
        v = tool_input.get("content")
        if isinstance(v, str) and v:
            resolved.append((v, v, "content"))
    for report, match, key in resolved:
        for marker in _SELF_MARKERS:
            if marker and marker in match:
                return (marker, report, key)
        # Governance files by name, ANYWHERE by default. `_HOOKS_DIR_ONLY` carves out the
        # names common enough that matching them everywhere would fire on ordinary work.
        #
        # THE DEFAULT WAS INVERTED, AND THE INVERSION WAS THE DEFECT. This required a `hooks/`
        # segment before consulting `_GOVERNANCE_FILES` at all — so `plugins/_shared/
        # hestia_gate_core.py` (the policy core for all five harnesses) and the exemption
        # ledger under `tests/` were named in a protected tuple that COULD NOT FIRE against
        # them. Five behavioural probes proved it: relative write, absolute write, Edit, Bash,
        # and the ledger — every one returned None while the membership test stayed green.
        #
        # So: a newly governed name is protected because someone added it, not because they
        # also remembered where it lives. Weakening is now an explicit, visible second edit
        # into `_HOOKS_DIR_ONLY`, and the subset test keeps that list from drifting away from
        # the list it weakens.
        low = match.replace("\\", "/")
        in_hooks = "hooks/" in low or "/hooks" in low
        for fname in _GOVERNANCE_FILES:
            if fname not in low:
                continue
            if fname in _HOOKS_DIR_ONLY and not in_hooks:
                continue
            return (fname, report, key)
    return None


# ---------------------------------------------------------------------------
# THE GATE'S REGISTRATION IS PART OF THE GATE (2026-07-28, follow-on)
# ---------------------------------------------------------------------------
#
# The block above protects the gate's CODE. It was probed against the evasions
# it claims to remove, and the cheapest one walked straight through:
#
#   Write  ~/.claude/settings.json  content='{}'      -> _touches_self: None
#   Bash   mv ~/.claude/settings.json{,.bak}          -> _touches_self: None
#   Edit   ~/.claude/settings.json  (drop the stanza) -> _touches_self: None
#
# Verified by direct call against this file at 99d122f, not by reading it. The
# hook is invoked because `~/.claude/settings.json` names it; that path carries
# no `hooks/` segment and no governance filename, so every marker missed. One
# write of `{}` disarms the PreToolUse gate AND the PostToolUse witness — and
# unlike editing this file it needs no knowledge of what the matcher looks for.
#
# So the protection as shipped was strictly weaker than its own claim to "remove
# the cheap, silent version": the cheapest version was the one it did not see.
# A control that protects its implementation but not its INSTALLATION protects
# nothing — this is `gate installed != gate enforced` pointed at itself.
#
# DECIDABILITY, per tool, because the honest rule differs by what we can see:
#
#   Write / NotebookEdit  we hold the full proposed content. Parse it, compare
#                         the `hooks` stanza to what is on disk, and refuse only
#                         if it would CHANGE. A permissions-only edit passes.
#                         Content we cannot parse is refused: an unreadable
#                         proposal cannot demonstrate it preserves anything.
#   Edit                  we hold old_string/new_string. Refuse if either names
#                         `hooks` or a governance file — that is the only kind of
#                         edit that can reach the stanza.
#   Bash                  undecidable. `mv`, `>`, `jq`, `python -c` and a heredoc
#                         all rewrite the file by different syntax and none of
#                         them has to say `hooks`. Mention of a settings path is
#                         refused outright, same stakes-inversion as above: the
#                         false positive costs one rephrase into Read/Edit, which
#                         ARE decidable, and the false negative costs the gate.
#
# STILL NOT CONTAINMENT, and the gap is now narrower but sharper: settings can
# also be supplied by CLI flag and by env, neither of which passes through any
# hook — by construction, since the hook is not running yet when they are read.
# That surface belongs to whoever installs the agent, not to the agent's gate,
# and saying so is the point: the boundary is where custody changes, and this
# file cannot be both sides of it.
# Governance filenames that are ONLY governed under a `hooks/` path — the deliberate
# weakening, kept small and visible.
#
# These are common enough that matching them anywhere would fire on ordinary work: a repo can
# legitimately hold an unrelated `witness.py`, and `post_tool_use.py` appears in vendor
# examples and documentation. The distinctive names — `hestia_gate_core.py`, the exemption
# ledger — are NOT here, so they are governed wherever they live.
#
# The direction matters more than the contents. A name added to `_GOVERNANCE_FILES` is
# protected by default; weakening it costs a second, deliberate edit into this tuple, and the
# subset test refuses an entry here that is not governed at all. Before, the default ran the
# other way and a governed name silently protected nothing unless someone also happened to put
# it in a hooks directory.
_HOOKS_DIR_ONLY = (
    "pre_tool_use.py",
    "society_pre_tool_use.py",
    "post_tool_use.py",
    "witness.py",
    "law_inject.py",
)

_SETTINGS_MARKERS = (
    ".claude/settings.json",
    ".claude/settings.local.json",
)

# Tokens that mean an edit is reaching the hook registration rather than some
# unrelated key (permissions, env, model) in the same file.
_REGISTRATION_TOKENS = ("hooks",) + _GOVERNANCE_FILES


def _mentions_settings(s: str) -> bool:
    return any(m in s.replace("\\", "/") for m in _SETTINGS_MARKERS)


def _hooks_stanza(text: str) -> Any:
    """The `hooks` value of a settings blob, or None if it has none / is unreadable."""
    try:
        d = json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    return d.get("hooks") if isinstance(d, dict) else None


def _touches_registration(tool_name: str, tool_input: Any) -> Optional[str]:
    """Return a marker if this call could disarm the gate by DE-REGISTERING it."""
    if not isinstance(tool_input, dict):
        return None

    if tool_name == "Bash":
        cmd = tool_input.get("command")
        if isinstance(cmd, str) and _mentions_settings(cmd):
            return "claude settings file (shell — write intent undecidable)"
        return None

    path = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("notebook_path")
    )
    if not isinstance(path, str) or not _mentions_settings(path):
        return None

    # Nothing to disarm if the file registers no hooks. Read failures are treated
    # as "has hooks": a settings file we cannot read is not a settings file we can
    # clear.
    try:
        with open(os.path.realpath(path), "r", encoding="utf-8") as fh:
            current = _hooks_stanza(fh.read())
    except OSError:
        current = None
    except Exception:  # noqa: BLE001 — unreadable is not permission
        current = True
    if not current:
        return None

    if "content" in tool_input:
        content = tool_input.get("content")
        if not isinstance(content, str):
            return "claude settings hooks stanza (opaque write)"
        if _hooks_stanza(content) != current:
            return "claude settings hooks stanza"
        return None

    for key in ("old_string", "new_string"):
        v = tool_input.get(key)
        if isinstance(v, str) and any(t in v for t in _REGISTRATION_TOKENS):
            return "claude settings hooks stanza"
    return None




# ---------------------------------------------------------------------------
# READ IS ALLOWED AND WITNESSED. WRITE IS REFUSED.
# ---------------------------------------------------------------------------
#
# dp, 2026-07-28, agreeing with kimi's third question: read-denial costs verification,
# not just evasion.
#
# The first cut refused BOTH, arguing that reading the gate is how you find its blind
# spots. kimi's counter is the one I could not answer: denying read also denies the
# byte-identity verification it did for #55 and the source-reading behind three of this
# week's reviews. "A witnessed read is evidence; a refused read is a member who cannot
# check its own governance."
#
# It also contradicted this corpus's own posture. We spent two weeks building PUBLISH THE
# LAW so a member can read what governs it — then I argued a member must not read the
# law's implementation. Those pull opposite ways, and I did not notice while writing it.
#
# So reads pass and are WITNESSED, which keeps the reconnaissance signal (a member reading
# gates repeatedly stays visible) without blinding the member to its own law.
#
# CLASSIFICATION FAILS CLOSED. For structured tools the split is exact. For Bash it is not
# decidable in general — `sed -i`, `cp x gate`, `> gate`, `tee gate` all write and nothing
# in the string reliably says so. Bash is therefore a WRITE unless every segment matches a
# small read-only allowlist AND there is no redirection or pipe. Same reasoning as
# policy::shell's inert-head allowlist: widening requires ADDING a name, a reviewable act;
# forgetting one costs a false refusal, never a hole.
# Heads that are read-only ONLY without their writing flags. Kept separate so the guard is
# impossible to lose by someone appending to the set above.
#   find  — `-delete`, `-exec`, `-fprint*` execute or write
#   sort  — `-o FILE` writes
# Admitted UNDER A GRAMMAR, not bare: `sed` — see `_HEAD_GRAMMARS` below. thor refuted an
# earlier attempt to allow `sed -n` by demonstration, not by argument (`sed -n
# '1r /etc/shadow'` reads a file whose path never appears as an argument, invisible to
# every argument-based check); that case is now enforced by code and pinned by a test row
# instead of adjudicated by this comment.
# NOT added, deliberately, and each for a demonstrated reason:
#   awk    — can write via `print > "file"` INSIDE the program text, where the redirection
#            check below cannot see it. Unlike sed's, awk's command set is a full language;
#            its per-head grammar would be "always refuse", which is no grammar at all.
#   xargs  — runs an arbitrary command.
#   python/node/sh/bash — obviously.
# Ambiguity still means write. The point of this change is to stop calling `2>/dev/null` a
# file write, not to make the classifier clever.


# ---------------------------------------------------------------------------
# Per-head argument grammars (kimi-code, 2026-08-06; notices 1218 -> 1226 -> 1241)
# ---------------------------------------------------------------------------
#
# A private deployment probe measured that this classifier
# was head-only: adding `sed` to `_READ_ONLY_HEADS` admits `sed -i 's/a/b/' <gate>` in both
# spellings and laundered through a `cd` segment — an in-place write indistinguishable, by
# head, from the `sed -n` range-print the addition is for. "Add it to the list" is off the
# table; the remedy is to audit the ARGUMENTS of the heads that need it.
#
# Written HERE rather than in `hestia_gate_core.py` for the same reason `attempted_summary`
# was (:802): the core is not wired yet and the cost is being paid now. claude-code
# measured the sharper version (notice 1241): the core has exactly ONE importer, its own
# unit test, while sitting inside `_GOVERNANCE_FILES` — guarded and unused at once, so a
# grammar landed there is committed, tested, guarded and INERT, with every check green
# about it. When the shims land this belongs on `Verdict` and goes with the rest of the
# duplication.
#
# The grammar is the adjudication above made executable. Everything it cannot parse is a
# write; every write-shaped construct the comment named — `-i` in either spelling or
# bundled, `-f`, `w`/`W`, `s///w`, `s///e`, the GNU `e` command, and the hidden-path
# `r`/`R` — is refused by code. It parses a conservative SUBSET of sed: address forms
# (line, `$`, `/re/` with modifiers, GNU `\c re c`, `+N`/`~N`/`FIRST~STEP`), groups, labels,
# text commands, `s` and `y` with their delimiters, and a closed set of single-letter
# commands. A real sed construct outside that subset costs a false refusal, never a hole —
# the same trade the head allowlist makes, one token stream down.
# Single-letter commands that can neither write a file, read a hidden one, nor execute.
# Heads admitted only through their argument grammar. Checked BEFORE `_READ_ONLY_HEADS`
# in the segment walk, so the audit cannot be lost by someone appending the head to the
# bare set — the `_GUARDED_HEADS` principle, one column over.
# Separators that START A NEW COMMAND, and redirect operators. Enumerated rather than
# regex-matched, because the token stream below yields them as discrete tokens.
#
# `&` IS HERE (codex peer-review finding 4, 2026-08-02). It was not, so
# `ls & <mutating command>` was classified read-only from `ls` alone — a protection hole in
# the deployed gate, not classifier noise. codex withheld the peer factor over it.
#
# `"\n"` was DEAD TEXT from the day it was written until 2026-08-10. shlex counts a newline
# as whitespace and never emits one as a token, so this entry matched nothing and no newline
# ever started a new command — every line after the first arrived as ARGUMENTS to the first
# line's head, and `echo checking\ncp evil.py <gate>` was classified from `echo`. It is live
# now because `_command_lines` splits the TEXT first and the caller inserts one `"\n"` token
# per honoured newline. A membership test that cannot fire looks exactly like one that
# passes; this entry is why the fix below is a tokenizer change and not a set edit.
# INPUT redirects create and modify nothing. Split out 2026-08-05, and the split is the
# narrow, provable half of a larger argument kimi-code and I have been having about the FP6
# remedy — "the redirect branch should return the write target". It cannot, for `<`: there
# is no write target, and `tee <gate> < evil.py` traced to THIS branch (not the head branch,
# as my forum table claimed) would hand a resolver `evil.py` as the thing being written.
#
# What that argument settles here, ahead of the resolver: treating `<` as a write is not
# conservative, it is just wrong, and it costs refusals. `grep foo < <gate>` was refused
# while `cat <gate>` was permitted — the same act, decided by spelling.
#
# `<<` and `<<<` take a DELIMITER or a literal, not a filename, so there is nothing to
# resolve there either. `<&` duplicates a descriptor for reading.
#
# The hole this could open, and why it does not: an input redirect that feeds an
# INTERPRETER (`sh < evil.sh`, `python3 < evil.py`) is still refused — by the head
# allowlist, which is where that danger actually lives, since `sh evil.sh` with no redirect
# at all is the same attack and was never caught by the redirect branch. The test asserts
# the migration rather than the verdict: `shell_reads_a_script` pairs `sh < evil.sh`
# (refused) with `cat < evil.sh` (permitted), and only a live head check makes that pair
# possible. Output redirects (`>`, `>>`, `>|`, `>&`, `&>`) are untouched.
# `branch` and `remote` are NOT here (codex finding 1): `git branch -d` deletes a ref and
# `git remote add` rewrites repository config. A read-looking SUBCOMMAND with a mutating
# FLAG is exactly what a name allowlist cannot see.
# Read-BY-DEFAULT subcommands carrying a mutating flag get the _GUARDED_HEADS treatment one
# column over, rather than a bare-set append (claude-code §5.1, notice 1471, escalation
# 10fb8aa5c095c085): `git hash-object` only hashes, but `git hash-object -w` writes the blob
# into the object database. The flag, not the name, decides. Prefix match, same as there, so
# `-w` bundled or separated is caught alike.
# Control-flow keywords, modelled 2026-08-07 (FP12, kimi-code; found by claude-code's
# isolating pair: `for f in a b; do grep -c def <gate>; done` REFUSED while
# `git show <rev>:<gate> | grep -c ""` ALLOWED — same governance path, same read, the
# only difference the loop). The mechanism: `for`/`do`/`done` are in no head list, so
# the segment walk returned False on the keyword and never reached the body head.
#
# The `cd` precedent does NOT transfer, and this is the load-bearing part. `cd` frees
# its own segment only, because the next segment is head-checked on its own head. `do`
# SHARES its segment with the body: admit `do` as a no-op head and
# `for x in a; do rm -rf /; done` is `[do, rm, -rf, /]`, head `do`, ALLOWED — the `rm`
# is never seen. The safe shape is a STRIP, not an admission: remove leading keywords,
# then head-check what remains. The red arm (`do rm`, `then tee`, `done > f`) is in
# `_SURVIVE`; a green on the false-refusal rows alone would certify the hole.
# Characters after which an unquoted `#` OPENS A COMMENT, plus the start of a line. Bash
# begins a comment only at the start of a WORD: `echo a#b; echo two` prints both lines
# (measured against bash 2026-08-10), because `a#b` is one literal word and the `;` after it
# is a real separator.
#
# DELIBERATELY NARROWER THAN BASH: `<`, `>`, `(` and `)` are word boundaries to bash and are
# NOT in this set. Measured 2026-08-10, and the measurement corrected the reason this comment
# first gave. The first draft claimed `echo hi >#f` redirects into a file literally named
# `#f`, so that treating the `#` as a comment would drop a real write target. That is false:
# bash comments there too, and `echo hi >#f`, `cat <#x`, `echo hi|#w` and `(echo hi)#z` all
# behave as comments (the first three become a syntax error, having lost the operand the
# operator needed). So the honest justification is not fidelity, it is DIRECTION:
#
#   a `#` this set fails to recognise is text that is KEPT, tokenised and head-checked, so
#   the miss can only ADD a refusal — never drop a command from the walk. A `#` recognised
#   too eagerly discards the rest of the line UNCLASSIFIED, which is the bypass shape.
#
# And the omission is measured to cost nothing real: a `#` immediately after a redirection
# operator leaves that operator with no operand, so bash rejects the whole command anyway —
# there is no valid command this set refuses and bash accepts. Widening it to match bash
# exactly means dropping MORE text on the security boundary, which is the dangerous
# direction and wants its own claim and its own review, not a quiet edit here.
#
# NOMAD, working the same claim independently on 2026-08-10, wrote `set(" \t\n;&|()<>")` —
# the faithful spelling. Two parsers, one narrower and one more faithful, neither a bypass.
# Whichever survives, this paragraph is the record that the difference was deliberate and
# measured rather than an oversight in the loser.
def _emit_gate_event(event_type: str, marker: str, tool_name: str, *, severity: str) -> bool:
    """Append a governance-surface event. Best effort, short budget.

    One emitter, two callers, DISTINCT event types — `gate_self_access` for a refused
    write, `gate_self_read` for a permitted read. Collapsing them into one type would make
    an alert on the refusal meaningless, since permitted reads are ordinary conduct and
    refused writes are not.

    Written against `McpHttp` as it actually exists. An earlier draft invented a
    `DaemonClient(budget_s=).connect()/.call()` that appears nowhere — the same
    reach-for-a-plausible-API reflex that produced `web4:observationCount` and an invented
    ontology namespace. Checked, then written.
    """
    endpoint = discover_endpoint()
    if endpoint is None:
        return False
    client = McpHttp(endpoint, time.monotonic() + 1.5)
    try:
        if "result" not in client.initialize():
            return False
        client.initialized()
        conn = client.call_tool(
            "hestia_connect",
            {"plugin_id": PLUGIN_ID, "host_agent": HOST_AGENT, "instance_name": "gate-self"},
        )
        sid = None
        res = conn.get("result") if isinstance(conn, dict) else None
        if isinstance(res, dict):
            content = res.get("content") or []
            if content and isinstance(content[0], dict):
                try:
                    sid = json.loads(content[0].get("text") or "{}").get("sessionId")
                except (json.JSONDecodeError, AttributeError):
                    sid = None
        if not sid:
            return False
        out = client.call_tool(
            "hestia_request_witness",
            {
                "session_id": sid,
                "event_type": event_type,
                "event_data": {
                    "plugin_id": PLUGIN_ID,
                    "tool_name": tool_name,
                    "marker": marker,
                    "gate_path": _SELF,
                    "severity": severity,
                },
            },
        )
        return isinstance(out, dict) and "result" in out
    except Exception:  # noqa: BLE001 — the record must never block the decision
        return False


def _witness_self_read(marker: str, tool_name: str) -> bool:
    """Record a PERMITTED read of the governance surface.

    A member may inspect what governs it — that is the publish-the-law posture, and
    refusing it would make a member unable to check its own law. Recording keeps the
    reconnaissance signal: repeated reads of gates remain visible as a pattern.

    A failed witness never blocks the read. Turning a recording failure into a denial
    would make the daemon's health a precondition for reading one's own law."""
    return _emit_gate_event("gate_self_read", marker, tool_name, severity="record")


def _witness_self_access(marker: str, tool_name: str) -> bool:
    """Record a REFUSED write to the governance surface. Escalatable."""
    return _emit_gate_event("gate_self_access", marker, tool_name, severity="escalate")


_PATH_KEYS = ("file_path", "path", "notebook_path")


def _describe_hit(marker: str, resource: Optional[str], key: Optional[str],
                  dest: Optional[str] = None) -> str:
    """The ACT, for the human who rules on the record — not the rule that fired.

    5.2 (claude-code, notice 1474 §2/§3): every human-facing string on this path used
    to describe the gate's internal state — the marker that matched — where it
    promised the caller's act. The marker stays, as the REASON; the resource is what
    the call would actually reach. A match inside TEXT (`command`/`new_string`/
    `content`) is reported as payload content, not a destination — the FP8 case,
    where the "write to the governance surface" was a forum post quoting it.
    """
    if resource is None:
        return f"the governance surface (matched marker {marker!r})"
    if key in _PATH_KEYS:
        return f"{resource} (matched governance marker {marker!r})"
    short = resource if len(resource) <= 200 else resource[:200] + "…"
    if dest:
        return (f"{dest} — its {key} text matched governance marker {marker!r}; the "
                f"match is payload content, not the destination: {short!r}")
    return (f"a command carrying governance marker {marker!r} in its {key or 'text'} "
            f"text: {short!r}")


def deny_self_access(marker: str, tool_name: str, resource: Optional[str] = None,
                     key: Optional[str] = None, dest: Optional[str] = None) -> int:
    """Refuse, loudly, and try to witness it as its own event class.

    Deliberately NOT an ordinary deny: an ordinary deny is a boundary met in the
    course of work. This is an attempt to reach the mechanism that draws the
    boundaries, which is evidence about intent rather than about scope — so it
    gets its own event type so an operator can alert on it separately, and so it
    cannot be lost in the volume of routine refusals.

    Witnessing is BEST EFFORT and the refusal does not depend on it: if the
    daemon cannot be reached, the act is still refused and stderr still says so.
    An unwitnessed refusal is a worse record, never a permission."""
    witnessed = False
    try:
        witnessed = _witness_self_access(marker, tool_name)
    except Exception:  # noqa: BLE001 — never let the record attempt block the refusal
        witnessed = False
    sys.stderr.write(
        f"hestia: deny [gate-self-access] — {tool_name} would WRITE to "
        f"{_describe_hit(marker, resource, key, dest)}. An agent that can edit the "
        f"thing that governs it is not governed. "
        f"Reading it is allowed and witnessed; changing it is not. This refusal is its own "
        f"event class{'' if witnessed else ' (WITNESS FAILED — the refusal stands regardless)'}"
        f" and is escalatable.\n"
        f"If a gate change is genuinely needed, ESCALATE — the write is offered to a human "
        f"for approval and proceeds only if one approves inside the window. Say what you "
        f"need changed and why. Do not work around this by another route: doing so is the "
        f"behaviour this rule exists to make visible.\n"
    )
    debug_log(f"gate-self-access deny: {tool_name} -> {resource or marker} "
              f"(marker {marker}) witnessed={witnessed}")
    return 2


# ---- Stage 2: escalate a governance WRITE to a human ------------------
#
# dp, 2026-07-29: "escalate to human for approval (there are legit times when we are
# actually working on the file), deny on timeout of a couple minutes."
#
# Stage 1 (#97) refuses every write to the governance surface. That is correct and it is
# also too much -- the fleet legitimately edits its gates (#55, #89, #90 in one week). This
# is the channel that un-refuses a legitimate one, with a human across it.

# The claim call must finish well inside the harness's 5s budget for the WHOLE hook, which
# also has to cover the ordinary policy verdict. Sized for a loopback call to a local daemon,
# not for a human.
# (A 5.0 assignment preceded this one from the constant's introduction in 5e15636 (#114)
# and was shadowed by it for the constant's entire life -- 1.5 has always been the value
# in force. Removed 2026-08-05; zero behaviour change.)
ESCALATION_RPC_TIMEOUT_S = 1.5


def _attempted_summary(tool_name: str, tool_input: Any) -> str:
    """WHAT was attempted, in one bounded line, for the human who has to rule on it.

    dp, 2026-08-03, after approving several in a row: *"the issue remains that they don't
    tell me what i'm approving or why. they just say 'no reason'."* The dashboard renders
    `why: (none stated — decide on the payload alone)` and then shows no payload.

    They said no reason because nothing ever sent one. The daemon has accepted the operator's
    two questions on the claim path since 2026-08-02 and this hook never populated them — the
    call sent `plugin_id`, `role`, `tool_name`, `marker` and stopped. So an operator saw
    `Edit` and a directory name and was asked to decide, which is identical whether the
    command was `sed -n '470,520p'` or `rm -rf`. A live channel with nothing in it.

    **THE WIRE ARGUMENTS ARE `reason` AND `detail`.** Not `stated_reason` / `stated_detail` —
    those are only how the daemon STORES and re-emits them, in the `gate_escalation_opened`
    chain entry and in `hestia_gate_pending_escalations`. An earlier draft of this docstring
    named the stored pair, and codex caught it before it could mislead anyone (NOT-SAME review
    of #175). The consequence would have been silent and permanent: hestia tools are
    `additionalProperties: true`, so sending two keys nobody reads SUCCEEDS, the escalation is
    filed, and the operator surface renders "why: (none stated)" forever — the exact bug this
    function exists to fix, reintroduced by the comment describing the fix.

    kimi's and codex's gates already send an attempted summary — it is why kimi's denials
    render with the full command and this member's do not. **This is the drift the shared
    core exists to end, and it drifted in the direction that costs the operator.** Written
    here rather than only in `hestia_gate_core.py` because the core is not wired yet and
    the cost is being paid now; when the shims land it belongs on `Verdict` and this copy
    should go with the rest of the duplication.

    BOUNDED AND SELF-CENSORING. Truncated hard, because an escalation body is read by a
    human under interruption. Redacted on credential-shaped tokens, because a refusal is not
    a licence to copy a payload into the witness chain: an egress deny is ABOUT a secret
    path, so verbatim echo would reproduce the protected thing inside a record that is
    deliberately easier to read than the file was.
    """
    if not isinstance(tool_input, dict):
        return f"{tool_name} (no inspectable input)"
    raw = tool_input.get("command")
    if not isinstance(raw, str):
        for k in ("file_path", "path", "notebook_path"):
            v = tool_input.get(k)
            if isinstance(v, str):
                # THE PATH FALLBACK IS REDACTED TOO (kimi #185, finding 2). It returned the
                # path bare. Lower risk than a command — paths, not contents — but a path can
                # BE the secret, and an inconsistent rule is one a reader cannot rely on.
                # Confirmed leaking before this existed.
                if _credential_shaped(v):
                    return (f"{tool_name} [REDACTED — the target is a credential-shaped path; "
                            f"{len(v)} chars withheld rather than copied into the record]")
                return f"{tool_name} -> {v[-140:]}"
        return f"{tool_name} (no command or path in input)"
    s = " ".join(raw.split())
    if _credential_shaped(s):
        return (f"{tool_name} [REDACTED — names a credential-shaped token; "
                f"{len(s)} chars withheld rather than copied into the record]")
    return f"{tool_name}: {s[:220]}" + (" …" if len(s) > 220 else "")


#: Shapes that carry secrets in a real shell command — not merely filenames that suggest one.
#:
#: kimi NOT-SAME review of #185, finding 2. The first list held key-material filenames and a
#: few English nouns, and a red test confirmed SEVEN shapes passing through verbatim into the
#: signed, hash-chained record: `Authorization:`/`Bearer` headers, `--password=` flags,
#: `PASSWORD=` assignments, ssh config paths, PEM `BEGIN` blocks, bare `bearer`, and the
#: unredacted path fallback.
#:
#: WHY THIS IS AN EGRESS SURFACE AT ALL, which I did not see when I wrote it: before this
#: function, nothing from a denied command was sent anywhere. It is the change that STARTS
#: copying command text into the witness chain — so it introduces the leak it must then
#: prevent. And a witnessed record is deliberately easier to read, and harder to expunge, than
#: the file the deny was protecting. Redaction here is not hygiene; it is the reason the
#: feature is safe to have.
#:
#: Substring matching on a lowered string, deliberately: a regex over attacker-shaped command
#: text is its own hazard, and the cost of a false positive is one unhelpfully-vague escalation
#: while the cost of a false negative is a secret in the permanent record. Asymmetric, so this
#: errs loud. `test_ordinary_commands_are_not_redacted` bounds the over-matching.
_CREDENTIAL_SHAPES = (
    # key material and its filenames
    "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa", ".pem", ".p12", ".pfx",
    "begin rsa private key", "begin openssh private key", "begin private key",
    "begin ec private key", "begin certificate",
    # ssh / gpg config trees — a path can be the secret
    "/.ssh", ".ssh/", "/.gnupg", ".netrc", ".pgpass", ".htpasswd",
    # http auth
    "authorization:", "authorization ", "bearer ", "x-api-key", "proxy-authorization",
    # generic secret words, and the flag/env spellings that actually appear
    "password", "passwd", "passphrase", "credential", "secret", "api_key", "apikey",
    "access_key", "access-key", "private_key", "private-key", "client_secret",
    "token=", "_token", "auth_token", "session_token", "refresh_token",
    ".env", "dotenv",
)


def _credential_shaped(text: str) -> bool:
    """Does this text plausibly carry a secret? Substring, lowered, no regex.

    One helper for both the command and the path branch so the two cannot drift — the
    inconsistency kimi flagged was exactly that they already had."""
    low = text.lower()
    return any(shape in low for shape in _CREDENTIAL_SHAPES)


def _connect_session(client: "McpHttp", host_session_id: Optional[str]) -> Optional[str]:
    """A live daemon session id for the escalation claim, or None — never raises.

    WHO is asking, provable. The claim path accepts an optional `session_id`
    (handler.rs `tool_gate_escalation_claim`): a session that resolves turns
    `asker_basis` from "asserted" into "session", and a proven asker is what lets
    the invitation actually WAKE the peers it records — until now every
    claim-path escalation recorded peers and woke nobody (kimi-code census over
    the full 114,819-entry chain: `asker_basis` on 0 of 362, claude-code notice
    1530's remainder).

    The daemon's own note said to thread the session `ask_daemon` "already
    holds" — but self-protection runs BEFORE `ask_daemon` in `main`, by design
    ("before the daemon, and never conditional on it"), so at this point in the
    invocation no session exists. This is therefore a real connect, one extra
    loopback round trip inside the escalation budget — not a thread-through.

    `plugin_id` is `_escalation_plugin_id()`, the same value the claim asserts:
    the daemon refuses a claim whose plugin_id disagrees with the session's
    (asker mismatch is the forgery the binding exists to catch), so the two must
    be one value. `host_session_id` keeps connect idempotent across hook
    invocations — one Claude session, one hestia session — matching ask_daemon.

    None means "proceed unproven": session_id is optional on the claim and an
    asserted escalation is paperwork, while a missing one is silence. Failure
    here must degrade the RECORD, never the channel.
    """
    try:
        args: dict[str, Any] = {
            "plugin_id": _escalation_plugin_id(),
            "plugin_version": HOOK_VERSION,
            "host_agent": HOST_AGENT,
            "requested_role": "citizen",
            "protocol_version": PROTOCOL_VERSION,
        }
        role = os.environ.get("HESTIA_ROLE")
        if role:
            args["role"] = role
        if host_session_id:
            args["host_session_id"] = host_session_id
        conn = unwrap_tool_result(client.call_tool("hestia_connect", args))
        sid = conn.get("sessionId")
        return sid if isinstance(sid, str) and sid else None
    except Exception:  # noqa: BLE001 — see the docstring: degrade the record, not the channel
        return None


def request_self_write(marker: str, tool_name: str, attempted: str = "",
                       resource: Optional[str] = None, key: Optional[str] = None,
                       dest: Optional[str] = None,
                       host_session_id: Optional[str] = None) -> Tuple[str, str]:
    """One round trip. Returns (verdict, detail); only 'approved' permits the write.

    `marker` is what the daemon keys the approval on and is NOT the human-facing
    destination: `resource`/`key`/`dest` describe the attempted ACT for the record
    (5.2, notice 1474 §2) — see `_describe_hit`.

    THIS FUNCTION NEVER WAITS, and that is the whole design. The harness kills this hook at 5
    seconds, and a killed hook yields neither `exit 2` nor a JSON deny -- Claude Code reads
    that as a non-blocking error and runs the tool anyway. An in-hook wait for a human
    therefore fails OPEN: the write executes unapproved, with an escalation entry on the chain
    making it look like the safe path ran. That is strictly worse than refusing outright.

    So: ask once. Either a human has already approved this exact (member, governance file) and
    the approval is spent here, or the write is refused now and a human decides out of band.
    The member then RE-ISSUES the write, and that second attempt claims the approval.

    Every failure -- unreachable, malformed, an old daemon that has never heard of this tool --
    is a refusal. A daemon that cannot answer must not be a way to get a governance write
    through.
    """
    try:
        endpoint = discover_endpoint() or DEFAULT_ENDPOINT
        client = McpHttp(endpoint, deadline=time.monotonic() + ESCALATION_RPC_TIMEOUT_S)
        client.initialize()
        client.initialized()
        claim_args: dict[str, Any] = {
            "plugin_id": _escalation_plugin_id(),
            "role": os.environ.get("HESTIA_ROLE", ""),
            "tool_name": tool_name,
            "marker": marker,
            # WHAT was attempted. The daemon has accepted these two since 2026-08-02 and
            # this call never sent them, which is why every escalation rendered
            # "why: (none stated — decide on the payload alone)" and then displayed no
            # payload. dp, 2026-08-03: "they don't tell me what i'm approving or why."
            #
            # `reason` carries the ATTEMPTED ACT, not a rationale, and the distinction is
            # deliberate: an auto-opened escalation HAS no stated why, because the member
            # did not choose to escalate — the gate opened it on their behalf after a deny.
            # Presenting the act as though it were a rationale would be worse than silence,
            # because it would look like the member had explained itself. A member that
            # wants to state a why calls `hestia_gate_escalation_open` and supplies one.
            "reason": attempted or f"{tool_name} -> {resource or marker}",
            "detail": (
                "Auto-opened by the gate on a refused write; the member stated no rationale "
                "because it did not choose to escalate. Approving authorises this one write."
            ),
        }
        # WHO is asking, provable — see `_connect_session`. Absent on any failure:
        # the claim accepts its absence and records `asker_basis: "asserted"`.
        sid = _connect_session(client, host_session_id)
        if sid:
            claim_args["session_id"] = sid
        r = client.call_tool("hestia_gate_escalation_claim", claim_args)
    except Exception as e:  # noqa: BLE001
        return "unreachable", f"no answer from the daemon ({type(e).__name__}) -- refused"

    # BOTH flags, and the daemon owns both. Two places deciding what "approved" means is how
    # they come to disagree, so the hook re-derives nothing.
    if _dig(r, "claimed") is True and _dig(r, "permits_write") is True:
        who = _dig(r, "decided_by") or "a human"
        via = _dig(r, "decided_via") or "unknown-channel"
        return "approved", f"claimed an approval from {who} via {via} (single use, now spent)"

    esc_id = _dig(r, "escalation_id")
    if not esc_id:
        # An old daemon answers {} to a tool it does not know. It must not be able to permit a
        # write by failing to understand the question -- but it also cannot open an escalation,
        # so say which of the two this is rather than implying paperwork exists.
        why = _dig(r, "error") or "this daemon has no escalation channel (is it upgraded?)"
        return "no-channel", f"refused, and NO escalation was opened -- {why}"

    how = _dig(r, "how_to_decide") or f"hestia gate approve {esc_id}"
    retry_secs = _dig(r, "retry_within_secs")
    sys.stderr.write(
        f"hestia: ESCALATION {esc_id} opened — {tool_name} would WRITE to "
        f"{_describe_hit(marker, resource, key, dest)}.\n"
        f"  THE WRITE IS REFUSED. Nothing is waiting: a human decides out of band.\n"
        f"  To allow:  {how}\n"
        f"  Then RE-ISSUE the same write"
        + (f" within {retry_secs}s" if retry_secs else "")
        + " and it will claim the approval (single use).\n"
    )
    sys.stderr.flush()
    return "escalated", f"escalation {esc_id} opened; write refused pending a human decision"


def _escalation_plugin_id() -> str:
    """Who to record as asking. Caller-asserted (HST-005) and named as such.

    The env vars stay the override -- a mesh fire sets HESTIA_MESH_PLUGIN so the escalation
    names the member being fired, which may differ from this file's own.

    The fallback is PLUGIN_ID, not a literal 'unattributed' (#244). The 'unattributed'
    fallback was defended by #108's rationale -- guessing one member's id under another's
    name -- but PLUGIN_ID is not a guess: it is the module constant this same file already
    asserts as its identity at hestia_connect. Worse than a provenance gap, the literal
    collapsed claim()'s (plugin_id, marker) join key to a constant: every escalation from
    an interactive session (which exports HESTIA_ROLE but no plugin id) was filed under the
    SAME 'unattributed', so an operator's approval was claimable by any interactive session
    resolving to the same marker -- and, once the claim path threads a session through, the
    proven session ('claude-code') disagrees with the asserted 'unattributed' and every
    such approval is REFUSED as an asker mismatch. One literal, both failure directions.
    """
    for var in ("HESTIA_MESH_PLUGIN", "HESTIA_PLUGIN_ID"):
        v = os.environ.get(var, "").strip()
        if v:
            return v
    return PLUGIN_ID


def _dig(result: Any, key: str, _depth: int = 0) -> Any:
    """Find `key` anywhere in an MCP tool result, whatever envelope it arrived in.

    The first version enumerated the shapes it expected -- bare, `result{}`,
    `content[0].text` -- and the real answer is `result.result.content[0].text`, one level
    deeper than any branch covered. Every approval then read as "malformed" and the
    mechanism denied legitimate writes while looking impeccably fail-closed. A refusal that
    happens for the wrong reason is not a working guard; it is a broken reader wearing one.

    So: search, don't enumerate. Depth-bounded because an unbounded walk over
    attacker-shaped JSON is its own problem, and JSON text is parsed wherever it appears
    because that is where the daemon actually puts the payload.
    """
    if _depth > 6:
        return None
    if isinstance(result, dict):
        if key in result:
            return result[key]
        for v in result.values():
            found = _dig(v, key, _depth + 1)
            if found is not None:
                return found
    elif isinstance(result, list):
        for item in result:
            found = _dig(item, key, _depth + 1)
            if found is not None:
                return found
    elif isinstance(result, str):
        # A JSON blob carried as text -- content[0].text is exactly this.
        t = result.strip()
        if t.startswith("{") or t.startswith("["):
            try:
                return _dig(json.loads(t), key, _depth + 1)
            except (ValueError, TypeError):
                return None
    return None


# ---- Shared transport (Sprint E: ONE society-safety transport) --------
# The private MCP client, SSE parser, wait-protocol poller and target extractor that lived
# here were the claude-only copy of what the shared gate mechanism module (plugins/_shared)
# now provides for EVERY harness (PRD gate-consolidation §6.E). Two names survive as thin
# delegates — `McpHttp` and `unwrap_tool_result` — because the self-protection / escalation
# call sites (Sprint B's region: _emit_gate_event, _connect_session, request_self_write)
# still construct a raw client; they resolve to the shared implementation, so there is
# exactly ONE wire client left to fix. Behaviour note: the shared client REFUSES to start a
# request after its deadline (raises TimeoutError, which every call site already catches)
# where the old private copy clamped the timeout to 50ms and tried anyway.

def _load_mechanism():
    """Import the shared gate mechanism module from plugins/_shared (repo and installed
    layouts both place it two levels up from this hooks dir). Raises on failure — callers
    keep their own fail posture (ask_daemon returns None → fail-closed / legacy below)."""
    return _load_shared_module("hestia_gate_mechanism")


def McpHttp(endpoint: str, deadline: float):
    """Factory delegate: constructs the SHARED wire client (callable under the old class
    name so Sprint B's self-protection region stacks on this diff without edits)."""
    return _load_mechanism()._McpHttp(endpoint, deadline)


def unwrap_tool_result(rpc_response: dict[str, Any]) -> dict[str, Any]:
    return _load_mechanism()._unwrap_tool_result(rpc_response)


# ---- Daemon path ------------------------------------------------------

def ask_daemon(
    tool_name: str,
    tool_input: Any,
    tool_use_id: str,
    host_session_id: Optional[str] = None,
):
    """Obtain the daemon's verdict IN-PROCESS via the shared mechanism (Sprint E).

    The mechanism runs the exact connect → begin_action(target) → query_policy wait-protocol
    this function used to hand-roll (it was EXTRACTED from this file's tested client, PR #371),
    including endpoint discovery, the TOTAL_BUDGET_MS deadline, HESTIA_ROLE, the
    host_session_id connect-idempotency key, and the begin_action `target` write.

    Returns the mechanism's SafetyVerdict when the daemon DECIDED (verdict.kind in
    allow|warn|deny, verdict.action_id set for the outcome cache), or None when no verdict was
    obtained — the caller then applies fail-closed / legacy-fallback exactly as before, with
    `_LAST_FAILURE` carrying the mechanism's cause classification (timeout vs refused vs
    unknown — the same URLError triage the private client did).

    POSTURE CHANGE, deliberate (mechanism contract, GPT review of #371): an unknown `status`
    or unrecognized `decision` vocabulary is NO VERDICT here, where the old private client
    defaulted unknowns to allow/decided. On a fail-open engine that default un-governed the
    member; now a garbled wire shape lands in the same fail-closed/legacy branch as a down
    daemon."""
    try:
        mech = _load_mechanism()
    except Exception as e:  # noqa: BLE001 — a missing mechanism is a plane-E infra failure
        _set_last_failure("unknown")
        _record_plane_e("unknown", f"shared mechanism unavailable: {type(e).__name__}", tool_name)
        debug_log(f"shared mechanism unavailable: {type(e).__name__}: {e}")
        return None
    verdict = mech.query_society_safety(
        {"tool_name": tool_name, "tool_input": tool_input},
        plugin_id=PLUGIN_ID,
        host_agent=HOST_AGENT,
        plugin_version=HOOK_VERSION,
        host_agent_version="claude-code",
        host_session_id=host_session_id,
    )
    if not verdict.decided:
        # The mechanism already recorded the plane-E row (record_gate_unavailable) —
        # main() passes record=False to deny_no_verdict so the row is not double-counted.
        _set_last_failure(verdict.cause if verdict.cause in ("timeout", "refused") else "unknown")
        debug_log(f"no verdict from daemon path: {verdict.message}")
        return None
    return verdict


def cache_action(tool_use_id: str, action_id: str, tool_name: str) -> None:
    try:
        ACTIONS_DIR.mkdir(parents=True, exist_ok=True)
        (ACTIONS_DIR / f"{tool_use_id}.json").write_text(
            json.dumps({"action_id": action_id, "tool_name": tool_name, "ts": time.time()})
        )
    except OSError as e:
        debug_log(f"action cache failed: {e}")


def _record_plane_e(cause: str, detail: str, tool_name: str = "unknown") -> None:
    """Persist an infrastructure refusal without scoring it as member conduct."""
    try:
        record_gate_unavailable = _load_shared_module(
            "hestia_gate_core").record_gate_unavailable
        record_gate_unavailable(PLUGIN_ID, tool_name, cause, detail, home=str(DEFAULT_HESTIA_HOME))
    except Exception:
        pass


def deny_no_verdict(why: str, *, cause: str = "unknown", tool_name: str = "unknown",
                    record: bool = True) -> int:
    """Fail-closed refusal: no daemon verdict → the tool does not run.

    Composed locally (the daemon is exactly what we couldn't reach), so this
    carries its own static steering: without it, an agent facing a down daemon
    reads every deny as a tool error and retry-loops — the highest-risk case
    for the loop the daemon-side guidance exists to prevent.

    SAY WHAT IS KNOWN, NOT A GUESSED CAUSE (2026-07-28).
    ----------------------------------------------------
    This message used to assert "The policy daemon is unavailable" on every
    fail-closed path. The gate cannot know that. All it knows is that it did not
    get a verdict inside its own budget, and the two causes want OPPOSITE
    responses from the member:

      timeout   the daemon is alive but starved (usually another member is
                saturating the box). Correct response: back off and retry.
      refused   nothing is listening. Correct response: stop and escalate.

    Measured on 2026-07-28: a peer was parked for 4+ minutes, escalating to the
    operator on this message's instruction, while the daemon had been up
    continuously for eight hours (`NRestarts=0`) under a 15-minute load average
    of 7.39 caused by another member's test runs. The member did exactly what it
    was told; the message was wrong. codex's gate has carried a comment
    describing this same confusion — "no policy verdict (daemon path failed)
    while the daemon was up the whole time" — and nothing acted on it.

    A false cause is worse than no cause: it spends a session on the wrong
    remedy and makes the next member trust the next message less."""
    remedy = {
        "timeout": (
            "The daemon did not answer within the gate's budget — it is most likely "
            "ALIVE BUT LOADED, not down. Wait and retry with backoff; if it persists "
            "across several minutes, then report to your operator."
        ),
        "refused": (
            "Nothing is listening on the daemon endpoint, so no action can be "
            "approved. Report this to your operator and wait — retrying will not help."
        ),
    }.get(
        cause,
        "The gate could not obtain a verdict and cannot tell whether the daemon is "
        "down or merely slow. Retry once with backoff; if it repeats, report to your "
        "operator.",
    )
    sys.stderr.write(
        f"hestia: no verdict [fail-closed] — the policy daemon did not return a decision "
        f"({why}; cause={cause}). This is NOT a policy boundary and NOT a tool failure — the "
        f"referee is unreachable, so the gate fails closed for safety. {remedy}\n"
    )
    if record:  # False when the daemon path already recorded this row (Sprint E: the shared
        # mechanism's no-verdict composer writes record_gate_unavailable itself; recording
        # again here would double-count plane-E rows and skew the unavailability denominator)
        _record_plane_e(cause, why, tool_name)
    debug_log(f"fail-closed deny: {why} cause={cause}")
    return 2


def _fallback_self_protection(tool_name: str, tool_input: Any,
                              host_session_id: Optional[str]) -> Optional[int]:
    """Tier-2 degraded mode (the ratified deny-writes-allow-reads posture, per-shim
    tighten-only): the shared governance-closure module failed to import, so the
    pre-Sprint-B local matcher decides — MOVED here from main() verbatim, not deleted.
    Returns 2 to deny, or None to continue to the ordinary policy path."""
    _self_hit = _touches_self(tool_name, tool_input)
    if _self_hit is None:
        _reg = _touches_registration(tool_name, tool_input)
        if _reg is not None:
            # Registration markers are already descriptive strings; the resource is
            # the settings path — or, for Bash, the command (write intent there is
            # undecidable, and the marker already says so).
            _r = tool_input.get("command") if tool_name == "Bash" else (
                tool_input.get("file_path") or tool_input.get("path")
                or tool_input.get("notebook_path"))
            _self_hit = (_reg, _r if isinstance(_r, str) and _r else _reg,
                         "command" if tool_name == "Bash" else "file_path")
    if _self_hit:
        _self_marker, _self_resource, _self_key = _self_hit
        # For a TEXT-key match the call's stated destination (if any) is what the
        # write actually reaches — the report names it and calls the match payload.
        _self_dest = None
        if _self_key not in _PATH_KEYS and isinstance(tool_input, dict):
            for _k in _PATH_KEYS:
                _v = tool_input.get(_k)
                if isinstance(_v, str) and _v:
                    _self_dest = _v
                    break
        if _is_read_only(tool_name, tool_input):
            # Allowed — and RECORDED. A member may inspect what governs it; repeated
            # reads of the governance surface remain visible as a pattern.
            _witness_self_read(_self_marker, tool_name)
            debug_log(f"gate-self-read (allowed, witnessed): {tool_name} -> {_self_marker}")
        else:
            verdict, detail = request_self_write(
                _self_marker, tool_name, _attempted_summary(tool_name, tool_input),
                resource=_self_resource, key=_self_key, dest=_self_dest,
                host_session_id=host_session_id,
            )
            if verdict != "approved":
                debug_log(f"gate-self-write {verdict}: {detail}")
                return deny_self_access(_self_marker, tool_name, resource=_self_resource,
                                        key=_self_key, dest=_self_dest)
            # APPROVED -- the self-protection is lifted for THIS call only, and the call
            # continues to the ordinary policy check below. Approving a gate edit is not
            # approving everything else the same command might do.
            sys.stderr.write(f"hestia: gate write APPROVED -- {detail}\n")
            debug_log(f"gate-self-write approved: {detail}")
    return None


# ---- Main flow --------------------------------------------------------

def emit_decision(verdict) -> int:
    """Translate the shared mechanism's SafetyVerdict into a Claude Code hook exit code
    (with side-effect stderr).

    Rendering keys on `verdict.kind` (Sprint E mechanism extension) — the message text is
    composed by the mechanism with the exact wording this function used to build: enforced
    deny prefers the daemon's `guidance` steering text (deny-as-redirect) and falls back to
    "hestia: deny [rule] — reason"; warns render "hestia: warn [rule] — reason"; an
    audit-only deny arrives as kind="warn" whose message already says
    "would-deny (audit-only)", so the distinct messaging survives the transport swap."""
    if verdict.kind == "deny":
        sys.stderr.write((verdict.message or "hestia: deny — refused by policy") + "\n")
        return 2
    if verdict.kind == "warn" and verdict.message:
        sys.stderr.write(verdict.message + "\n")
        return 0
    return 0


def main() -> int:
    # FIRST, before stdin is read and before any side effect: no shared authority, no tool.
    # This dominates every other path in the hook, which is what makes the refusal a
    # property of the decision rather than of where the failure happened to be noticed.
    if _CLASSIFIER_UNAVAILABLE is not None:
        sys.stderr.write(
            "hestia: deny [no-shared-authority] - the shared shell classifier could not be "
            f"imported ({_CLASSIFIER_UNAVAILABLE}). This seat carries no local copy by "
            "design, so it cannot classify this command and will not guess. Check that "
            "$HESTIA_HOME/shared is populated and current.\n")
        return 2

    raw = sys.stdin.read()
    if not raw.strip():
        # Empty stdin = the harness sent no event. Not caller-controllable from
        # inside a session, but under strict fail-closed semantics "no event" is
        # still "no verdict" → no tool (CBP relay-verify micro-seam, 2026-07-07).
        return deny_no_verdict("empty hook event")
    try:
        event = json.loads(raw)
    except json.JSONDecodeError as e:
        return deny_no_verdict(f"unparseable hook event: {e}")

    tool_name = event.get("tool_name") or "?"
    # Claude Code's own stable session id — the real per-session audit grain.
    host_session_id = event.get("session_id")
    tool_use_id = event.get("tool_use_id") or event.get("session_id") or "no-id"
    tool_input = event.get("tool_input") or {}

    # SELF-PROTECTION FIRST — before the daemon, and never conditional on it.
    # If this required a verdict, "stop the daemon, then edit the gate" would be
    # the same evasion one layer down.
    # Sprint B: the shared governance-closure module CLASSIFIES; this shim renders.
    # "none" falls through to ordinary policy; "read" is allowed + witnessed
    # (gate_self_read); "write" runs the existing escalate/claim flow and denies
    # unapproved — the rule id in the record comes from the module result.
    if _closure_classify is not None:
        _cv = _closure_classify(tool_name, tool_input, cwd=event.get("cwd"))
        if _cv.classification == "read":
            # Allowed — and RECORDED. A member may inspect what governs it; repeated
            # reads of the governance surface remain visible as a pattern.
            _witness_self_read(_cv.marker, tool_name)
            debug_log(f"gate-self-read (allowed, witnessed): {tool_name} -> {_cv.marker}")
        elif _cv.classification == "write":
            verdict, detail = request_self_write(
                _cv.marker or _cv.rule, tool_name,
                _attempted_summary(tool_name, tool_input),
                resource=_cv.resource, key=_cv.rule,
                host_session_id=host_session_id,
            )
            if verdict != "approved":
                debug_log(f"gate-self-write {verdict}: {detail}")
                return deny_self_access(_cv.marker or _cv.rule, tool_name,
                                        resource=_cv.resource, key=_cv.rule)
            # APPROVED -- the self-protection is lifted for THIS call only, and the call
            # continues to the ordinary policy check below. Approving a gate edit is not
            # approving everything else the same command might do.
            sys.stderr.write(f"hestia: gate write APPROVED -- {detail}\n")
            debug_log(f"gate-self-write approved: {detail}")
    else:
        # Tier-2 degraded mode: the shared classifier failed to import — the pre-B
        # local matcher decides, moved (not deleted) into _fallback_self_protection.
        _rc = _fallback_self_protection(tool_name, tool_input, host_session_id)
        if _rc is not None:
            return _rc

    # ── GATE 1 — MRH SCOPE, decided by the SHARED CORE. The Sprint F cutover, for the seat
    # that wrote the core and then never adopted it.
    #
    # dp, 2026-08-16: "law has to be applied uniformly to ALL. that is the only way the law is
    # trusted." Measured the same day, from the installed gates and the daemon's own chain:
    #
    #     seat          evaluate()   scope resolution   denies / acts
    #     claude-code       0              0              0 / 266     <- this file
    #     kimi             13              4              8 / 126
    #     codex            16              4              2 /  12
    #
    # This gate was the LARGEST of the three and enforced the LEAST. It never called the common
    # law at all, so for 266 acts this seat was judged by a rule the other seats were bound by
    # and it was not — while adjudicating their appeals and writing rulings about their conduct.
    # That is not a coverage gap. It is the author of the law being outside it.
    #
    # WHY IT COULD NOT LAND UNTIL NOW, stated so the delay does not read as an excuse: cutting
    # over while the standing store was empty would have left this seat at scope=() and bricked
    # it mid-session, because `launch_cwd_repo` returns nothing on a mesh wake. The society
    # floor (2026-08-16, 28 paths, identical for every member) removed that precondition — this
    # seat now inherits the same floor as everyone else and needs no per-member grant to work.
    # The exemption outlived its justification by exactly as long as it took to build the floor.
    #
    # FAIL-CLOSED, deliberately, including on import failure. An earlier draft let an
    # unimportable core fall through to the daemon path "to be safe during the cutover" — which
    # is the exemption surviving on the error path, the same privilege wearing an apology. If
    # the core cannot be reached this seat degrades like every other: deny writes, allow reads.
    try:
        _core = _load_shared_module("hestia_gate_core")
    except Exception as _e:  # noqa: BLE001
        sys.stderr.write(
            f"hestia: deny [gate.core_unavailable] — the shared law core could not be imported "
            f"({type(_e).__name__}). This seat does not fall back to an unscoped path: that is "
            f"the exemption this cutover exists to end.\n")
        return 2

    _CORE_PROFILE = _core.HarnessProfile(
        member_id=PLUGIN_ID,
        identity_path=os.path.join(os.path.expanduser("~/.claude"), "hestia-instance",
                                   "identity.json"),
        # THE MEMBER'S OWN HOME. Omitted in the first draft of this cutover, and the omission
        # would have denied this seat its own config and memory directory — `path_in_scope`
        # falls through to "absolute, outside the workspace" for anything under ~/.claude.
        # `/tmp` is already exempt in the core, so the scratchpad was never at risk; this is
        # the other half.
        #
        # It does NOT weaken gate protection: self-protection runs BEFORE this gate, so a write
        # aimed at the hook files under here is classified and refused by the closure
        # classifier and never reaches scope. Home means "this member's own state", not "this
        # member's own law". And the core resolves each marker through expanduser AND realpath
        # and compares at the separator, so a sibling like `~/.claude-evil/` cannot ride in on
        # a prefix match.
        home_markers=("~/.claude",),
        workspace_env="HESTIA_WORKSPACE",
    )
    # THE SHARED DISCOVERY, never a baked path. The first draft of this cutover fell back to
    # a literal absolute workspace root — one maintainer's mount, compiled into a public
    # gate — and `tools/public_boundary.py` failed it on exactly that line ("runtime
    # mechanism bakes a mounted-host path"). It then failed a SECOND time when the fix's own
    # comment quoted the offending path in order to explain itself: the rule is about leaking
    # a real installation layout, and prose leaks it as well as code does. The control caught
    # the author of the code it protects against, twice, which is the useful direction.
    #
    # `detect_workspace` is the one resolver every harness shares: HESTIA_WORKSPACE if the
    # installer set it, else a `.hestia-workspace` marker walked up from cwd, else cwd — and
    # its docstring states the reason a fallback must never be a guessed layout: "A public
    # gate cannot infer an operator's repository names or home layout." A baked default does
    # not just leak a path, it silently WIDENS scope on any machine whose layout happens to
    # match, and stays inert-but-wrong on every machine that does not.
    _WS = _core.detect_workspace(_CORE_PROFILE)

    # The event, normalised the way the core expects. Paths and command come from the same
    # tool_input the closure classifier already read — one extraction, not a second opinion.
    _paths = [tool_input[k] for k in ("file_path", "path", "notebook_path")
              if isinstance(tool_input.get(k), str) and tool_input.get(k).strip()]
    _cmd = tool_input.get("command") if isinstance(tool_input.get("command"), str) else None
    _ev = _core.NormalizedEvent(tool=tool_name, paths=_paths, command=_cmd,
                                cwd=event.get("cwd"), raw=event)

    _snapshot = None
    try:
        from hestia_gate_mechanism import fetch_policy_snapshot
        _snapshot = fetch_policy_snapshot(PLUGIN_ID, host_agent=HOST_AGENT,
                                          host_session_id=host_session_id)
    except Exception:  # noqa: BLE001 — an unimportable mechanism IS an unreachable daemon
        _snapshot = None

    if _snapshot is not None:
        # The live snapshot always carries `in_scope`, so resolution can never fall through to
        # a member-writable replica on this path (Sprint D deleted that authority source). As
        # of 2026-08-16 `in_scope` also carries the SOCIETY FLOOR, which is why this seat needs
        # no grant of its own to keep working.
        _policy = _core.resolve_agent_policy(_CORE_PROFILE,
                                             vault_reader=lambda _m: _snapshot)
        _v = _core.evaluate(_ev, _CORE_PROFILE, _WS, policy=_policy)
        if _v.blocks:
            sys.stderr.write(f"hestia: deny [{_v.rule}] — {_v.reason}\n")
            debug_log(f"scope deny: {_v.rule} {tool_name}")
            return 2
    else:
        # The ratified degraded mode, computed by the core rather than invented here:
        # deny writes, allow reads. Same posture kimi and codex have had since Sprint F.
        _v = _core.degraded_verdict(_ev, _CORE_PROFILE)
        if _v.blocks:
            sys.stderr.write(f"hestia: deny [{_v.rule}] — {_v.reason}\n")
            debug_log(f"degraded scope deny: {_v.rule} {tool_name}")
            return 2

    # Try the daemon first — IN-PROCESS via the shared mechanism (Sprint E, one transport).
    verdict = ask_daemon(tool_name, tool_input, tool_use_id, host_session_id)
    if verdict is not None:
        if verdict.action_id:
            cache_action(tool_use_id, verdict.action_id, tool_name)
        debug_log(f"daemon decided: {tool_name} → {verdict.kind}")
        return emit_decision(verdict)

    # Daemon unavailable or didn't settle. Under the fail-closed profile the
    # daemon is the law: no verdict → no tool (GPT review HST-004; governed /
    # unattended roles must not degrade to fail-open heuristics silently).
    return deny_no_verdict(
        f"daemon path failed for {tool_name}",
        cause=_LAST_FAILURE,
        tool_name=tool_name,
        record=False,  # the daemon path already wrote the plane-E row (see ask_daemon)
    )


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        sys.exit(deny_no_verdict(f"hook crashed: {type(e).__name__}: {e}"))
