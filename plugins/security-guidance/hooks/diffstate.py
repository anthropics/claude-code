"""
Git-derived diff/review-state helpers for the security-guidance plugin.

Extracted from security_reminder_hook.py for readability. Re-exported
there so callers keep resolving bare names through the hook module's
globals — tests that ``monkeypatch.setattr(hook, "<fn>", …)`` continue
to work without retargeting.
"""
import os
import subprocess

from _base import debug_log, _PV
from gitutil import (
    GIT_CMD,
    _git_dir, _git_toplevel, _git_status_porcelain,
    _git_rev_parse_head, _is_ancestor, _git_name_only,
)
from session_state import with_locked_state


# =====================================================================
# TTL constants
# =====================================================================

# stop_hook_fire_count expires after this many seconds.
# The asyncRewake loop (vuln→exit(2)→fix→Stop again) is ~30-60s/cycle, so 120s
# comfortably contains MAX_STOP_HOOK_FIRINGS while letting the next user turn
# proceed unblocked. Replaces the UPS-reset that raced against background Stop.
STOP_LOOP_STATE_TTL_SEC = 120

# previous_findings expires independently. Dedup is content-based ((filePath,
# vulnerableCode) — see _record_fire), so a longer TTL suppresses exact-repeat
# re-flags across turns without masking regressions that change the code. v2's
# git-derived review set can re-surface the same uncommitted file across turns;
# 120s could let warnings pile up over a long session.
PREVIOUS_FINDINGS_TTL_SEC = int(os.environ.get("PREVIOUS_FINDINGS_TTL_SEC", "3600"))


# =====================================================================
# Git baseline + stop-state management
# =====================================================================

def save_baseline_sha(session_id, sha):
    """Save the git baseline SHA to state."""
    def _save(state):
        state["baseline_sha"] = sha
    with_locked_state(session_id, _save)


def load_baseline_sha(session_id):
    """Load the git baseline SHA from state."""
    def _load(state):
        return state.get("baseline_sha")
    return with_locked_state(session_id, _load)


def record_touched_path(session_id, file_path):
    """Append a file path to the touched_paths list (deduped, capped at 200).

    Stop is the consumer and clears under the same lock it reads with; UPS
    no longer wipes. The cap is a defensive bound for sessions where Stop
    never fires (disabled mid-session, abort) — git diff naturally filters
    stale paths so over-retention is harmless, just wasteful.
    """
    def _record(state):
        paths = state.setdefault("touched_paths", [])
        if file_path not in paths:
            paths.append(file_path)
            if len(paths) > 200:
                del paths[:len(paths) - 200]
    with_locked_state(session_id, _record)


def consume_stop_state(session_id):
    """Atomically snapshot all state the Stop hook needs and clear touched_paths.

    The Stop hook is asyncRewake — it runs in the background after Claude's
    turn ends. The user can submit a new prompt before this hook finishes its
    initial state read. Telemetry showed a meaningful share of would-be reviews lost when
    the next turn's UPS wiped touched_paths before Stop read it.

    Single locked read-then-clear closes that window: PostToolUse appends
    after this clear go into the next snapshot; UPS overwrites of baseline_sha
    after this snapshot are invisible to this Stop fire.
    """
    import time as _time
    now = _time.time()

    def _snap(state):
        fire_ts = state.get("stop_hook_fire_count_ts", 0)
        expired = (now - fire_ts) > STOP_LOOP_STATE_TTL_SEC
        findings_ts = state.get("previous_findings_ts", fire_ts)
        findings_expired = (now - findings_ts) > PREVIOUS_FINDINGS_TTL_SEC
        snap = {
            "touched_paths": list(state.get("touched_paths", [])),
            "baseline_sha": state.get("baseline_sha"),
            "head_at_capture": state.get("head_at_capture"),
            "untracked_at_baseline": (
                dict(state["untracked_at_baseline"])
                if isinstance(state.get("untracked_at_baseline"), dict) else {}
            ),
            "fire_count": 0 if expired else state.get("stop_hook_fire_count", 0),
            "fire_count_expired": expired and state.get("stop_hook_fire_count", 0) > 0,
            "previous_findings": [] if findings_expired else list(state.get("previous_findings", [])),
        }
        state["touched_paths"] = []
        return snap

    return with_locked_state(session_id, _snap) or {
        "touched_paths": [], "baseline_sha": None, "head_at_capture": None,
        "untracked_at_baseline": {},
        "fire_count": 0, "fire_count_expired": False, "previous_findings": [],
    }


