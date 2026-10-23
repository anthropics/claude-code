#!/usr/bin/env python3
"""
Security Guidance Plugin for Claude Code

A hooks-based plugin that guides Claude toward writing more secure code. It runs as
UserPromptSubmit, PostToolUse, and Stop hooks via the Claude Code plugin system.

## Architecture

The plugin has two layers:

1. **Pattern-based rules (PostToolUse, every edit)**: Fast regex checks that run on
   every file write. Detects common vulnerabilities like hardcoded secrets, SQL injection,
   command injection, path traversal, and insecure session configs. Injects brief warnings
   via additionalContext.

2. **Stop hook (final review)**: When Claude finishes, uses `git diff` against a
   baseline SHA (captured at UserPromptSubmit) to get only the code changed during the
   session. Runs two Haiku analyses on the diff:
   a) Concrete vulnerability scan with severity ratings
   b) Areas-of-concern analysis identifying categories to investigate
   Exits with code 2 to force Claude to continue and address findings.

## How the git baseline works

On each UserPromptSubmit, the plugin runs `git stash create` to get a SHA representing
the current working tree state (HEAD + any uncommitted changes). This SHA is saved to
the session state file. When the Stop hook fires, it runs `git diff <baseline_sha>` to
get only the changes made since that snapshot. After analysis, the baseline is updated
so the next Stop hook iteration only sees new changes.

This means:
- Only code Claude actually changed is reviewed (not pre-existing code)
- Mid-session commits are handled correctly (diff is against the snapshot, not HEAD)
- Each turn only reviews new changes (baseline updates after each stop hook)

## Configuration

Kill switches:
- SECURITY_GUIDANCE_DISABLE: "1" to fully disable the plugin (alias for ENABLE_SECURITY_REMINDER=0)
- ENABLE_SECURITY_REMINDER: "0" to fully disable the plugin (legacy name)

Per-feature toggles (all default enabled; set to "0" to disable):
- ENABLE_PATTERN_RULES: PostToolUse regex warnings on Edit/Write
- ENABLE_CODE_SECURITY_REVIEW: Stop-hook git-diff LLM review
- ENABLE_COMMIT_REVIEW: PostToolUse[Bash] commit security review

Other:
- SECURITY_REVIEW_MODEL: Model for LLM review (default: claude-opus-4-7)
- ANTHROPIC_API_KEY: Required for LLM-based reviews
- ANTHROPIC_AUTH_TOKEN: Alternative to API key — OAuth access token sent as Bearer auth.
  Claude Code passes this automatically for OAuth-authenticated users.
"""

try:
    import fcntl
except ImportError:
    fcntl = None
import contextlib
import glob
import json
import os
import random
import re
import subprocess
import sys
import threading
import urllib.request
from datetime import datetime
from enum import IntEnum
from typing import Optional, Tuple, Dict, Any, List

# review_api is the importable surface for the agentic-review prompts,
# schemas, and pure filters.  External callers (e.g. agentic review harnesses)
# import review_api directly so they run the same eval-covered prompts
# without going through the CC hook protocol.  The underscored names below
# alias into it so this script stays the single CC-hook entrypoint.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import review_api  # noqa: E402
from _base import (  # noqa: E402,F401
    DEBUG_LOG_FILE, DEBUG_LOG_MAX_BYTES, debug_log,
    PROVENANCE_TAG, PROVENANCE_BANNER,
    _read_plugin_version_int, _PV, _USAGE, _USAGE_LOCK,
    _PRICE_PER_MTOK, _PRICE_DEFAULT, _record_usage, _usage_metrics,
)
import extensibility  # noqa: E402
from patterns import (  # noqa: E402,F401
    _JS_EXTS, _PY_EXTS, _DOC_EXTS,
    _UNSAFE_DESERIALIZATION_REMINDER, _UNSAFE_YAML_LOAD_REMINDER,
    _UNSAFE_TORCH_LOAD_REMINDER, SECURITY_PATTERNS, RuleId,
    _RULE_NAME_TO_ID, rule_names_to_mask,
)
from session_state import (  # noqa: E402,F401
    _state_key, get_state_file, get_lock_file, cleanup_old_state_files,
    load_state, save_state, with_locked_state,
)
from gitutil import (  # noqa: E402,F401
    GIT_CMD,
    _git_rev_parse_head, _find_git_index, _diff_pathspec, _temp_index,
    _git_toplevel, _git_dir, _git_rev_list_range, _git_diff_range,
    _detect_main_branch, _git_reflog_recent_commits, _git_name_only,
    _git_status_porcelain, _is_ancestor, get_git_diff,
    SOURCE_CODE_EXTENSIONS, SOURCE_CODE_BASENAMES,
    NON_SOURCE_EXTENSIONLESS_BASENAMES, SKIP_PATH_PATTERNS,
    SKIP_FILE_SUFFIXES, _SECURITY_RISK_PATH_TOKENS,
    _LOW_PRIORITY_SUFFIXES, _LOW_PRIORITY_PATH_TOKENS,
    _prioritize_diff_files, _is_reviewable_source,
    extract_file_paths_from_diff, parse_diff_into_files,
    filter_preexisting_from_diff,
)
from diffstate import (  # noqa: E402,F401
    STOP_LOOP_STATE_TTL_SEC, PREVIOUS_FINDINGS_TTL_SEC,
    save_baseline_sha, load_baseline_sha, record_touched_path,
    consume_stop_state, restore_unreviewed_stop_state,
    get_baseline_file_content, capture_git_baseline,
    _REVIEWED_SHAS_BASENAME, _REVIEWED_SHAS_CAP,
    _reviewed_shas_path, _load_reviewed_shas, _append_reviewed_shas,
    UNTRACKED_BASELINE_CAP, _list_untracked, compute_v2_review_set,
)
import llm  # noqa: E402  module ref for reassignable globals (_last_call_claude_http_error etc.)
from llm import (  # noqa: E402,F401
    ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, HAS_API_CREDENTIALS,
    SECURITY_REVIEW_MODEL, CLAUDE_CODE_SYSTEM_PROMPT,
    _last_call_claude_http_error,
    ensure_anthropic_reachable,
    _last_review_truncated_bytes, _auth_prefer_token,
    DIFF_PER_FILE_BYTES, DIFF_TOTAL_BYTES, _AGENTIC_INVESTIGATE_SYSTEM,
    _FINDINGS_SCHEMA, _SURVIVED_SCHEMA, _REWAKE_SUMMARY_BUDGET,
    _cap_files_for_prompt, _build_auth_headers, _call_claude, _call_claude_dual_or,
    _format_vulns_guidance, _format_vulns_summary, _finding_keys, _dedup_against_state,
    analyze_code_security, _agentic_commit_review_enabled, agentic_review,
    analyze_security_concerns,
)

# LLM-based code security review (enabled by default when API key is available)
# Empty string or unset = enabled (default); "0" = disabled
_enable_code_review_str = os.environ.get("ENABLE_CODE_SECURITY_REVIEW", "1")
ENABLE_CODE_SECURITY_REVIEW = _enable_code_review_str != "0"

# Pattern-based rules (enabled by default; set to "0" to use only LLM review)
# Empty string or unset = enabled (default); "0" = disabled
_enable_pattern_str = os.environ.get("ENABLE_PATTERN_RULES", "1")
ENABLE_PATTERN_RULES = _enable_pattern_str != "0"

# Per-feature kill switches. Each defaults to enabled. Set to "0" to disable
# just that one feature without touching the rest. Motivated by feedback that
# autonomous-agent setups sometimes need to disable specific injection points
# (e.g. the PreToolUse[Task] prompt append, which can read as prompt injection
# to hardened subagents) while keeping the rest of the plugin active. See
# README for a full description of each feature.
# Commit review also honors legacy SECURITY_GUIDANCE_COMMIT_REVIEW=off; see
# is_commit_review_enabled().
ENABLE_COMMIT_REVIEW = os.environ.get("ENABLE_COMMIT_REVIEW", "1") != "0"
# Stop-hook git-diff review only — does NOT gate the commit/push reviews.
# Lets multi-agent / shared-worktree deployments keep the commit reviewer
# (anchored to a fixed SHA from the worker's own `git commit` stdout) while
# turning off the Stop-hook diff (anchored on baseline_sha…HEAD, which a
# sibling agent in the same worktree can move under us). The pre-existing
# ENABLE_CODE_SECURITY_REVIEW gate is shared between Stop and commit/push
# and stays for backwards compat as the all-LLM-review master switch.
ENABLE_STOP_REVIEW = os.environ.get("ENABLE_STOP_REVIEW", "1") != "0"

# Master kill switch. Either SECURITY_GUIDANCE_DISABLE=1 or
# ENABLE_SECURITY_REMINDER=0 disables the plugin entirely. Kept as two names
# because ENABLE_SECURITY_REMINDER predates the rename and some users already
# have it baked into shell rc files; SECURITY_GUIDANCE_DISABLE reads correctly
# as a kill switch (no double-negative).
_disable_str = os.environ.get("SECURITY_GUIDANCE_DISABLE", "").strip().lower()
SECURITY_GUIDANCE_DISABLED = (
    _disable_str in ("1", "true", "yes", "on")
    or os.environ.get("ENABLE_SECURITY_REMINDER", "1") == "0"
)

# Maximum number of times the stop hook can fire per user turn.
# Allows iterative fixing: Claude stops → review → fix → stop → review again.
# Set to 0 for unlimited (like the old plugin). Default 3 for iterative fixing.
MAX_STOP_HOOK_FIRINGS = int(os.environ.get("MAX_STOP_HOOK_FIRINGS", "3"))

# Cap on source files sent to the LLM reviewer per Stop fire. A stale baseline
# meeting an ungitignored build directory can produce an enormous spurious
# diff; unbounded diffs burn tokens and risk 400 on context length.
MAX_DIFF_FILES = int(os.environ.get("MAX_DIFF_FILES", "30"))

# Appended to all exit(2) guidance so the asyncRewake auto-turn doesn't
# cause the model to abandon the user's original request.
CONTINUATION_SUFFIX = (
    "\n\nAfter addressing or acknowledging this finding, continue with the "
    "user's original request or continue waiting for their reply — this "
    "review is supplementary feedback, not a replacement for your previous "
    "response."
)

def emit_metrics(metrics, rewake_summary=None):
    """
    Write a SyncHookJSONOutput line to stdout for Claude Code to pick up.
    For asyncRewake (Stop) hooks, CC scans stdout for the first {-prefixed line
    that validates as SyncHookJSONOutput and emits the hook metrics event.
    For sync (PostToolUse) hooks, the metrics key in the normal JSON response
    is picked up directly.

    Constraints: keys ^[a-z][a-z0-9_]{0,39}$, values bool|finite-number,
    20-key cap (was 10 in older CC versions).

    `pv` and the tok_*/cost_usd usage block are PREPENDED so they survive any
    future overflow — CC keeps only the first 20 keys, so insertion order
    decides what drops. The old `len(metrics) < 10` guard was load-bearing for
    the same reason but stale: once `rate_count` was added to every
    commit-review emit, the with-vulns dict hit 10 keys, `pv` was skipped, and
    findings metrics landed without a plugin version attached, breaking
    per-version breakdowns.

    `rewake_summary` (asyncRewake only): per-run override of the static
    rewakeSummary in hooks.json, shown to the user in the terminal as the
    task-notification one-liner. Must be in the same JSON line as the metrics
    because CC stops scanning stdout after the first {-prefixed line.
    """
    head = {}
    if _PV and "pv" not in metrics:
        head["pv"] = _PV
    head.update(_usage_metrics())
    if head:
        metrics = {**head, **metrics}
    out = {"metrics": metrics}
    if rewake_summary:
        out["rewakeSummary"] = rewake_summary
    print(json.dumps(out), flush=True)

# =====================================================================
# State management
# =====================================================================

#
# Low-level state-file plumbing (_state_key, get_state_file,
# get_lock_file, cleanup_old_state_files, load_state, save_state,
# with_locked_state) moved to session_state.py and re-exported above.

def atomic_check_and_mark_warning(session_id, warning_key):
    """
    Atomically check if a warning has been shown and mark it as shown if not.
    Returns True if this is the first time seeing this warning (should show it),
    False if it was already shown (should skip it).
    """
    def _check(state):
        warnings = state["shown_warnings"]
        if warning_key in warnings:
            return False
        warnings.append(warning_key)
        return True

    result = with_locked_state(session_id, _check)
    return result if result is not None else True