def restore_unreviewed_stop_state(session_id, paths, baseline_sha):
    """Put consumed touched_paths back so the next Stop reviews them.

    consume_stop_state cleared touched_paths on disk; if Stop then exits
    early for a transient reason (CCR API unreachable, Haiku HTTP error)
    the next UPS would see an empty list, fall through the preservation
    guard, and re-baseline past the unreviewed edits. Restoring keeps the
    guard armed. Prepend+dedupe so any concurrent next-turn PostToolUse
    appends survive.
    """
    if not paths:
        return

    def _restore(state):
        existing = state.get("touched_paths", [])
        merged = list(dict.fromkeys(list(paths) + list(existing)))
        if len(merged) > 200:
            merged = merged[:200]
        state["touched_paths"] = merged
        if baseline_sha and not state.get("baseline_sha"):
            state["baseline_sha"] = baseline_sha
    with_locked_state(session_id, _restore)


def get_baseline_file_content(session_id, file_path, cwd):
    """Get the content of a file at the baseline SHA. Returns None if unavailable."""
    baseline_sha = load_baseline_sha(session_id)
    if not baseline_sha:
        return None
    try:
        abs_path = os.path.abspath(file_path)
        cwd_abs = os.path.abspath(cwd) if cwd else os.getcwd()
        try:
            rel_path = os.path.relpath(abs_path, cwd_abs)
        except ValueError:
            return None
        result = subprocess.run(
            [*GIT_CMD, "show", f"{baseline_sha}:{rel_path}"],
            cwd=cwd, capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return result.stdout
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def capture_git_baseline(cwd):
    """
    Capture a git ref representing the current working tree state.
    Uses `git stash create` which creates a commit object for the current state
    (HEAD + uncommitted changes) without modifying the stash list or working tree.
    Falls back to HEAD if the working tree is clean.
    Returns the SHA string, or None if not in a git repo or if the repo has no commits.

    NOTE: `git stash create` does NOT capture untracked files. UPS pairs this
    SHA with a `_list_untracked()` snapshot stored as `untracked_at_baseline`,
    and `compute_v2_review_set` subtracts that set so pre-existing untracked
    files are not reviewed as Claude-authored.
    """
    try:
        # Check if HEAD exists (i.e., repo has at least one commit)
        head_check = subprocess.run(
            [*GIT_CMD, "rev-parse", "HEAD"],
            cwd=cwd, capture_output=True, text=True, timeout=5
        )
        if head_check.returncode != 0:
            # No commits yet — skip review rather than creating commits in the user's repo
            debug_log("No commits in repo, skipping baseline capture")
            return None

        result = subprocess.run(
            [*GIT_CMD, "stash", "create"],
            cwd=cwd, capture_output=True, text=True, timeout=15
        )
        sha = result.stdout.strip()
        if sha:
            return sha

        # Working tree is clean — stash create returns empty. Use HEAD.
        result = subprocess.run(
            [*GIT_CMD, "rev-parse", "HEAD"],
            cwd=cwd, capture_output=True, text=True, timeout=5
        )
        sha = result.stdout.strip()
        return sha if sha else None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        debug_log(f"Failed to capture git baseline: {e}")
        return None


# ─── push-sweep reviewed-commit tracking ────────────────────────────────────
#
# Repo-local (not session-local) record of which commits the commit-review
# hook has already reviewed, so the push-sweep can advance its diff base past
# the contiguous reviewed prefix and skip entirely when everything pushed was
# already covered. Lives under `.git/` (same precedent as CC's
# `.git/claude-trailers`) so it survives across sessions and is per-clone.
#
# Format: one line per reviewed sha, append-only:
#   <40-hex-sha>\t<unix-ts>\t<pv>\t<vulns_found>
#
# The trailing columns are observability only — load reads just the sha set.
# GC keeps the last _REVIEWED_SHAS_CAP entries; the file is small (~64 bytes
# per line) so even at the cap it's ~32KB.


# =====================================================================
# Reviewed-SHA log (commit/push dedup)
# =====================================================================

# ─── push-sweep reviewed-commit tracking ────────────────────────────────────
#
# Repo-local (not session-local) record of which commits the commit-review
# hook has already reviewed, so the push-sweep can advance its diff base past
# the contiguous reviewed prefix and skip entirely when everything pushed was
# already covered. Lives under `.git/` (same precedent as CC's
# `.git/claude-trailers`) so it survives across sessions and is per-clone.
#
# Format: one line per reviewed sha, append-only:
#   <40-hex-sha>\t<unix-ts>\t<pv>\t<vulns_found>
#
# The trailing columns are observability only — load reads just the sha set.
# GC keeps the last _REVIEWED_SHAS_CAP entries; the file is small (~64 bytes
# per line) so even at the cap it's ~32KB.

_REVIEWED_SHAS_BASENAME = "sg-reviewed-shas"
_REVIEWED_SHAS_CAP = 500

def _reviewed_shas_path(repo_root):
    gd = _git_dir(repo_root)
    return os.path.join(gd, _REVIEWED_SHAS_BASENAME) if gd else None


def _load_reviewed_shas(repo_root):
    """Set of full 40-hex shas previously reviewed in this clone."""
    p = _reviewed_shas_path(repo_root)
    if not p or not os.path.exists(p):
        return set()
    out = set()
    try:
        with open(p, "r") as f:
            for line in f:
                sha = line.split("\t", 1)[0].strip()
                if len(sha) == 40 and all(c in "0123456789abcdef" for c in sha):
                    out.add(sha)
    except OSError:
        pass
    return out


def _append_reviewed_shas(repo_root, shas, vulns_found=0):
    """Record that `shas` were reviewed. Best-effort; never raises.

    Uses fcntl.flock for the read-gc-write; appends are O_APPEND-atomic but
    GC needs the lock so concurrent CC sessions in the same clone don't race
    each other's truncation.
    """
    p = _reviewed_shas_path(repo_root)
    if not p or not shas:
        return
    import time as _time
    ts = int(_time.time())
    pv = _PV or 0
    lines = [f"{s}\t{ts}\t{pv}\t{int(vulns_found)}\n" for s in shas]
    try:
        import fcntl
        with open(p, "a+") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                f.seek(0)
                existing = f.read().splitlines(keepends=True)
                # Dedup by sha (first column) — keep newest, then cap.
                seen = set()
                merged = []
                for ln in (existing + lines)[::-1]:
                    sha = ln.split("\t", 1)[0].strip()
                    if sha and sha not in seen:
                        seen.add(sha)
                        merged.append(ln if ln.endswith("\n") else ln + "\n")
                merged = merged[:_REVIEWED_SHAS_CAP][::-1]
                f.seek(0)
                f.truncate()
                f.writelines(merged)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except (OSError, ImportError):
        # fcntl unavailable (Windows) or write failed — degrade to plain
        # append; cap enforcement happens on the next locked write.
        try:
            with open(p, "a") as f:
                f.writelines(lines)
        except OSError:
            pass


# =====================================================================
# v2 review-set computation (Stop hook)
# =====================================================================

UNTRACKED_BASELINE_CAP = 2000


def _list_untracked(cwd):
    """Repo-root-relative untracked (and not-ignored) path → mtime_ns, or {}
    on error. Used at UPS to snapshot the pre-turn untracked set so the Stop
    hook can exclude unchanged pre-existing untracked files from review.
    mtime is captured so an in-place edit during the turn is still reviewed.

    Uses ls-files (not status) for the UPS path: the index diff isn't needed,
    and ls-files --others only walks the worktree against .gitignore."""
    try:
        repo = _git_toplevel(cwd) or cwd
        r = subprocess.run(
            [*GIT_CMD, "-c", "core.quotePath=false", "ls-files",
             "--others", "--exclude-standard", "-z"],
            cwd=repo, capture_output=True, text=True, timeout=15,
        )
        if r.returncode != 0:
            debug_log(f"_list_untracked rc={r.returncode}: {r.stderr[:200]}")
            return {}
        out = {}
        for p in r.stdout.split("\0"):
            if not p:
                continue
            try:
                out[p] = os.stat(os.path.join(repo, p)).st_mtime_ns
            except OSError:
                out[p] = 0
            if len(out) >= UNTRACKED_BASELINE_CAP:
                debug_log(f"_list_untracked: capped at {UNTRACKED_BASELINE_CAP}")
                break
        return out
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        debug_log(f"_list_untracked error: {e}")
        return {}

def compute_v2_review_set(cwd, baseline_sha, head_at_capture, untracked_at_baseline=None):
    """v2 diff strategy: derive the review set from git state alone.

    review_set = (files dirty vs current HEAD, plus files committed this turn
    when HEAD advanced linearly) ∩ (files whose content differs from the
    pre-turn stash baseline). The first term is immune to checkout/pull
    ballooning; the second filters out the user's untouched pre-turn WIP.
    Falls back to dirty_now alone when no baseline is available.

    untracked_at_baseline: {repo-root-relative path: mtime_ns} captured at
    UPS. `git stash create` doesn't include untracked files, so without this
    snapshot a pre-existing untracked file looks "new since baseline" forever.
    A file is excluded only if it was untracked at baseline AND its mtime is
    unchanged — an in-place edit during the turn is still reviewed.

    Known limitation: a Bash-only turn that's interrupted before Stop fires
    leaves touched_paths empty, so the next UPS re-baselines past those edits.
    v1 never reviews Bash-only turns at all, so v2 is no worse there.

    Returns (absolute paths sorted, diff_base, repo_root, metrics).
    diff_base is "HEAD" unless HEAD advanced linearly this turn (commits),
    in which case it's head_at_capture so committed files produce a diff.
    repo_root is the git toplevel — `git diff --name-only` outputs paths
    relative to it (not to cwd), so the caller's get_git_diff must run
    from there too or pathspecs won't match.

    Also returns the untracked subset of review_set so get_git_diff can do
    a targeted `add -N -- <files>` instead of a whole-tree scan.
    """
    repo = _git_toplevel(cwd) or cwd
    if not isinstance(untracked_at_baseline, dict):
        untracked_at_baseline = {}

    tracked_dirty, untracked = _git_status_porcelain(repo)
    if tracked_dirty is None:
        return [], "HEAD", repo, [], {"dirty_now_count": -1, "changed_since_count": -1, "review_set_count": 0}

    def _unchanged_since_baseline(p):
        base_mtime = untracked_at_baseline.get(p)
        if base_mtime is None:
            return False
        try:
            return os.stat(os.path.join(repo, p)).st_mtime_ns == base_mtime
        except OSError:
            return False

    preexisting_unchanged = {p for p in untracked if _unchanged_since_baseline(p)}
    new_untracked = untracked - preexisting_unchanged
    dirty_now = tracked_dirty | new_untracked

    diff_base = "HEAD"
    current_head = _git_rev_parse_head(repo)
    if (head_at_capture and current_head and head_at_capture != current_head
            and _is_ancestor(repo, head_at_capture, current_head)):
        dirty_now |= _git_name_only(repo, f"{head_at_capture}..HEAD") or set()
        diff_base = head_at_capture

    # changed_since: tracked files vs the stash baseline (no temp index — the
    # stash never contained untracked files anyway), then union with
    # currently-untracked. The previous `include_untracked=True` arm cost a
    # full `git add -N .` (slow in large repos) per call to surface
    # untracked files in the diff output — but `git diff <stash>` already
    # lists them as "only in worktree" without that, and we have the explicit
    # set from status regardless.
    if baseline_sha:
        changed_since = _git_name_only(repo, baseline_sha)
        if changed_since is not None:
            changed_since |= new_untracked
    else:
        changed_since = None
    # changed_since is None on missing baseline OR on git error (e.g. the
    # dangling stash SHA was pruned). Either way, don't intersect with ∅ —
    # that would silently zero the review set. Fall back to dirty_now.
    review_set = (dirty_now & changed_since) if changed_since is not None else dirty_now

    review_paths = [os.path.join(repo, p) for p in sorted(review_set)]
    untracked_in_review = sorted(new_untracked & review_set)
    metrics = {
        "dirty_now_count": len(dirty_now),
        "changed_since_count": len(changed_since) if changed_since is not None else -1,
        "review_set_count": len(review_set),
    }
    # Only emit when nonzero to stay under the 10-key telemetry cap.
    if preexisting_unchanged:
        metrics["preexisting_untracked_excluded"] = len(preexisting_unchanged)
    return review_paths, diff_base, repo, untracked_in_review, metrics