def atomic_check_counter(session_id, counter_key, max_count):
    """
    Atomically check if a counter has reached its limit and increment if not.
    Returns True if the counter is below max_count (should proceed),
    False if it has reached or exceeded max_count (should skip).
    """
    def _check(state):
        counters = state.get("counters", {})
        current = counters.get(counter_key, 0)
        if current >= max_count:
            return False
        counters[counter_key] = current + 1
        state["counters"] = counters
        return True

    result = with_locked_state(session_id, _check)
    return result if result is not None else True

def atomic_check_rate_limit(session_id, key, max_per_window, window_s):
    """Rolling-window rate limit: allow at most `max_per_window` calls per
    `window_s` seconds, per (session_id, key).

    Returns (allowed: bool, count_in_window: int). count_in_window is the
    post-decision count (i.e., includes this call if allowed) so callers can
    emit it directly as a telemetry gauge.

    Replaces session-lifetime `atomic_check_counter` for commit-review and
    push-sweep. Telemetry showed a small but persistent share of sessions hit
    the lifetime cap, and those were multi-day persistent sessions that then
    lost coverage for many subsequent commits — not burst abusers. A rolling
    hour keeps the same cost ceiling for any 1h window while letting long
    sessions regain coverage.

    State key: rate_limits: {"<key>": [ts, ts, ...]}. Timestamps are pruned
    on every call so the list is bounded by max_per_window; no migration
    needed from the old `counters` dict — different key.
    """
    import time as _time
    now = _time.time()
    cutoff = now - window_s

    def _check(state):
        buckets = state.setdefault("rate_limits", {})
        ts_list = buckets.get(key, [])
        # Prune; tolerate non-numeric junk from a corrupted state file.
        ts_list = [t for t in ts_list if isinstance(t, (int, float)) and t > cutoff]
        if len(ts_list) >= max_per_window:
            buckets[key] = ts_list
            return False, len(ts_list)
        ts_list.append(now)
        buckets[key] = ts_list
        return True, len(ts_list)

    result = with_locked_state(session_id, _check)
    # State unavailable → fail-open (same posture as atomic_check_counter).
    return result if result is not None else (True, 0)

# =====================================================================
# Warning outcome tracking
#
# Records each pattern warning as pending when it fires. At Stop, sweep
# all pending entries: re-read each file, re-check patterns, and emit a
# fixed-vs-unresolved tally. No per-edit work — pending is recorded only
# when a pattern matches (rare), and the sweep runs once at session end.
#
# State key: pending_warnings: {"<file>:<rule>": true}
# =====================================================================

def record_pending_warnings(session_id, file_path, rule_names):
    """Mark file:rule pairs as pending for the Stop-hook outcome sweep."""
    def _record(state):
        pending = state.get("pending_warnings")
        if not isinstance(pending, dict):
            pending = {}
            state["pending_warnings"] = pending
        for rule in rule_names:
            pending[f"{file_path}:{rule}"] = True
    with_locked_state(session_id, _record)

def sweep_pending_warnings(session_id):
    """
    Stop-hook final sweep. Re-read every file in pending_warnings, re-check
    patterns, and return (fixed, unresolved, unresolved_mask). Clears state.
    A file that's been deleted counts as fixed — the dangerous code is gone.
    Never raises — this is telemetry and must not break the Stop hook.
    """
    def _sweep(state):
        try:
            pending = state.get("pending_warnings")
            if not isinstance(pending, dict) or not pending:
                return 0, 0, 0

            by_file = {}
            for key in pending:
                if not isinstance(key, str) or ":" not in key:
                    continue
                fp, _, rule = key.rpartition(":")
                by_file.setdefault(fp, set()).add(rule)

            unresolved = []
            fixed = 0
            for fp, rules in by_file.items():
                try:
                    with open(fp, "r", errors="replace") as f:
                        still_matching = {r for r, _ in check_patterns(fp, f.read())}
                except (OSError, IOError):
                    still_matching = set()
                for rule in rules:
                    if rule in still_matching:
                        unresolved.append(rule)
                    else:
                        fixed += 1

            state["pending_warnings"] = {}
            # Filter to known rules so a renamed/removed rule in old state
            # doesn't KeyError rule_names_to_mask.
            known = [r for r in unresolved if r in _RULE_NAME_TO_ID]
            return fixed, len(unresolved), rule_names_to_mask(known)
        except Exception as e:
            debug_log(f"sweep_pending_warnings failed: {e}")
            return 0, 0, 0

    result = with_locked_state(session_id, _sweep)
    return result if result is not None else (0, 0, 0)

# =====================================================================
# Git baseline management
# =====================================================================

# =====================================================================
# Pattern matching
# =====================================================================

def check_patterns(file_path, content):
    """Check if file path or content matches any security patterns. Returns ALL matches."""
    normalized_path = file_path.lstrip("/")
    matches = []

    for pattern in list(SECURITY_PATTERNS) + extensibility.user_patterns():
        # path_filter is a gate: when present, the rule only applies to
        # matching paths. Distinct from path_check, which is itself a
        # positive match condition (e.g. .github/workflows/).
        if "path_filter" in pattern:
            try:
                if not pattern["path_filter"](normalized_path):
                    continue
            except Exception:
                continue

        matched = False

        if "path_check" in pattern:
            try:
                if pattern["path_check"](normalized_path):
                    matched = True
            except Exception:
                pass

        if not matched and "substrings" in pattern and content:
            for substring in pattern["substrings"]:
                if substring in content:
                    matched = True
                    break

        if not matched and "regex" in pattern and content:
            try:
                if re.search(pattern["regex"], content):
                    matched = True
            except Exception:
                pass

        if matched:
            matches.append((pattern["ruleName"], pattern["reminder"]))

    return matches

def extract_content_from_input(tool_name, tool_input):
    """Extract content to check from tool input based on tool type."""
    if tool_name == "Write":
        return tool_input.get("content", "")
    elif tool_name == "Edit":
        return tool_input.get("new_string", "")
    elif tool_name == "MultiEdit":
        edits = tool_input.get("edits", [])
        if edits:
            return " ".join(edit.get("new_string", "") for edit in edits)
        return ""
    return ""

# =====================================================================
# Hook handlers
# =====================================================================

def handle_user_prompt_submit(input_data):
    """
    Handle UserPromptSubmit — capture git baseline SHA.
    Called on every user prompt. Updates the baseline so the stop hook
    only reviews changes made since the last prompt.

    Does NOT reset touched_paths/fire_count/previous_findings — those are
    consumed by Stop (consume_stop_state) and time-expired respectively.
    UPS racing the asyncRewake Stop hook caused a meaningful share of reviews
    to be lost when the wipe landed before Stop's state read.

    """
    cwd = input_data.get("cwd", "")
    if not cwd:
        debug_log("UPS: no cwd, skipping baseline capture")
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    # stash-create and ls-files both walk the worktree (~2-5s each in a very
    # large repo). Run them concurrently so UPS latency stays ≈ max(both).
    import concurrent.futures as _cf
    with _cf.ThreadPoolExecutor(max_workers=2) as _ex:
        _f_sha = _ex.submit(capture_git_baseline, cwd)
        _f_ut = _ex.submit(_list_untracked, cwd)
        sha = _f_sha.result()
        # Always capture the untracked snapshot. `git stash create` returns
        # empty when there are no TRACKED changes, but pre-existing untracked
        # files still need to be excluded from the next Stop's review_set —
        # otherwise an untracked-only working tree gets every untracked file
        # reviewed on every turn until something tracked is dirtied.
        untracked_now = _f_ut.result() or {}
    head = _git_rev_parse_head(cwd)

    # If the previous turn's Stop hook never ran (user interrupt, follow-up
    # during work, tool-reject, model crash, maxTurns, PostToolUse block…),
    # touched_paths is still populated because consume_stop_state is the only
    # consumer and it runs under the state lock. Overwriting baseline_sha now
    # would re-baseline *past* those unreviewed edits, making them permanently
    # invisible to the next Stop. Preserve the old baseline so the next Stop
    # diffs the aborted turn's edits plus the new turn's edits together.
    preserved = {"value": False}

    def _save(state):
        # Only preserve if there's actually an old baseline to preserve.
        # First UPS of a session can have touched_paths if PostToolUse
        # somehow ran first (print mode, odd harnesses) — in that case
        # we still need to capture a baseline.
        if state.get("touched_paths") and state.get("baseline_sha"):
            preserved["value"] = True
            return
        if sha:
            state["baseline_sha"] = sha
            state["head_at_capture"] = head
        # untracked_at_baseline is independent of whether the stash produced
        # a SHA — write it unconditionally so compute_v2_review_set's
        # preexisting-untracked exclusion works in untracked-only trees.
        state["untracked_at_baseline"] = untracked_now
    with_locked_state(session_id, _save)

    if preserved["value"]:
        debug_log(
            "UPS: preserving prior baseline — previous Stop hook never "
            "consumed touched_paths (likely user interrupt / aborted turn)"
        )
    elif sha:
        debug_log(f"Captured git baseline: {sha[:12]}")
    else:
        debug_log("Failed to capture git baseline (not a git repo?)")

    sys.exit(0)

def _resolve_amend_pre_sha(repo_root, expected_post_sha=None):
    """For a `git commit --amend` we just ran, return the pre-amend SHA via
    reflog, or None if it can't be safely determined.

    expected_post_sha: the post-amend SHA the caller parsed from bash stdout
    (or reflog). If provided, HEAD@{0} of `repo_root` must match it (prefix
    compare — bash stdout SHAs are abbreviated, reflog %H is 40 chars) before
    we trust the reflog-derived pre-amend SHA. This guards against the
    cross-repo case (`cd ../other && git commit --amend && cd -`) where
    `repo_root` happens to have its own recent amend that's unrelated to
    the bash command we're reviewing.

    We require HEAD@{0}'s reflog subject to start with `commit (amend)` —
    otherwise our `--amend` regex matched something that didn't actually
    perform an amend (e.g., `git commit --amend --dry-run`, aliased commands,
    aborted amends), and HEAD@{1} would be the wrong commit. Also requires
    HEAD@{1} to NOT itself be an amend, since back-to-back amends would have
    HEAD@{1} as the previous-amend's post state — the original commit we
    want to compare against is then HEAD@{2}, but at that point we're
    reaching and fall back to a full review.

    Bytes + decode('utf-8', errors='replace'): reflog subjects embed commit
    subjects, which git stores as raw bytes (commit messages may be latin-1
    / cp1252 / etc.). text=True would raise UnicodeDecodeError (a
    ValueError, not OSError) on non-UTF8 bytes and crash the hook.
    """
    if not repo_root:
        return None
    try:
        r = subprocess.run(
            [*GIT_CMD, "log", "-g", "-2", "--format=%H|%gs", "HEAD"],
            cwd=repo_root, capture_output=True, timeout=5,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None
    if r.returncode != 0:
        return None
    stdout_text = r.stdout.decode("utf-8", errors="replace")
    lines = [ln for ln in stdout_text.splitlines() if "|" in ln]
    if len(lines) < 2:
        return None
    head0_sha, _, head0_subj = lines[0].partition("|")
    head1_sha, _, head1_subj = lines[1].partition("|")
    if not head0_subj.startswith("commit (amend)"):
        return None
    if head1_subj.startswith("commit (amend)"):
        return None
    # Cross-repo guard: the post-amend SHA the caller is about to review must
    # match HEAD@{0} of repo_root. Otherwise the bash command was likely run
    # in a different repo than repo_root, and the reflog we just read is
    # unrelated. Prefix-compare: expected_post_sha is typically the 7-char
    # abbreviated SHA captured from bash stdout by _COMMIT_SHA_RE (git's
    # default core.abbrev floor), while head0_sha is the full 40-char %H —
    # strict equality would always fail and silently disable the delta path.
    if expected_post_sha and not head0_sha.startswith(expected_post_sha):
        return None
    return head1_sha or None

# git-only signals that corroborate a real commit object — NOT emitted by
# pre-commit / lint-staged / husky hook output, which can contain bracketed
# labels like `[pre-commit abc1234]` that otherwise look like a commit line.
_COMMIT_DIFFSTAT_PATTERNS = [
    re.compile(r'\b\d+ files? changed'),
    re.compile(r'^ create mode ', re.MULTILINE),
    re.compile(r'^ delete mode ', re.MULTILINE),
    re.compile(r'^ rename ', re.MULTILINE),
]

# Capture-group form of the [branch sha] pattern. Mirrors Claude Code's own
# commit-id parsing, but tolerates spaces before the
# sha (covers `[detached HEAD abc1234]`). 7–40 hex chars: git's abbrev floor
# through full sha; the abbrev resolves fine with `git show`. Anchored to
# line-start so a `[hex]` in the commit subject (`[main abc] Revert [e38]`)
# or trailing hook output isn't picked up and fed to `git show`.
_COMMIT_SHA_RE = re.compile(r'^\[[^\]]*?\b([0-9a-f]{7,40})\]', re.MULTILINE)

# Regex matching `git commit` commands. Mirrors Claude Code's own commit
# detection — it does NOT tolerate `git -c k=v commit` global options, which
# keeps this hook aligned with CC's commit attribution on what counts as a
# commit.
_GIT_COMMIT_RE = re.compile(r'\bgit\s+commit(?:\s|$)')
_GIT_AMEND_RE = re.compile(r'\s--amend\b')

# Rolling-window cap on LLM commit-review calls. See atomic_check_rate_limit
# docstring for the rationale that motivated the switch from a lifetime cap.
# `MAX_COMMIT_REVIEWS_PER_SESSION` is read for backward-compat with users who
# tuned it; the value is reinterpreted as per-hour.
MAX_COMMIT_REVIEWS_PER_HOUR = int(
    os.environ.get("MAX_COMMIT_REVIEWS_PER_HOUR")
    or os.environ.get("MAX_COMMIT_REVIEWS_PER_SESSION", "20")
)
COMMIT_REVIEW_RATE_WINDOW_S = int(
    os.environ.get("COMMIT_REVIEW_RATE_WINDOW_S", "3600")
)

# ─── push-sweep ─────────────────────────────────────────────────────────────
#
# Mirrors Claude Code's own push-command matching — tolerates `git -C <p>` /
# `git -c k=v` global options. The hooks.json `Bash(git push:*)` matcher
# (subcommand prefix) doesn't, but those forms are rare in practice
# and the python only ever runs after CC's matcher fired, so this regex is a
# defensive re-gate, not a widening — `git -C path push` won't reach python
# unless chained with a plain `git push` in the same compound command.
#
# `gh pr create` is intentionally NOT a separate hooks.json matcher: gh runs
# `git push` as a child process, which CC's matcher doesn't observe (it sees
# only the top-level `gh pr create` argv). A separate `Bash(gh pr create:*)`
# entry would buy minimal extra coverage (sessions that push only via gh) at
# the cost of an extra python spawn on every `... && gh pr create` compound
# (the common case). Those sessions are caught on their next standalone `git push`.
_GIT_PUSH_RE = re.compile(
    r'\bgit(?:\s+-[cC]\s+\S+|\s+--\S+=\S+)*\s+push\b'
)

# `git push` stdout: "abc1234..def5678  branch -> branch" (or `+abc..def` on
# force, `* [new branch]` on first push). The left sha is where the remote
# was BEFORE this push — exactly the base we need. Captures (old, new,
# local-ref) so the handler can verify the pushed ref == HEAD before
# diffing — `git push origin other` while on a different branch would
# otherwise diff the wrong range.
_PUSH_RANGE_RE = re.compile(
    r'^\s*\+?\s*([0-9a-f]{7,40})\.\.\.?([0-9a-f]{7,40})\s+(\S+)\s+->\s+\S+',
    re.MULTILINE,
)

MAX_PUSH_SWEEP_FILES = int(os.environ.get("SG_PUSH_SWEEP_MAX_FILES", "30"))
MAX_PUSH_SWEEP_RANGE = int(os.environ.get("SG_PUSH_SWEEP_MAX_RANGE", "50"))
PUSH_SWEEP_REPORT_CAP = int(os.environ.get("SG_PUSH_SWEEP_REPORT_CAP", "3"))

def _claim_bash_hook_once(input_data):
    """De-dupe across hooks.json `if` matchers firing for the same Bash call.

    `git commit -m x && git push` matches both `Bash(git commit:*)` and
    `Bash(git push:*)` `if` configs → CC spawns this script twice with the
    SAME `tool_use_id`. The first spawn atomically creates a
    sentinel under `.git/`; subsequent spawns see it and exit early. Avoids
    redundant LLM calls (and the redundant asyncRewake) on compound commands.

    Returns True if this spawn won the claim (or no de-dupe is possible),
    False if another spawn already claimed it.

    Sentinel is per-clone (`.git/sg-hook-once-<tool_use_id>`), not /tmp,
    so concurrent CC sessions in *different* repos don't collide. Stale
    sentinels (>5min) are GC'd opportunistically.
    """
    tuid = input_data.get("tool_use_id")
    cwd = input_data.get("cwd")
    if not tuid or not cwd:
        return True
    gd = _git_dir(_git_toplevel(cwd) or cwd)
    if not gd:
        return True
    # GC: best-effort sweep of stale sentinels so they don't accumulate.
    import time as _time
    now = _time.time()
    try:
        for name in os.listdir(gd):
            if name.startswith("sg-hook-once-"):
                p = os.path.join(gd, name)
                try:
                    if now - os.path.getmtime(p) > 300:
                        os.unlink(p)
                except OSError:
                    pass
    except OSError:
        pass
    # Sanitize tuid into a filesystem-safe basename — defensive, the value is
    # CC-generated (toolu_<b64ish>), but it ends up in a path.
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", tuid)[:80]
    sentinel = os.path.join(gd, f"sg-hook-once-{safe}")
    try:
        fd = os.open(sentinel, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
        return True
    except FileExistsError:
        return False
    except OSError:
        # Can't write sentinel (read-only fs, perms) — proceed rather than
        # silently dropping the review.
        return True

def is_push_sweep_enabled():
    """Gate for the push-sweep PostToolUse[Bash] hook.

    Enabled by default. ENABLE_COMMIT_REVIEW=0 remains the unconditional
    kill switch (push-sweep reuses the same review pipeline and budget).
    SG_PUSH_SWEEP is the per-user override (=1/on or =0/off) checked
    next so users can opt out.
    """
    if not ENABLE_COMMIT_REVIEW:
        return False
    v = os.environ.get("SG_PUSH_SWEEP", "").strip().lower()
    if v in ("1", "on"):
        return True
    if v in ("0", "off"):
        return False
    return True

PUSH_SWEEP_ENABLED = is_push_sweep_enabled()

def _compute_push_sweep_base(prev_upstream, push_range, reviewed):
    """Advance the diff base past the contiguous reviewed prefix.

    Spec: review `git diff B..HEAD` where `B` is the newest commit such that
    `prev_upstream..B` is entirely in `reviewed`. Returns (B, unreviewed_tail).
    `B == None` means the whole range is reviewed (caller should skip).
    `push_range` must be oldest→newest.

    Examples (✓=reviewed, ✗=not):
      [✓1, ✗2, ✓3]  → B=1, tail=[2,3]   (cannot trim suffix; Read is at HEAD)
      [✓1, ✓2, ✓3]  → B=None            (all reviewed → skip)
      [✗1, ✓2, ✗3]  → B=prev_upstream, tail=[1,2,3]
      []            → B=None
    """
    i = 0
    while i < len(push_range) and push_range[i] in reviewed:
        i += 1
    if i == len(push_range):
        return None, []
    base = push_range[i - 1] if i > 0 else prev_upstream
    return base, push_range[i:]

def _push_section(bash_output):
    """Return the slice of `bash_output` that contains the push's range lines.

    `_PUSH_RANGE_RE` is not push-specific — `git fetch` and `git pull` print
    range lines (`abc..def  branch -> origin/branch`) in the same format. On
    chained calls the Bash tool returns combined stdout+stderr, so a naive
    `_PUSH_RANGE_RE.finditer(bash_output)` matches both sections and a
    fetch+push compound trips the multi-ref skip.

    `git push` prints `To <remote>` immediately before its range lines;
    `git fetch`/`git pull` prints `From <remote>` before theirs. The slice
    is symmetric: start at the LAST `To <remote>` header (strips fetch output
    that ran *before* the push, e.g. `git fetch && git push`), and end at
    the next `From <remote>` after that (strips fetch output that ran
    *after* the push, e.g. `git push && git fetch`).

    If no `To ` header is present (push failed before connecting, output
    suppressed by `-q`) the full buffer is returned and the caller's
    other guards handle it.
    """
    if not bash_output:
        return ""
    # Match line-anchored "To " — look for "\nTo " or "To " at start-of-string.
    idx = bash_output.rfind("\nTo ")
    if idx >= 0:
        section = bash_output[idx:]
    elif bash_output.startswith("To "):
        section = bash_output
    else:
        return bash_output
    # Strip a trailing fetch/pull `From <remote>` block (push && fetch /
    # push && pull, or any wrapper that re-syncs after the push).
    end = section.find("\nFrom ")
    if end >= 0:
        section = section[:end]
    return section

def _detect_prev_upstream(repo_root, bash_output):
    """Where the remote was BEFORE this push.

    Preference order:
      1. Parse `abc..def` from push stdout — authoritative, exact.
      2. `<branch>@{u}@{1}` — the remote-tracking ref's reflog position before
         this push moved it. PostToolUse runs after `git push` completes, so
         `@{u}` is already updated and `@{u}@{1}` is the prior value.
      3. merge-base with the detected main branch — first push of a new
         branch (`* [new branch]` in output, no upstream reflog yet).
    Returns a resolvable ref/sha or None.
    """
    m = _PUSH_RANGE_RE.search(_push_section(bash_output or ""))
    if m:
        return m.group(1)
    # @{u}@{1} — only meaningful if an upstream is configured.
    for ref in ("@{u}@{1}", "@{push}@{1}"):
        try:
            r = subprocess.run(
                [*GIT_CMD, "rev-parse", "--verify", "-q", ref],
                cwd=repo_root, capture_output=True, text=True, timeout=5,
            )
            if r.returncode == 0 and r.stdout.strip():
                return r.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass
    main = _detect_main_branch(repo_root)
    if main:
        try:
            r = subprocess.run(
                [*GIT_CMD, "merge-base", "HEAD", main],
                cwd=repo_root, capture_output=True, text=True, timeout=5,
            )
            if r.returncode == 0 and r.stdout.strip():
                return r.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass
    return None

def is_commit_review_enabled():
    """Gate for the commit-review PostToolUse[Bash] hook.

    Commit review is enabled by default; ENABLE_COMMIT_REVIEW=0 remains the
    unconditional kill switch and SECURITY_GUIDANCE_COMMIT_REVIEW (on/off)
    remains a legacy per-user override; everything else defaults on.
    commit_review_on is still emitted in metrics for continuity.
    """
    if not ENABLE_COMMIT_REVIEW:
        return False
    override = os.environ.get("SECURITY_GUIDANCE_COMMIT_REVIEW", "").strip().lower()
    if override in ("on", "off"):
        return override == "on"
    return True

COMMIT_REVIEW_ENABLED = is_commit_review_enabled()

def _agentic_review_with_race(
    repo_root: str,
    diff_files: List[Tuple[str, str]],
    rel_touched: List[str],
    previous_findings: List[Dict[str, Any]],
) -> Tuple[Optional[str], List[Dict[str, Any]], Dict[str, Any]]:
    """Race the agentic reviewer against a delayed single-shot fallback.

    Agentic starts at t=0. After SG_AGENTIC_RACE_DELAY_S (default 180s), the
    single-shot diff reviewer also starts. Whichever finishes first wins. If
    agentic finishes before the delay elapses, the fallback never runs.

    Metrics added:
      race_winner    : 1 = agentic won, 2 = fallback won (CC accepts only
                       bool/finite-number metric values — strings would discard the dict)
      race_delay_s   : the configured delay
      race_started   : 1 if the fallback was actually launched, else 0

    Only the commit-review handler calls this — external harnesses invoke
    agentic_review() directly and are unaffected. SG_AGENTIC_NO_RACE=1
    disables the race for any other caller that wants pure agentic.
    """
    import queue as _queue
    import threading as _th
    import time as _t

    if os.environ.get("SG_AGENTIC_NO_RACE") == "1":
        return agentic_review(repo_root, diff_files, rel_touched)

    delay_s = int(os.environ.get("SG_AGENTIC_RACE_DELAY_S", "180"))
    q: "_queue.Queue[Tuple[str, Any]]" = _queue.Queue(maxsize=1)
    fallback_started = _th.Event()

    def _agentic() -> None:
        try:
            r = agentic_review(repo_root, diff_files, rel_touched)
        except Exception as e:  # pragma: no cover — crash → let fallback win
            r = (None, [], {"agentic_fallback": f"race_crash:{type(e).__name__}"})
        try:
            q.put_nowait(("agentic", r))
        except _queue.Full:
            pass

    def _fallback() -> None:
        _t.sleep(delay_s)
        if not q.empty():
            return  # agentic finished within the delay — never start fallback
        fallback_started.set()
        try:
            g, v = analyze_code_security(
                diff_files, is_diff=True, previous_findings=previous_findings
            )
        except Exception as e:  # pragma: no cover
            g, v = None, []
        try:
            q.put_nowait(("fallback", (g, v, {"agentic": False})))
        except _queue.Full:
            pass

    _th.Thread(target=_agentic, daemon=True).start()
    _th.Thread(target=_fallback, daemon=True).start()

    winner, (g, v, m) = q.get()
    m = dict(m)  # don't mutate the callee's metrics dict
    m["race_winner"] = 1 if winner == "agentic" else 2
    m["race_delay_s"] = delay_s
    m["race_started"] = 1 if fallback_started.is_set() else 0
    return g, v, m

def handle_commit_review_posttooluse(input_data):
    """PostToolUse handler for Bash — reviews git commits for security issues.

    Runs as asyncRewake: detects `git commit` in the Bash command, parses
    the resulting SHA(s) from the Bash stdout `[branch sha] msg` line, runs
    `git show -p <sha>` per SHA, sends the combined diff through
    analyze_code_security, and exits with code 2 (stderr findings) to wake
    the model. Deduplicates against the shared previous_findings state so
    the Stop hook won't re-flag the same (filePath, vulnerableCode) pair.
    """
    session_id = input_data.get("session_id", "default")
    tool_input = input_data.get("tool_input", {})
    tool_response = input_data.get("tool_response", {})
    cwd = input_data.get("cwd", "")

    command = tool_input.get("command", "")
    if not isinstance(command, str) or not _GIT_COMMIT_RE.search(command):
        # Defensive only — hooks.json's `"if": "Bash(git commit:*)"` is the
        # real gate so CC never spawns python3 for ls/grep/etc. This catches
        # cases where CC's command matching fails open and spawns the hook anyway.
        sys.exit(0)

    debug_log(f"Commit review: detected git commit in command")

    # Bash tool_response has no exit_code field (only stdout, stderr,
    # interrupted), so success is inferred from the output text — the same
    # heuristic Claude Code itself uses.
    if not isinstance(tool_response, dict):
        tool_response = {}
    stdout = tool_response.get("stdout", "") or ""
    stderr = tool_response.get("stderr", "") or ""
    bash_output = stdout + "\n" + stderr
    interrupted = bool(tool_response.get("interrupted"))

    # Require BOTH a line-anchored `[branch sha]` AND a git-only diffstat
    # signal before treating the tool call as a successful commit. The old
    # `any()` check false-positived on (a) pre-commit/husky/lint-staged hooks
    # emitting labels like `[pre-commit abc1234]`, and on (b) chained
    # `git commit || git log --stat` where `N files changed` appears in output
    # even though the commit itself failed.
    commit_succeeded = (
        not interrupted
        and _COMMIT_SHA_RE.search(bash_output) is not None
        and any(p.search(bash_output) for p in _COMMIT_DIFFSTAT_PATTERNS)
    )

    # commit_review_on emitted on every path so telemetry can filter on
    # commit_review and group by commit_review_on.
    _base = {"commit_review": True, "commit_review_on": COMMIT_REVIEW_ENABLED}

    # Reflog fallback for hidden stdout. Analysis of skip_reason=21 emissions
    # showed a large share were commits that DID succeed
    # but whose `[branch sha]` line was hidden by piping/redirection/-q
    # (e.g., `git commit -m ... 2>&1 | tail -3`). A HEAD@{0}
    # reflog check substantially reduced this skip; follow-up analysis found
    # the residual is dominated by (a) chained commands moving HEAD@{0} past
    # `commit:` (`git commit && git push`), and (b) the `_obvious_noop` guard
    # false-positiving on chained `git status` output after a successful -q
    # commit. Widening to the last-5-entries × 120s scan and dropping the noop
    # guard fixes both. The reviewed-shas dedup below prevents the wider window
    # from re-reviewing a prior Bash call's commit, and is the same file
    # push-sweep reads — so a SHA is reviewed at most once across both
    # surfaces. See _git_reflog_recent_commits docstring for cross-repo /
    # race safety.
    _reflog_shas: List[str] = []
    _skip_21_sub = 0
    if not commit_succeeded and not interrupted and cwd:
        _root = _git_toplevel(cwd)
        _fresh, _stale = _git_reflog_recent_commits(_root)
        if _fresh:
            _already = _load_reviewed_shas(_root)
            _reflog_shas = [s for s in _fresh if s not in _already]
            if _reflog_shas:
                commit_succeeded = True
                debug_log(
                    f"Commit review: stdout had no `[branch sha]`; reflog "
                    f"shows {len(_reflog_shas)} fresh unreviewed commit(s) "
                    f"({_reflog_shas[0][:12]}...)"
                )
            else:
                # Fresh commit(s) in reflog but all already in
                # sg-reviewed-shas — likely a Bash retry or the commit was
                # reviewed via a prior fire. Correct to skip; sub=2 lets telemetry
                # split this from genuine fails.
                _skip_21_sub = 2
        elif _stale:
            _skip_21_sub = 3  # commit entries exist but all >120s old
        else:
            _skip_21_sub = 4  # no commit-action entries — genuine fail

    if not commit_succeeded:
        debug_log("Commit review: commit did not succeed, skipping")
        emit_metrics({"skipped": True, "skip_reason": 21, **_base,
                      **({"skip_21_sub": 1} if interrupted
                         else {"skip_21_sub": _skip_21_sub} if _skip_21_sub
                         else {})})
        sys.exit(0)

    if not COMMIT_REVIEW_ENABLED:
        debug_log("Commit review: disabled, skipping")
        emit_metrics({"skipped": True, "skip_reason": 32, **_base})
        sys.exit(0)

    if not ENABLE_CODE_SECURITY_REVIEW or not HAS_API_CREDENTIALS:
        debug_log("Commit review: LLM review disabled or no API credentials")
        emit_metrics({"skipped": True, "skip_reason": 22, **_base})
        sys.exit(0)

    if not ensure_anthropic_reachable():
        debug_log("Commit review: api.anthropic.com unreachable")
        emit_metrics({"skipped": True, "skip_reason": 24, **_base})
        sys.exit(0)

    if not cwd:
        debug_log("Commit review: no cwd")
        emit_metrics({"skipped": True, "skip_reason": 25, **_base})
        sys.exit(0)

    repo_root = _git_toplevel(cwd)
    if not repo_root:
        debug_log("Commit review: not in a git repo")
        emit_metrics({"skipped": True, "skip_reason": 26, **_base})
        sys.exit(0)

    # Pin the review to the exact SHA the Bash command produced, parsed from
    # its stdout. Reviewing HEAD instead is wrong when the commit was made in
    # a different repo than the hook's cwd (`cd ../other && git commit && cd -`,
    # subshells), or when a second commit lands before this async hook reaches
    # `git show` — both would review an unrelated commit. The reflog-action
    # fallback above is the narrow exception: it only fires when output gave
    # us nothing AND the cwd repo's own reflog confirms a `commit:` just
    # happened there, which rules out the cross-repo case.
    #
    # Take only the LAST match: pre-commit/husky hooks can print bracketed
    # labels like `[pre-commit abc1234]` that precede the real `[branch sha]`
    # line; chained commands like `git commit && git commit` produce multiple
    # real SHAs and we want the most recent. The real commit line is always
    # last in git's own output — the earlier matches are either decoys or
    # superseded commits.
    if _reflog_shas:
        # Output-based detection already failed above; the reflog SHAs are the
        # authoritative ones. Don't re-parse bash_output here — any bracketed
        # token it contains is by construction NOT the `[branch sha]` line
        # (or commit_succeeded would have been True via the fast path). The
        # list is newest-first and may contain >1 entry when a single Bash
        # call made multiple commits (`git commit -m a && git commit -m b`);
        # all are reviewed.
        shas = _reflog_shas
    else:
        all_shas = _COMMIT_SHA_RE.findall(bash_output)
        shas = [all_shas[-1]] if all_shas else []
    if not shas:
        debug_log("Commit review: no SHA in commit output")
        emit_metrics({"skipped": True, "skip_reason": 33, **_base})
        sys.exit(0)
    if _reflog_shas:
        # Observability: track how often the fallback path is hit so
        # future analysis can split on it.
        # `reflog_shas_n` lets telemetry measure how often the widened scan picked
        # up >1 commit (i.e., chained `git commit && git commit`).
        _base = {**_base, "sha_via_reflog": True,
                 "reflog_shas_n": len(_reflog_shas)}

    # `git commit --amend`: review only the delta added by the amend
    # (pre-amend..post-amend) instead of the full amended commit. Without this,
    # the amend re-reviews the entire commit including code already reviewed
    # on the original commit, costing 30-60s of LLM time and re-flagging
    # findings the user may have just amended IN ORDER TO fix. Pre-amend
    # SHA comes from the reflog and is validated to be an amend (see
    # _resolve_amend_pre_sha) — otherwise we fall back to full-commit review.
    #
    # Three guards skip the delta path and fall back to full `git show`
    # review. All three close variants of "chained `git commit && git commit
    # --amend` in one Bash call", which would otherwise enter the delta path,
    # see an empty `git diff sha_wip sha_amend`, emit skip_reason=35, and
    # silently drop the first commit's content from review (no prior
    # PostToolUse fired for it — same Bash call):
    #
    # 1. `not _reflog_shas`: reflog fallback path was taken (both commits'
    #    bash output suppressed via -q / pipe / redirect). The multi-SHA scan
    #    already populates `shas` with every fresh commit (amend + any
    #    pre-amend WIP) and the loop below `git show`s each, so coverage is
    #    correct without delta — and the delta path doesn't compose with a
    #    multi-SHA `shas` list (it would diff every entry against the same
    #    pre-amend SHA). Losing the 30-60s saving on the reflog-fallback
    #    fraction is an acceptable trade.
    #
    # 2. `len(all_shas) <= 1`: both commits visible (no -q). Two `[branch
    #    sha]` lines in bash_output → all_shas len 2. Only defined on the
    #    bash-output path; short-circuit ordering keeps it unevaluated when
    #    `_reflog_shas` is non-empty.
    #
    # 3. `commit_invocations <= 1`: asymmetric — first commit -q, amend
    #    visible. Fast-path fires on the amend's `[branch sha]` line (so
    #    `_reflog_shas` stays empty), all_shas = [sha_amend] (len 1) — guards
    #    1 and 2 both pass. The command string itself is the only remaining
    #    signal that two commits happened. False-positives (e.g.
    #    `git commit --amend -m "fix git commit bug"`) are safe — they fall
    #    back to full review.
    is_amend = bool(_GIT_AMEND_RE.search(command))
    commit_invocations = len(_GIT_COMMIT_RE.findall(command))
    pre_amend_sha = None
    if (is_amend and not _reflog_shas and len(all_shas) <= 1
            and commit_invocations <= 1):
        pre_amend_sha = _resolve_amend_pre_sha(repo_root, expected_post_sha=shas[0])
    if is_amend and pre_amend_sha:
        _base = {**_base, "amend_delta_review": True}
        debug_log(
            f"Commit review: --amend detected; reviewing delta "
            f"{pre_amend_sha[:12]}..{shas[-1][:12]}"
        )

    # --no-color: `color.ui=always` would emit ANSI escapes that corrupt
    # parse_diff_into_files' header match. Bytes + errors='replace': commits
    # can contain non-UTF8 source (latin-1, cp1252) and text=True would raise
    # UnicodeDecodeError outside the except clause.
    diff_files = []
    resolved = 0
    for sha in shas:
        try:
            if pre_amend_sha:
                # Delta review: pre-amend → post-amend. `git diff` (not show)
                # so the output is a pure unified diff with no commit header.
                result = subprocess.run(
                    [*GIT_CMD, "diff", "--no-color", "--no-ext-diff", pre_amend_sha, sha, "--"],
                    cwd=repo_root, capture_output=True, timeout=15
                )
            else:
                result = subprocess.run(
                    [*GIT_CMD, "show", "-p", "--no-color", "--no-ext-diff", sha, "--"],
                    cwd=repo_root, capture_output=True, timeout=15
                )
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
            _cmd = "git diff" if pre_amend_sha else "git show"
            debug_log(f"Commit review: {_cmd} {sha} error: {e}")
            continue
        if result.returncode != 0:
            # SHA not in this repo (cross-repo commit) or already gc'd. Better
            # to skip than to fall back to HEAD and review the wrong commit.
            _cmd = "git diff" if pre_amend_sha else "git show"
            debug_log(f"Commit review: {_cmd} {sha} rc={result.returncode}")
            continue
        resolved += 1
        diff_files.extend(parse_diff_into_files(
            result.stdout.decode("utf-8", errors="replace")))

    # Dedup by path. The widened reflog scan can return >1 SHA (e.g.
    # `git commit && git commit --amend` within 120s); a path that appears in
    # both diffs would consume two MAX_DIFF_FILES slots and be re-analyzed.
    # `shas` is newest-first so the first occurrence is the most recent
    # version of the file — keep it.
    if len(shas) > 1:
        _seen = set()
        diff_files = [
            (fp, c) for fp, c in diff_files
            if not (fp in _seen or _seen.add(fp))
        ]

    if resolved == 0:
        debug_log("Commit review: no parsed SHA resolved in cwd repo")
        emit_metrics({"skipped": True, "skip_reason": 28, **_base,
                      "shas_found": len(shas)})
        sys.exit(0)

    # Empty amend delta = message-only amend (or whitespace-only that the
    # diff already collapses). No code to review; skip cleanly. skip_reason=35.
    # Gated on resolved > 0 so subprocess failures (caught with `continue`
    # above) don't get mislabeled as message-only — they fall through to
    # skip_reason=28 correctly.
    if pre_amend_sha and not diff_files:
        debug_log("Commit review: --amend produced empty delta (message-only?), skipping")
        emit_metrics({"skipped": True, "skip_reason": 35, **_base,
                      "files_reviewed": 0})
        sys.exit(0)

    debug_log(f"Commit review: {resolved}/{len(shas)} sha(s) resolved, "
              f"{len(diff_files)} files")
    if not diff_files:
        debug_log("Commit review: no reviewable source files in commit")
        emit_metrics({"skipped": True, "skip_reason": 30, **_base})
        sys.exit(0)

    # Large commits (initial scaffolds, big refactors) used to bail here with
    # skip_reason=31. Large multi-file changes are exactly where
    # cross-file source→sink vulns hide. Reviewing nothing is
    # worse than reviewing the riskiest 30 — _cap_files_for_prompt already
    # bounds total bytes downstream so this can't blow context.
    # `diff_files_dropped` lets telemetry measure how often the prioritizer engages
    # and how much it drops; skip_reason=31 is now reserved for the truly
    # pathological case (e.g. >300 source files — almost certainly a bad
    # baseline, not a real commit).
    if len(diff_files) > 10 * MAX_DIFF_FILES:
        debug_log(f"Commit review: pathological diff ({len(diff_files)} files), skipping")
        emit_metrics({"skipped": True, "skip_reason": 31, **_base,
                      "diff_files_count": len(diff_files)})
        sys.exit(0)
    diff_files, _dropped = _prioritize_diff_files(diff_files, MAX_DIFF_FILES)
    if _dropped:
        debug_log(f"Commit review: prioritized to {len(diff_files)} files "
                  f"(dropped {_dropped} lower-risk)")
        _base = {**_base, "diff_files_dropped": _dropped}

    # Rolling-hour rate limit on LLM spend, so only burn a slot once we know
    # we'll actually call analyze_code_security — skip 28/30/31/33 above are
    # free. `rate_count` is emitted on every fire (not just rejections) so
    # telemetry can show how close to the cap sessions run.
    _allowed, _rate_n = atomic_check_rate_limit(
        session_id, "CommitReview",
        MAX_COMMIT_REVIEWS_PER_HOUR, COMMIT_REVIEW_RATE_WINDOW_S)
    _base = {**_base, "rate_count": _rate_n}
    if not _allowed:
        debug_log("Commit review: hourly rate limit reached, skipping")
        emit_metrics({"skipped": True, "skip_reason": 23, **_base})
        sys.exit(0)

    # Read previous_findings for dedup (shared with Stop hook)
    import time as _time
    now = _time.time()

    def _read_previous(state):
        findings_ts = state.get("previous_findings_ts", 0)
        if (now - findings_ts) > PREVIOUS_FINDINGS_TTL_SEC:
            return []
        return list(state.get("previous_findings", []))

    previous_findings = with_locked_state(session_id, _read_previous) or []

    review_start = _time.time()

    agentic_metrics: Dict[str, Any] = {}
    if _agentic_commit_review_enabled():
        rel_touched = [fp for fp, _ in diff_files]
        concrete_guidance, vulns, _am = _agentic_review_with_race(
            repo_root, diff_files, rel_touched, previous_findings
        )
        agentic_metrics.update(_am)
        # Fall back to single-shot only on agentic FAILURE (SDK/investigate
        # crash). If agentic completed and returned 0 findings, trust that.
        if agentic_metrics.get("agentic_fallback"):
            concrete_guidance, vulns = analyze_code_security(
                diff_files, is_diff=True, previous_findings=previous_findings
            )
    else:
        concrete_guidance, vulns = analyze_code_security(
            diff_files, is_diff=True, previous_findings=previous_findings
        )

    # push-sweep state: record this commit as reviewed (full 40-hex sha) so a
    # later `git push` can advance its diff base past it. Recorded here — after
    # the review ran but before any exit path — so it's marked regardless of
    # whether findings were emitted. `shas` holds abbreviated refs from
    # `[branch sha]`; resolve to full so set-membership in the push-sweep is
    # exact. Best-effort; failures here never block the review result.
    try:
        full_shas = []
        for s in shas:
            r = subprocess.run(
                [*GIT_CMD, "rev-parse", "--verify", "-q", s],
                cwd=repo_root, capture_output=True, text=True, timeout=5,
            )
            if r.returncode == 0:
                full_shas.append(r.stdout.strip())
        _append_reviewed_shas(repo_root, full_shas, vulns_found=len(vulns or []))
    except Exception:
        pass

    review_ms = int((_time.time() - review_start) * 1000)
    # `survived` is the raw self-refute count BEFORE the high/critical-only
    # severity filter; `survived_after_sev` is the count the user actually
    # sees. Include `survived_after_sev` ONLY when the filter actually
    # dropped candidates — otherwise it's redundant with `survived` and eats
    # into CC's 10-key emit cap, pushing files_reviewed/review_ms out of the
    # emitted metrics.
    #
    # CC accepts only booleans and finite numbers as metric values.
    # A null or string value makes CC discard the ENTIRE dict, so:
    #   - candidates/survived are omitted when None (early-return at
    #     candidates==0, or any fallback path)
    #   - agentic_fallback is mapped to an int reason code; the string detail
    #     stays in debug_log for diagnosis
    _sev_raw = agentic_metrics.get("survived")
    _sev_post = agentic_metrics.get("survived_after_sev")
    _cand = agentic_metrics.get("candidates")
    _fb = agentic_metrics.get("agentic_fallback")
    # 1 = SDK import failed (claude_agent_sdk not installed)
    # 2 = investigate stage failed (CLI/network/model error or schema-retry exhausted)
    _fb_code = (1 if _fb and _fb.startswith("import:") else 2) if _fb else None
    _race = agentic_metrics.get("race_winner")
    _agentic_m = (
        # `agentic` = which path produced the result, not which was attempted.
        # On race-loss the _fallback() metrics dict has agentic=False — emitting
        # True there blends the high-find-rate single-shot race-loss bucket into
        # `agentic=true` queries and overstates agentic yield.
        {"agentic": bool(agentic_metrics.get("agentic")),
         **({"candidates": _cand} if _cand is not None else {}),
         **({"survived": _sev_raw} if _sev_raw is not None else {}),
         **({"survived_after_sev": _sev_post}
            if _sev_post is not None and _sev_post != _sev_raw else {}),
         **({"agentic_fallback": _fb_code} if _fb_code is not None else {}),
         # 1 = agentic won, 2 = single-shot fallback won. review_ms already
         # captures timing; race_winner lets telemetry segment recall by which path
         # actually produced the result.
         **({"race_winner": _race} if _race is not None else {})}
        if agentic_metrics.get("agentic") or _fb or _race is not None
        else {}
    )

    if not concrete_guidance:
        debug_log("Commit review: no security issues found")
        emit_metrics({
            "vulns_found": 0, **_base, **_agentic_m,
            "files_reviewed": len(diff_files), "review_ms": review_ms,
            **({
                "api_error": llm._last_call_claude_http_error
            } if llm._last_call_claude_http_error is not None else {}),
        })
        sys.exit(0)

    # Late dedup: drop only what a concurrent Stop hook wrote while our LLM
    # ran. Anything in `previous_findings` (the pre-LLM snapshot) that the
    # LLM chose to re-flag is an intentional "fix incomplete" verdict.
    new_vulns, n_deduped = _dedup_against_state(
        session_id, vulns, prompted=_finding_keys(previous_findings)
    )

    if not new_vulns:
        debug_log("Commit review: all findings already known, skipping")
        emit_metrics({
            "vulns_found": 0, **_base, **_agentic_m, "deduped": n_deduped,
            "files_reviewed": len(diff_files), "review_ms": review_ms,
        })
        sys.exit(0)

    # Record new findings into shared state. Key on (filePath, category) —
    # vulnerableCode bytes drift between fires (diff context lines shift) so
    # matching on it under-dedupes; this aligns with Stop's _record_fire.
    finding_snapshots = [
        {
            "filePath": v.get("filePath", ""),
            "category": v.get("category", "Unknown"),
            "vulnerableCode": v.get("vulnerableCode", ""),
        }
        for v in new_vulns
    ]

    def _record_findings(state):
        existing = [f for f in state.get("previous_findings", []) if isinstance(f, dict)]
        seen = {(f.get("filePath", ""), f.get("category", "")) for f in existing}
        for f in finding_snapshots:
            key = (f["filePath"], f["category"])
            if key not in seen:
                seen.add(key)
                existing.append(f)
        state["previous_findings"] = existing
        state["previous_findings_ts"] = _time.time()
    with_locked_state(session_id, _record_findings)

    sev = {"critical": 0, "high": 0, "medium": 0}
    for v in new_vulns:
        s = v.get("severity", "medium")
        if s in sev:
            sev[s] += 1

    emit_metrics({
        "vulns_found": len(new_vulns), **_base, **_agentic_m,
        "critical_count": sev["critical"], "high_count": sev["high"],
        "files_reviewed": len(diff_files), "review_ms": review_ms,
        **({"deduped": n_deduped} if n_deduped else {}),
    }, rewake_summary=_format_vulns_summary(new_vulns, prefix="Commit security review found"))

    # Rebuild guidance from new_vulns only — concrete_guidance from the LLM
    # still lists deduped entries.
    sys.stderr.write(PROVENANCE_BANNER + "\n\n"
                     + _format_vulns_guidance(new_vulns)
                     + CONTINUATION_SUFFIX + "\n")
    sys.exit(2)

def handle_push_sweep_posttooluse(input_data):
    """Review the just-pushed range as one diff, advancing the base past the
    contiguous prefix of already-per-commit-reviewed shas.

    Spec: review `git diff B..HEAD` where `B` is the newest commit such that
    `prev_upstream..B` is entirely in `.git/sg-reviewed-shas`. Skip if
    `B == HEAD`. Mark `B..HEAD` reviewed afterward.

    Diff and Read are both at HEAD (push doesn't move the working tree), so the
    agentic reviewer sees a consistent view — a vuln introduced in commit A and
    removed in commit B is absent from the net diff by construction. Any
    reviewed commits in the tail (after the first unreviewed one) are included
    in the diff; their findings are dropped by `_dedup_against_state` against
    `previous_findings` the per-commit hook already recorded.

    Metrics: `push_sweep: True` is the telemetry splitter; `pushed`/`unreviewed`/
    `prefix_advanced` give the funnel; skip_reasons 40-49 are reserved for
    this surface.
    """
    tool_input = input_data.get("tool_input", {}) or {}
    tool_response = input_data.get("tool_response", {}) or {}
    command = tool_input.get("command", "") or ""
    cwd = input_data.get("cwd")
    session_id = input_data.get("session_id", "")
    bash_output = (
        (tool_response.get("stdout", "") or "")
        + "\n"
        + (tool_response.get("stderr", "") or "")
    )
    interrupted = tool_response.get("interrupted", False)

    # Re-gate: hooks.json `if` matched, but confirm with the broader regex
    # (defensive — `git -C`/`-c` forms won't reach here via the hooks.json
    # prefix matcher alone, but a compound with a plain `git push` would).
    if not _GIT_PUSH_RE.search(command):
        sys.exit(0)

    _base = {"push_sweep": True, "push_sweep_on": PUSH_SWEEP_ENABLED}

    if not PUSH_SWEEP_ENABLED:
        emit_metrics({"skipped": True, "skip_reason": 40, **_base})
        sys.exit(0)
    if interrupted:
        emit_metrics({"skipped": True, "skip_reason": 21, **_base})
        sys.exit(0)
    if not ENABLE_CODE_SECURITY_REVIEW or not HAS_API_CREDENTIALS:
        emit_metrics({"skipped": True, "skip_reason": 22, **_base})
        sys.exit(0)
    if not cwd:
        emit_metrics({"skipped": True, "skip_reason": 25, **_base})
        sys.exit(0)
    repo_root = _git_toplevel(cwd)
    if not repo_root:
        emit_metrics({"skipped": True, "skip_reason": 26, **_base})
        sys.exit(0)

    # Guard: the sweep diffs `base..HEAD` and the agent Reads the working
    # tree, so the pushed ref MUST be HEAD or the review is of the wrong
    # range. `git push origin other` while checked out elsewhere, or a
    # multi-ref push, are skipped (skip_reason 44). Check the new-tip from
    # the `abc..def  local -> remote` line against HEAD.
    #
    # Scope range-line detection to the push section of bash_output: a chained
    # `git fetch && git push` produces fetch range lines that the regex would
    # otherwise match too, false-tripping multi-ref. `_push_section` slices
    # forward from the last `To <remote>` header.
    #
    # If there are no range lines, we MUST also see a positive push-success
    # signal (`* [new branch]` or `Everything up-to-date`) AND verify the
    # pushed local ref resolves to HEAD before falling through to the
    # @{u}@{1}/merge-base detection. Without this, two real cases misdirect
    # the sweep: `git push origin feature2` while on `feature1` (no range
    # line, no HEAD check → reviews wrong branch and poisons reviewed-shas),
    # and rejected pushes (no range line, no `interrupted` signal → reviews
    # unpushed local commits and marks them reviewed). skip_reason=46 covers
    # both.
    head = None
    try:
        r = subprocess.run([*GIT_CMD, "rev-parse", "HEAD"], cwd=repo_root,
                           capture_output=True, text=True, timeout=5)
        head = r.stdout.strip() if r.returncode == 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    push_section = _push_section(bash_output or "")
    range_matches = list(_PUSH_RANGE_RE.finditer(push_section))
    if range_matches and head:
        # Multi-ref push (multiple range lines) or pushed-tip ≠ HEAD → skip.
        if len(range_matches) > 1:
            emit_metrics({"skipped": True, "skip_reason": 44, **_base})
            sys.exit(0)
        new_tip = range_matches[0].group(2)
        if not head.startswith(new_tip):
            debug_log(f"Push sweep: pushed tip {new_tip} != HEAD {head[:12]}")
            emit_metrics({"skipped": True, "skip_reason": 44, **_base})
            sys.exit(0)
    elif head:
        # No range lines. Need a positive push-success signal — otherwise
        # the push may have failed and we'd review unpushed local commits.
        new_branch_matches = re.findall(
            r"^\s*\*\s+\[new branch\]\s+(\S+)\s+->\s+\S+",
            push_section, re.M)
        up_to_date = "Everything up-to-date" in push_section
        # `git push -q` suppresses all output on success. Distinguish quiet-
        # success from a failed push (which has error text) by checking the
        # upstream's reflog: a successful push leaves @{u}@{1} (the prior
        # value) different from @{u} (now equal to HEAD). A rejected push
        # would not advance @{u}, so this signal is push-specific.
        quiet_success = False
        if not (bash_output or "").strip() and not interrupted:
            try:
                r_cur = subprocess.run(
                    [*GIT_CMD, "rev-parse", "--verify", "-q", "@{u}"],
                    cwd=repo_root, capture_output=True, text=True, timeout=5)
                r_prev = subprocess.run(
                    [*GIT_CMD, "rev-parse", "--verify", "-q", "@{u}@{1}"],
                    cwd=repo_root, capture_output=True, text=True, timeout=5)
                cur = r_cur.stdout.strip() if r_cur.returncode == 0 else ""
                prev_u = r_prev.stdout.strip() if r_prev.returncode == 0 else ""
                quiet_success = bool(cur and prev_u and cur == head and prev_u != cur)
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                pass
        if not (new_branch_matches or up_to_date or quiet_success):
            debug_log("Push sweep: no push-success signal in bash output")
            emit_metrics({"skipped": True, "skip_reason": 46, **_base})
            sys.exit(0)
        # `* [new branch] local -> remote`: verify the pushed local ref
        # resolves to HEAD. `git push origin feature2` while on feature1
        # would otherwise review feature1's commits and poison its
        # reviewed-shas state.
        for local_ref in new_branch_matches:
            try:
                r = subprocess.run(
                    [*GIT_CMD, "rev-parse", "--verify", "-q", local_ref],
                    cwd=repo_root, capture_output=True, text=True, timeout=5,
                )
                local_sha = r.stdout.strip() if r.returncode == 0 else ""
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                local_sha = ""
            if local_sha and local_sha != head:
                debug_log(f"Push sweep: new-branch {local_ref} ({local_sha[:12]}) != HEAD {head[:12]}")
                emit_metrics({"skipped": True, "skip_reason": 44, **_base})
                sys.exit(0)

    prev_upstream = _detect_prev_upstream(repo_root, bash_output)
    if not prev_upstream:
        debug_log("Push sweep: could not determine prev_upstream")
        emit_metrics({"skipped": True, "skip_reason": 41, **_base})
        sys.exit(0)

    push_range = _git_rev_list_range(repo_root, prev_upstream, "HEAD")
    if not push_range:
        emit_metrics({"skipped": True, "skip_reason": 42, **_base, "pushed": 0})
        sys.exit(0)
    if len(push_range) > MAX_PUSH_SWEEP_RANGE:
        # Huge first-push of a long-lived branch — Stop hook is the backstop.
        emit_metrics({"skipped": True, "skip_reason": 43, **_base,
                      "pushed": len(push_range)})
        sys.exit(0)

    reviewed = _load_reviewed_shas(repo_root)
    base, tail = _compute_push_sweep_base(prev_upstream, push_range, reviewed)
    prefix_advanced = len(push_range) - len(tail)
    if base is None:
        debug_log("Push sweep: every pushed commit already reviewed")
        emit_metrics({**_base, "pushed": len(push_range), "unreviewed": 0,
                      "prefix_advanced": prefix_advanced})
        sys.exit(0)

    debug_log(f"Push sweep: range={len(push_range)} prefix_advanced="
              f"{prefix_advanced} base={base[:12]} tail={len(tail)}")

    diff_text = _git_diff_range(repo_root, base, "HEAD")
    if diff_text is None:
        # Diff failed (non-zero exit / 30s timeout / git missing). Do NOT
        # mark `tail` reviewed — we did not actually review it. Marking
        # them would silently advance the prefix past unreviewed commits
        # forever (the whole point of push-sweep is to catch outside-CC
        # commits, and a 50-commit range over large files can hit the
        # 30s timeout). skip_reason=45 lets a retry / smaller subsequent
        # push still cover them, mirroring how skip_reason=31 handles
        # too-many-files without recording the tail.
        emit_metrics({**_base, "pushed": len(push_range),
                      "unreviewed": len(tail), "skip_reason": 45})
        sys.exit(0)
    diff_files = parse_diff_into_files(diff_text)
    if not diff_files:
        emit_metrics({**_base, "pushed": len(push_range),
                      "unreviewed": len(tail), "skip_reason": 30})
        # Still mark tail reviewed — there's nothing to review.
        _append_reviewed_shas(repo_root, tail, vulns_found=0)
        sys.exit(0)
    # Same prioritize-don't-bail logic as commit-review (see comment there).
    # push-sweep ranges are net diffs over many commits so they hit the cap
    # more often; reviewing the riskiest MAX_PUSH_SWEEP_FILES is strictly
    # better than reviewing none. We still mark `tail` reviewed afterward —
    # the dropped files are by construction the low-risk ones (config, .gen,
    # tests, migrations), and NOT advancing the base would make the next
    # push re-hit the same overflow with an even larger range. Per-commit
    # review remains the primary surface for those files. The 10×
    # pathological guard stays so a 500-file vendored-dir push doesn't burn
    # a counter slot.
    if len(diff_files) > 10 * MAX_PUSH_SWEEP_FILES:
        emit_metrics({**_base, "pushed": len(push_range),
                      "unreviewed": len(tail), "skip_reason": 31,
                      "diff_files_count": len(diff_files)})
        sys.exit(0)
    diff_files, _dropped = _prioritize_diff_files(diff_files, MAX_PUSH_SWEEP_FILES)
    if _dropped:
        _base = {**_base, "diff_files_dropped": _dropped}

    _allowed, _rate_n = atomic_check_rate_limit(
        session_id, "PushSweep",
        MAX_COMMIT_REVIEWS_PER_HOUR, COMMIT_REVIEW_RATE_WINDOW_S)
    _base = {**_base, "rate_count": _rate_n}
    if not _allowed:
        emit_metrics({"skipped": True, "skip_reason": 23, **_base})
        sys.exit(0)

    import time as _time
    now = _time.time()
    previous_findings = with_locked_state(
        session_id,
        lambda s: list(s.get("previous_findings", []))
        if (now - s.get("previous_findings_ts", 0)) <= PREVIOUS_FINDINGS_TTL_SEC
        else []
    ) or []

    review_start = _time.time()
    rel_touched = [fp for fp, _ in diff_files]
    if _agentic_commit_review_enabled():
        concrete_guidance, vulns, agentic_metrics = _agentic_review_with_race(
            repo_root, diff_files, rel_touched, previous_findings
        )
        if agentic_metrics.get("agentic_fallback"):
            concrete_guidance, vulns = analyze_code_security(
                diff_files, is_diff=True, previous_findings=previous_findings
            )
    else:
        concrete_guidance, vulns = analyze_code_security(
            diff_files, is_diff=True, previous_findings=previous_findings
        )
        agentic_metrics = {}
    review_ms = int((_time.time() - review_start) * 1000)

    # The tail is now covered by this net-diff review.
    _append_reviewed_shas(repo_root, tail, vulns_found=len(vulns or []))

    new_vulns, n_deduped = _dedup_against_state(
        session_id, vulns or [], prompted=_finding_keys(previous_findings)
    )

    # Metrics — keep within the 10-key cap; agentic sub-metrics are dropped
    # here in favour of the push-sweep funnel keys (telemetry can join on session_id
    # to the per-commit fires for agentic detail). rewake_summary must ride
    # this line (CC reads only the first {-prefixed stdout line); it's a
    # no-op when new_vulns is empty since we exit 0 below.
    emit_metrics({
        **_base, "pushed": len(push_range), "unreviewed": len(tail),
        "prefix_advanced": prefix_advanced, "vulns_found": len(new_vulns),
        "files_reviewed": len(diff_files), "review_ms": review_ms,
        **({"deduped": n_deduped} if n_deduped else {}),
    }, rewake_summary=_format_vulns_summary(new_vulns, prefix="Push security review found"))

    if not new_vulns:
        debug_log("Push sweep: no new findings")
        sys.exit(0)

    # First-push of a big branch can surface many findings at once across
    # week-old code. Report only the top-N by severity so the asyncRewake
    # isn't a wall of text; the rest go to telemetry (vulns_found is the
    # full count) and into previous_findings so Stop / next commit-review
    # don't re-flag them. Stable sort: severity, then category for
    # determinism in tests.
    _sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    new_vulns.sort(key=lambda v: (_sev_rank.get(v.get("severity", "medium"), 2),
                                  v.get("category", "")))
    reported = new_vulns[:PUSH_SWEEP_REPORT_CAP]
    n_suppressed = len(new_vulns) - len(reported)

    # Record only the REPORTED findings into shared state. previous_findings
    # means "the user was told about this — don't repeat it"; suppressed
    # findings were NOT told, so recording them would silently bury them
    # against any future commit-review/Stop that touches the same code. The
    # range is marked reviewed in `.git/sg-reviewed-shas` regardless, so the
    # push-sweep itself won't re-find them; leaving them out of
    # previous_findings keeps the door open for the per-commit hook to
    # surface them later if the code is touched again.
    snapshots = [
        {"filePath": v.get("filePath", ""),
         "category": v.get("category", "Unknown"),
         "vulnerableCode": v.get("vulnerableCode", "")}
        for v in reported
    ]
    def _record(state):
        existing = [f for f in state.get("previous_findings", [])
                    if isinstance(f, dict)]
        seen = {(f.get("filePath", ""), f.get("category", "")) for f in existing}
        for f in snapshots:
            k = (f["filePath"], f["category"])
            if k not in seen:
                seen.add(k); existing.append(f)
        state["previous_findings"] = existing
        state["previous_findings_ts"] = _time.time()
    with_locked_state(session_id, _record)

    # Prefer the LLM's formatted guidance (richer context, fix suggestions)
    # when NOTHING was dropped from the LLM's full vuln list; fall back to
    # re-formatting from `reported` whenever either the cap suppressed
    # findings OR `_dedup_against_state` dropped findings the user has
    # already been shown. concrete_guidance is built against the LLM's
    # full pre-dedup list, so leaking it past dedup re-surfaces findings
    # the per-commit hook already reported (the [✓1, ✗2, ✓3] case where
    # the tail reviewed commits' findings are in previous_findings).
    if n_suppressed or n_deduped:
        guidance = _format_vulns_guidance(reported) or ""
    else:
        guidance = concrete_guidance or _format_vulns_guidance(reported) or ""
    sys.stderr.write(
        PROVENANCE_BANNER + "\n\n" + guidance + CONTINUATION_SUFFIX + "\n"
    )
    sys.exit(2)

def handle_stop_hook(input_data):
    """
    Handle the Stop hook — final security check using git diff.
    Diffs against the baseline SHA captured at UserPromptSubmit to review
    only code changed during this turn. Runs two Haiku analyses and
    exits with code 2 to force Claude to continue and fix issues.

    Also sweeps pending pattern warnings to emit a session-level
    fixed/unresolved tally; the sweep needs no LLM and measures
    pattern-rule efficacy.
    """
    session_id = input_data.get("session_id", "default")
    stop_hook_active = input_data.get("stop_hook_active", False)
    cwd = input_data.get("cwd", "")

    # Recursion guard FIRST — consume_stop_state clears touched_paths, and CC
    # sets stop_hook_active session-wide while any asyncRewake Stop is in
    # flight, so a concurrent active=True fire winning the lock would discard
    # paths the concurrent active=False fire needs.
    if stop_hook_active:
        debug_log("Stop hook: stop_hook_active=True, skipping to avoid recursion")
        emit_metrics({"skipped": True, "skip_reason": 1, "diff_strategy_v2": True})
        sys.exit(0)

    # Snapshot all state under one lock BEFORE any slow work (sweep file I/O,
    # git, network). asyncRewake Stop runs in the background; the next turn's
    # UPS/PostToolUse can fire while we're still here. The snapshot is immune
    # to those writes — they affect the NEXT Stop fire's snapshot.
    snap = consume_stop_state(session_id)
    fire_count = snap["fire_count"]
    touched_paths = snap["touched_paths"]
    baseline_sha = snap["baseline_sha"]
    snap_baseline = baseline_sha  # pre-reassignment value for restore-on-transient-skip
    head_at_capture = snap["head_at_capture"]
    untracked_at_baseline = snap.get("untracked_at_baseline") or {}
    previous_findings = snap["previous_findings"]

    # Sweep pattern-warning outcomes (pure local work; stop_hook_active is
    # already guaranteed False here so no double-count guard needed).
    sweep = {}
    warn_fixed, warn_unresolved, warn_unresolved_mask = sweep_pending_warnings(session_id)
    if warn_fixed or warn_unresolved:
        sweep = {
            "warn_fixed": warn_fixed,
            "warn_unresolved": warn_unresolved,
            "warn_unresolved_mask": warn_unresolved_mask,
        }

    v2_metrics = {}

    def _skip(reason, restore=False, **extra):
        if restore:
            restore_unreviewed_stop_state(session_id, touched_paths, snap_baseline)
        # CC truncates metrics to 10 keys by
        # insertion order. v2_metrics (3) must precede sweep (3) so the v2
        # diagnostics survive when extra adds touched_paths_count + ip_* keys.
        emit_metrics({
            "skipped": True, "skip_reason": reason, "fire_index": fire_count + 1,
            "diff_strategy_v2": True,
            **v2_metrics, **extra, **sweep,
        })
        sys.exit(0)

    # Limit stop hook firings per asyncRewake loop to prevent infinite loops.
    # fire_count auto-expires after STOP_LOOP_STATE_TTL_SEC so a stale count
    # from a prior turn doesn't block this one.
    if MAX_STOP_HOOK_FIRINGS > 0 and fire_count >= MAX_STOP_HOOK_FIRINGS:
        debug_log(f"Stop hook: already fired {fire_count} times (max {MAX_STOP_HOOK_FIRINGS}), skipping")
        _skip(2)

    if not ENABLE_CODE_SECURITY_REVIEW or not HAS_API_CREDENTIALS:
        debug_log("Stop hook: LLM review disabled or no API credentials")
        _skip(3)

    # Stop-hook-only kill switch — placed after consume_stop_state so
    # touched_paths is still cleared each turn (a disabled Stop hook that
    # never consumed state would accumulate stale paths) and after the sweep
    # so pattern-warning efficacy metrics still emit. The commit/push reviews
    # have their own gates (ENABLE_COMMIT_REVIEW / ENABLE_CODE_SECURITY_REVIEW).
    if not ENABLE_STOP_REVIEW:
        debug_log("Stop hook: ENABLE_STOP_REVIEW=0")
        # 50+ for opt-out skips that aren't push-sweep (which owns 40-49).
        _skip(50)

    if not ensure_anthropic_reachable():
        debug_log("Stop hook: api.anthropic.com unreachable")
        _skip(10, restore=True)

    if not cwd:
        debug_log("Stop hook: no cwd")
        _skip(4)

    review_paths, diff_base, repo_root, untracked, v2_metrics = compute_v2_review_set(
        cwd, baseline_sha, head_at_capture, untracked_at_baseline
    )
    if not review_paths:
        debug_log("Stop hook: empty review set")
        _skip(9, touched_paths_count=len(touched_paths))
    debug_log(f"Stop hook: review_set={len(review_paths)} base={diff_base[:12]} dirty_now={v2_metrics['dirty_now_count']} changed_since={v2_metrics['changed_since_count']}")
    # Run from repo_root so the toplevel-relative review_paths resolve.
    # Diff CONTENT against the turn-start stash (baseline_sha) so the LLM
    # sees only this-turn edits — diffing against HEAD includes the user's
    # pre-turn uncommitted WIP, which inflates review_ms and can re-flag
    # the same pre-existing pattern every turn. The file LIST still comes
    # from git state (compute_v2_review_set), so Bash/subagent edits are
    # caught either way. Fall back to diff_base (HEAD/head_at_capture)
    # when the stash is missing or pruned.
    content_base = baseline_sha or diff_base
    diff_output = get_git_diff(repo_root, content_base, full_context=False,
                               paths=review_paths, untracked_paths=untracked)
    if diff_output is None and content_base != diff_base:
        debug_log(f"Stop hook: diff against {content_base[:12]} failed — falling back to {diff_base}")
        diff_output = get_git_diff(repo_root, diff_base, full_context=False,
                                   paths=review_paths, untracked_paths=untracked)
    # filter_preexisting_from_diff needs a resolvable pre-turn ref; fall
    # back to HEAD when UPS never captured a baseline (print mode).
    if not baseline_sha:
        baseline_sha = "HEAD"

    if not diff_output or not diff_output.strip():
        debug_log("Stop hook: no changes since baseline")
        _skip(6)

    # Parse diff into per-file content
    diff_files = parse_diff_into_files(diff_output)
    if not diff_files:
        debug_log("Stop hook: no source code files in diff")
        _skip(7)

    # Mirror commit-review: hard-bail only on pathological diffs (>300 files,
    # usually a bad baseline), otherwise prioritize by security-risk path
    # tokens and review the top MAX_DIFF_FILES. Stop is the only surface for
    # uncommitted edits; the old hard-skip at >30 files dropped the 31-300
    # bucket entirely, which is where cross-file source→sink vulns hide.
    # _cap_files_for_prompt already bounds bytes downstream.
    _stop_dropped = 0
    if len(diff_files) > 10 * MAX_DIFF_FILES:
        debug_log(f"Stop hook: pathological diff ({len(diff_files)} files > "
                  f"{10 * MAX_DIFF_FILES}), skipping")
        _skip(8, diff_files_count=len(diff_files))
    if len(diff_files) > MAX_DIFF_FILES:
        diff_files, _stop_dropped = _prioritize_diff_files(
            diff_files, MAX_DIFF_FILES)
        debug_log(f"Stop hook: prioritized to {len(diff_files)} files "
                  f"(dropped {_stop_dropped} lower-risk)")

    # Filter out pre-existing content from file rewrites
    diff_files = filter_preexisting_from_diff(diff_files, cwd, baseline_sha)

    debug_log(f"Stop hook: reviewing {len(diff_files)} changed files (standard diff)")

    import time as _time
    stop_review_start = _time.time()

    # Stop hook is single-shot only. Agentic review is wired into
    # handle_commit_review_posttooluse (PostToolUse on `git commit`) — commits
    # are slower-OK and benefit from the deeper context-reading loop.
    concrete_guidance, vulns = analyze_code_security(
        diff_files, is_diff=True, previous_findings=previous_findings
    )
    # NOTE: analyze_security_concerns disabled — it produces too many false positives
    # on pre-existing patterns in starter code. The concrete vulnerability analysis
    # is more precise and has severity filtering (high/critical only).

    stop_review_elapsed = _time.time() - stop_review_start
    debug_log(f"Stop hook: LLM reviews took {stop_review_elapsed:.1f}s total")

    review_ms = int(stop_review_elapsed * 1000)
    fire_index = fire_count + 1

    # Late dedup: drop only what a concurrent commit-review wrote while our
    # LLM ran. Anything already in `previous_findings` (the consume_stop_state
    # snapshot) that the LLM re-flagged is an intentional "fix incomplete"
    # verdict and passes through.
    if vulns:
        vulns, n_deduped = _dedup_against_state(
            session_id, vulns, prompted=_finding_keys(previous_findings)
        )
        if n_deduped and not vulns:
            debug_log("Stop hook: all findings already delivered by commit-review")
            _skip(35, deduped=n_deduped, review_ms=review_ms)
        concrete_guidance = _format_vulns_guidance(vulns)

    if concrete_guidance:
        finding_snapshots = [
            {
                "filePath": v.get("filePath", ""),
                "category": v.get("category", "Unknown"),
                "vulnerableCode": v.get("vulnerableCode", ""),
            }
            for v in vulns
        ]
        # Update baseline so next stop hook iteration only sees new changes
        new_sha = capture_git_baseline(cwd)
        new_untracked_baseline = _list_untracked(cwd) if new_sha else None

        def _record_fire(state):
            state["stop_hook_fire_count"] = fire_index
            state["stop_hook_fire_count_ts"] = _time.time()
            # Re-read under lock — the commit-review PostToolUse hook may have
            # appended findings since consume_stop_state snapshotted.
            # Dedupe on (filePath, category) — vulnerableCode includes diff
            # context lines that drift between fires, so byte-identical
            # matching let the same finding accumulate as "new" each fire.
            existing = [f for f in state.get("previous_findings", []) if isinstance(f, dict)]
            seen = {(f.get("filePath", ""), f.get("category", "")) for f in existing}
            for f in finding_snapshots:
                key = (f["filePath"], f["category"])
                if key not in seen:
                    seen.add(key)
                    existing.append(f)
            state["previous_findings"] = existing
            state["previous_findings_ts"] = _time.time()
            if new_sha:
                state["baseline_sha"] = new_sha
                state["untracked_at_baseline"] = new_untracked_baseline
        with_locked_state(session_id, _record_fire)

        if new_sha:
            debug_log(f"Updated git baseline after stop hook: {new_sha[:12]}")

        sev = {"critical": 0, "high": 0, "medium": 0}
        for v in vulns:
            s = v.get("severity", "medium")
            if s in sev:
                sev[s] += 1
        # 8 base keys + at most 2 sweep keys = 10 (cap). Drop the mask here.
        # untracked_baseline_n is the signal for whether the UPS-time
        # untracked-snapshot capture actually ran.
        sweep_trimmed = {k: v for k, v in sweep.items() if k != "warn_unresolved_mask"}
        emit_metrics({
            "vulns_found": len(vulns),
            "untracked_baseline_n": len(untracked_at_baseline),
            "diff_strategy_v2": True,
            "critical_count": sev["critical"],
            "high_count": sev["high"],
            "files_reviewed": len(diff_files),
            "touched_paths_count": len(touched_paths),
            "review_ms": review_ms,
            "fire_index": fire_index,
            **({"diff_truncated": llm._last_review_truncated_bytes}
               if llm._last_review_truncated_bytes else {}),
            **sweep_trimmed,
        }, rewake_summary=_format_vulns_summary(vulns))

        # Exit code 2 with stderr forces Claude to continue and fix
        sys.stderr.write(PROVENANCE_BANNER + "\n\n" + concrete_guidance + CONTINUATION_SUFFIX + "\n")
        sys.exit(2)

    if llm._last_call_claude_http_error is not None:
        debug_log(f"Stop hook: API call failed with status {llm._last_call_claude_http_error}")
        restore_unreviewed_stop_state(session_id, touched_paths, snap_baseline)
    else:
        debug_log("Stop hook: no security issues found")
    # CC truncates metrics to 10 keys by
    # insertion order. The previous **sweep,**v2_metrics tail meant the 3
    # v2_metrics keys were always sliced off this most-common path, so the
    # diff-strategy diagnostics never reached telemetry. Drop sweep here (it's
    # PostToolUse-warning state, orthogonal to diff-strategy comparison).
    # 6 base + optional api_error + 3 v2_metrics = ≤10.
    emit_metrics({
        "vulns_found": 0,
        "diff_strategy_v2": True,
        "files_reviewed": len(diff_files),
        "touched_paths_count": len(touched_paths),
        "review_ms": review_ms,
        "fire_index": fire_index,
        **({"api_error": llm._last_call_claude_http_error} if llm._last_call_claude_http_error is not None else {}),
        **({"diff_truncated": llm._last_review_truncated_bytes}
           if llm._last_review_truncated_bytes else {}),
        **v2_metrics,
    })
    sys.exit(0)

_SDK_BOOTSTRAP_THROTTLE = os.path.join(
    os.environ.get("SECURITY_WARNINGS_STATE_DIR")
    or os.path.expanduser("~/.claude/security"),
    ".sdk_bootstrap_spawned")

def _maybe_bootstrap_agent_sdk_async():
    """Fire-and-forget SDK bootstrap, for remote-pod environments.

    Under CLAUDE_CODE_SYNC_PLUGIN_INSTALL=true (CCR-style remote pods),
    plugins are synced *after* SessionStart fires, so the SessionStart
    `ensure_agent_sdk.py` hook never runs and the agentic commit reviewer
    falls back 100% of the time. A PostToolUse hook firing is itself proof
    the plugin is now registered, so re-trigger the bootstrap here.
    Detached, so the ~17s venv build never blocks the hook — the first
    1-2 commits of a remote session still fall back while it builds, then
    every subsequent commit gets the agentic path. ensure_agent_sdk.py
    is idempotent and O_EXCL-locked, so concurrent/repeat spawns are safe;
    the throttle file only avoids spawning dozens of subprocesses during
    the build window. No-ops in ~10ms on local installs (SDK already
    importable).
    """
    try:
        import importlib.util
        if importlib.util.find_spec("claude_agent_sdk") is not None:
            return
        import time as _t
        try:
            if _t.time() - os.path.getmtime(_SDK_BOOTSTRAP_THROTTLE) < 300:
                return
        except OSError:
            pass
        os.makedirs(os.path.dirname(_SDK_BOOTSTRAP_THROTTLE), exist_ok=True)
        # Touch the throttle BEFORE spawning so a burst of PostToolUse
        # fires in the same second don't each spawn a subprocess.
        open(_SDK_BOOTSTRAP_THROTTLE, "w").close()
        script = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "ensure_agent_sdk.py")
        subprocess.Popen(
            [sys.executable, script],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, start_new_session=True,
        )
    except Exception:
        pass  # best-effort; never break the hook over a bootstrap attempt

def main():
    """Main hook function."""
    debug_log(f"Hook called with args: {sys.argv}")

    # Master kill switch — honors ENABLE_SECURITY_REMINDER=0 (legacy) and
    # SECURITY_GUIDANCE_DISABLE=1 (clearer name, no double negative). Emit
    # empty metrics so asyncRewake hooks (Stop) don't hang waiting for stdout
    # output that never comes.
    if SECURITY_GUIDANCE_DISABLED:
        emit_metrics({"skipped": True, "skip_reason": -1})
        sys.exit(0)

    # Periodically clean up old state files (10% chance per run)
    if random.random() < 0.1:
        cleanup_old_state_files()

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        emit_metrics({"skipped": True, "skip_reason": -2})
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    hook_event_name = input_data.get("hook_event_name", "")
    debug_log(f"Processing: hook_event={hook_event_name}, tool={tool_name}")

    # Load project-specific security guidance and custom patterns once
    # per invocation. Failures are non-fatal (debug-logged) so a malformed
    # config never prevents the built-in checks from running.
    extensibility.load_for_session(input_data.get("cwd"))

    # Remote-pod SDK-bootstrap rescue: PostToolUse is the earliest hook event
    # that is guaranteed to fire *after* async plugin sync (its firing proves
    # the plugin is registered), so it's where we recover the SessionStart
    # bootstrap that remote pods miss under CLAUDE_CODE_SYNC_PLUGIN_INSTALL.
    # Fires on Edit/Write too (not just Bash), so the venv is usually built
    # before the first `git commit`.
    if hook_event_name == "PostToolUse":
        _maybe_bootstrap_agent_sdk_async()

    # Handle UserPromptSubmit — capture git baseline
    if hook_event_name == "UserPromptSubmit":
        handle_user_prompt_submit(input_data)
        return

    # Handle Stop hook — final security check
    if hook_event_name == "Stop":
        handle_stop_hook(input_data)
        return

    # Handle PostToolUse[Bash] — commit review or push sweep (asyncRewake).
    #
    # hooks.json has two `if` configs under the Bash matcher (`git commit:*`
    # and `git push:*`). CC evaluates each `if` independently and spawns this
    # script ONCE PER MATCH — so `git commit -m x && git push` spawns python
    # twice with the same command string and the same tool_use_id. The python
    # cannot tell which `if` fired it.
    #
    # Routing therefore MUST check commit FIRST so that compound commit+push
    # commands continue to hit commit-review (the pre-existing behaviour) on
    # the commit-matcher invocation. The push-matcher invocation of the SAME
    # compound command is deduped by `_claim_bash_hook_once` below: the second
    # spawn loses the tool_use_id sentinel race and exits early with
    # `bash_hook_dedup`, so commit-review runs exactly once. The alternative —
    # checking push first — would silently DROP commit-review
    # on `git commit && git push`, which is a regression.
    #
    # The push-sweep does NOT run on the compound call. That's acceptable: the
    # just-made commit is recorded by commit-review, so the next standalone
    # push sees it as reviewed and the sweep base advances past it. Older
    # unreviewed commits in the range are caught on that next push.
    if tool_name == "Bash" and hook_event_name == "PostToolUse":
        cmd = (input_data.get("tool_input") or {}).get("command", "") or ""
        if not (_GIT_COMMIT_RE.search(cmd) or _GIT_PUSH_RE.search(cmd)):
            return
        if not _claim_bash_hook_once(input_data):
            # Another spawn for this same tool_use_id already claimed the
            # work (compound matched multiple `if` configs). Emit a single
            # metric so telemetry can count how often the de-dupe kicks in.
            print(json.dumps({"metrics": {"bash_hook_dedup": True}}), flush=True)
            sys.exit(0)
        if _GIT_COMMIT_RE.search(cmd):
            handle_commit_review_posttooluse(input_data)
        elif _GIT_PUSH_RE.search(cmd):
            handle_push_sweep_posttooluse(input_data)
        return

    # Handle PostToolUse — pattern-based checks only (no LLM review per-edit)
    if tool_name in ["Edit", "Write", "MultiEdit", "NotebookEdit"]:
        file_path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        if not file_path:
            sys.exit(0)

        # Skip plan files
        plans_dir = os.path.expanduser("~/.claude/plans")
        if file_path.startswith(plans_dir):
            sys.exit(0)

        record_touched_path(session_id, file_path)

        content = extract_content_from_input(tool_name, tool_input)

        all_guidance = []
        raw_pattern_matches = []
        if ENABLE_PATTERN_RULES:
            pattern_matches = check_patterns(file_path, content)
            raw_pattern_matches = pattern_matches
            if pattern_matches:
                debug_log(f"Pattern matches for {file_path}: {[r for r, _ in pattern_matches]}")

            # For Write tool, filter out patterns that existed in the baseline version
            # This prevents flagging pre-existing insecure patterns when Claude rewrites a file
            if tool_name == "Write" and pattern_matches:
                cwd = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
                baseline_content = get_baseline_file_content(session_id, file_path, cwd)
                if baseline_content is not None:
                    baseline_matches = set(r for r, _ in check_patterns(file_path, baseline_content))
                    pattern_matches = [(r, msg) for r, msg in pattern_matches if r not in baseline_matches]
                    if pattern_matches:
                        debug_log(f"New patterns (not in baseline): {[r for r, _ in pattern_matches]}")
                    else:
                        debug_log("All patterns existed in baseline, skipping")

            for rule_name, reminder in pattern_matches:
                warning_key = f"{file_path}-{rule_name}"
                if atomic_check_and_mark_warning(session_id, warning_key):
                    all_guidance.append(reminder)

            # Record matched rules as pending so the Stop-hook sweep can
            # later tally fixed vs unresolved. Only runs when patterns match.
            if pattern_matches:
                record_pending_warnings(session_id, file_path,
                                        [r for r, _ in pattern_matches])

        # Emit metrics when raw patterns matched (even if all were baseline-suppressed
        # or dedup'd — pattern_hits reflects warnings actually shown, may be 0).
        # Gate on raw matches so clean edits don't flood the metrics event.
        #   rule_id:   RuleId of the first raw match (values stay small/enumerable in telemetry)
        #   rule_mask: bitmask of ALL raw matches — POPCOUNT gives raw hit count,
        #              (mask >> N) & 1 tests for a specific rule
        if raw_pattern_matches:
            raw_names = [r for r, _ in raw_pattern_matches]
            output = {"metrics": {
                "pattern_hits": len(all_guidance),
                # User-defined patterns (rule_name="user:*") have no static
                # RuleId; emit -1 so the metrics pipeline can distinguish.
                "rule_id": int(_RULE_NAME_TO_ID.get(raw_names[0], -1)),
                "rule_mask": rule_names_to_mask(raw_names),
                **({"pv": _PV} if _PV else {}),
            }}
            if all_guidance:
                output["hookSpecificOutput"] = {
                    "hookEventName": "PostToolUse",
                    "additionalContext": PROVENANCE_TAG + "\n\n" + "\n\n".join(all_guidance),
                }
            print(json.dumps(output))
        elif all_guidance:
            # Defensive: pattern rules disabled but guidance somehow set (shouldn't happen)
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": PROVENANCE_TAG + "\n\n" + "\n\n".join(all_guidance),
                }
            }))

    sys.exit(0)

if __name__ == "__main__":
    main()
