"""
Leaf git/subprocess helpers and diff parsing for the security-guidance plugin.

Everything here is a thin wrapper over ``git``/``subprocess`` plus pure
diff-text parsing and source-file classification. None of these functions
reference any name that the test suite monkeypatches on
``security_reminder_hook`` and then calls *through* another function in this
module — that property is what makes them safe to live in their own module
while still being re-exported (so tests that patch ``hook._git_toplevel`` and
then call a handler in ``security_reminder_hook`` continue to see the patched
binding).

Functions that DO compose patched leaves (``compute_v2_review_set``,
``_list_untracked``, ``_append_reviewed_shas``) deliberately remain in
``security_reminder_hook.py`` for that reason.
"""
import contextlib
import os
import re
import subprocess

from _base import debug_log


GIT_CMD = [
    "git",
    "-c", "core.fsmonitor=false",
    "-c", "core.hooksPath=/dev/null",
    # core.quotePath=false: emit raw UTF-8 in path-emitting commands instead
    # of C-quoting non-ASCII bytes (default `"\\303\\201vila/..."` vs
    # `Ávila/...`). Downstream parsers — both ours (parse_diff_into_files,
    # extract_file_paths_from_diff) and Python stdlib (os.path.isabs,
    # os.path.join) — expect raw paths and silently drop / mishandle the
    # quoted form. Adding the flag globally to GIT_CMD covers every
    # subprocess.run site that uses the splat — diff feeders, rev-parse
    # path queries (--show-toplevel, --git-dir, --git-common-dir),
    # reflog %gs subjects, ls-files, status, etc. — without per-site
    # flag duplication. See #2082, #2099.
    "-c", "core.quotePath=false",
    # A work-tree `git diff` that meets stat-stale entries (mtime changed,
    # content same) rewrites the index under index.lock, GIT_OPTIONAL_LOCKS or
    # not. Off, every diff here only reads the index, so none needs a copy.
    "-c", "diff.autoRefreshIndex=false",
]

SAFE_GIT_CONFIG = (
    ("core.fsmonitor", "false"),
    ("core.hooksPath", "/dev/null"),
)

# The hook's git runs in the background beside the session's own git. Without
# this, `git status` holds .git/index.lock while it writes back a refreshed
# index: a concurrent `git add` fails, and a timeout kill leaves the lock.
SAFE_GIT_ENV = {
    "GIT_OPTIONAL_LOCKS": "0",
}


def git_config_env(pairs, base=None):
    base = os.environ if base is None else base
    try:
        n = max(0, int(base.get("GIT_CONFIG_COUNT") or 0))
    except (TypeError, ValueError):
        n = 0
    env = {}
    for i, (k, v) in enumerate(pairs, start=n):
        env[f"GIT_CONFIG_KEY_{i}"] = k
        env[f"GIT_CONFIG_VALUE_{i}"] = v
    env["GIT_CONFIG_COUNT"] = str(n + len(pairs))
    return env


def apply_safe_git_env():
    os.environ.update(git_config_env(SAFE_GIT_CONFIG))
    os.environ.update(SAFE_GIT_ENV)


def _git_rev_parse_head(cwd):
    """Return the current HEAD SHA, or None if not a git repo / no commits."""
    try:
        # See #2099: text=True on Windows cp1252 crashes the reader thread on
        # any UTF-8 byte undefined in cp1252 (e.g. via a git error message
        # referencing a non-ASCII filename in stderr). stdout is a SHA so it
        # IS safe; stderr is not. capture_output=True with bytes-by-default
        # never decodes, so the reader thread can't crash.
        result = subprocess.run(
            [*GIT_CMD, "rev-parse", "HEAD"],
            cwd=cwd, capture_output=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.decode("utf-8", errors="replace").strip()
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None




def _find_git_index(cwd):
    """
    Find the real index file for a git repo. Handles worktrees where .git
    is a file pointing to the main repo's gitdir.
    Returns the absolute path to the index file, or None.
    """
    try:
        # See #2099: stdout here is a PATH which can contain non-ASCII bytes
        # (e.g. C:\אבטחה\repo\.git). text=True decodes via cp1252 strict on
        # Windows → crashes the reader thread → returns stdout=None →
        # caller does .strip() on None → AttributeError. Decode manually.
        result = subprocess.run(
            [*GIT_CMD, "rev-parse", "--git-dir"],
            cwd=cwd, capture_output=True, timeout=5
        )
        if result.returncode != 0:
            return None
        git_dir = result.stdout.decode("utf-8", errors="replace").strip()
        if not os.path.isabs(git_dir):
            git_dir = os.path.join(cwd, git_dir)
        index_path = os.path.join(git_dir, "index")
        return index_path if os.path.isfile(index_path) else None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def _diff_pathspec(cwd, paths):
    """Convert absolute touched-paths to repo-relative pathspec args for
    git diff. Paths outside cwd (e.g. ~/.claude/…) are dropped. Returns the
    list to splice after `--`, or [] for an unrestricted diff. realpath both
    sides so the macOS /var ↔ /private/var symlink doesn't make in-repo
    paths look external."""
    if not paths:
        return []
    cwd_abs = os.path.realpath(cwd)
    rel = []
    for p in paths:
        try:
            r = os.path.relpath(os.path.realpath(p), cwd_abs)
        except ValueError:
            continue
        if r.startswith(".."):
            continue
        rel.append(r)
    return ["--"] + rel if rel else []


_TEMP_INDEX_PREFIX = "security_hook_idx_"
# A copy is named <prefix>pid<hook pid>_<8 random chars>, so a later run can
# tell that the hook which made it is gone. Names from earlier releases have
# only the 8 random characters and never match.
_OWNER_PID = re.compile(re.escape(_TEMP_INDEX_PREFIX) + r"pid(\d+)_[^.]{8}(?:\.|$)")
# A live copy is in use for under a minute (a couple of bounded git calls), so
# anything this old belongs to a run that was killed.
_TEMP_INDEX_STALE_S = 1800
# Unlinking index-sized files is slow; a large backlog drains over several
# calls instead of stalling one hook past its timeout.
_SWEEP_BUDGET_S = 2


def _owner_is_gone(name):
    """True when `name` records the pid of the hook that made it and no such
    process exists. A reused pid reads as alive: the file then waits for the
    age limit. Never probes on Windows, where os.kill would end the process."""
    if not hasattr(os, "getuid"):
        return False
    m = _OWNER_PID.match(name)
    if not m:
        return False
    try:
        os.kill(int(m.group(1)), 0)
    except ProcessLookupError:
        return True
    except (OSError, OverflowError, ValueError):
        return False
    return False


def _sweep_stale_indexes(dirpath, uid):
    """Delete index copies in `dirpath` that a killed run left behind. Only
    regular files owned by `uid` (None: no ownership check) are touched.

    A copy goes as soon as the hook that made it is gone: a killed hook can
    leave one per run, and index-sized files fill a disk long before the age
    limit. The age limit covers names without a pid and reused pids.

    Age is the newer of mtime and ctime: a copy keeps .git/index's mtime,
    which may be days old, so mtime alone would delete a file that another
    running hook is still using."""
    import stat
    import time
    cutoff = time.time() - _TEMP_INDEX_STALE_S
    deadline = time.monotonic() + _SWEEP_BUDGET_S
    try:
        names = os.listdir(dirpath)
    except OSError:
        return
    for name in names:
        if not name.startswith(_TEMP_INDEX_PREFIX):
            continue
        p = os.path.join(dirpath, name)
        try:
            st = os.lstat(p)
            if not stat.S_ISREG(st.st_mode):
                continue
            if uid is not None and st.st_uid != uid:
                continue
            if max(st.st_mtime, st.st_ctime) < cutoff or _owner_is_gone(name):
                os.unlink(p)
                if time.monotonic() > deadline:
                    return
        except OSError:
            pass


def _sweep_stale_stash_indexes(real_index):
    """Delete `<index>.stash.<pid>` files a killed `git stash create` left
    next to the real index. Releases before 2.0.10 ran it there, so a clone
    can hold hundreds, each the size of the index, and nothing else removes
    them. Only our own regular files past the age limit go: git keeps one for
    seconds. `index.lock` is never touched; a live git may hold it."""
    import stat
    import time
    uid = os.getuid() if hasattr(os, "getuid") else None
    cutoff = time.time() - _TEMP_INDEX_STALE_S
    deadline = time.monotonic() + _SWEEP_BUDGET_S
    dirpath = os.path.dirname(real_index)
    stale = re.compile(re.escape(os.path.basename(real_index)) + r"\.stash\.\d+$")
    try:
        names = os.listdir(dirpath)
    except OSError:
        return
    for name in names:
        if not stale.match(name):
            continue
        p = os.path.join(dirpath, name)
        try:
            st = os.lstat(p)
            if not stat.S_ISREG(st.st_mode):
                continue
            if uid is not None and st.st_uid != uid:
                continue
            if max(st.st_mtime, st.st_ctime) < cutoff:
                os.unlink(p)
                if time.monotonic() > deadline:
                    return
        except OSError:
            pass


# Index copies this process has made and not yet removed.
_live_copies = set()

# A hook working on a copy needs up to three times the index's size for a
# moment (the copy, and git's rewrite and stash index next to it). With many
# agents in one clone that alone can fill a disk, so only so many hooks per
# user work on a copy at once; the others wait, then go without.
_MAX_LIVE_COPIES = 8
_SLOT_WAIT_S = 5


def _copy_slots(tmpdir, index_bytes):
    """How many hooks may work on a copy at once: what fits into a quarter of
    the free space at three times the index each, from 1 to
    _MAX_LIVE_COPIES."""
    import shutil
    try:
        free = shutil.disk_usage(tmpdir).free
    except OSError:
        return 1
    return max(1, min(_MAX_LIVE_COPIES, free // (12 * max(index_bytes, 1))))


@contextlib.contextmanager
def _copy_slot(tmpdir, index_bytes=0):
    """Hold one of the copy slots; yields False when none came free in
    _SLOT_WAIT_S. A slot is an flock, so the kernel frees it when its holder
    dies, however it dies. No cap without flock or a private dir."""
    import time
    try:
        import fcntl
    except ImportError:
        fcntl = None
    if fcntl is None or tmpdir is None:
        yield True
        return
    deadline = time.monotonic() + _SLOT_WAIT_S
    held = None
    while held is None:
        for i in range(_copy_slots(tmpdir, index_bytes)):
            try:
                fd = os.open(os.path.join(tmpdir, f"slot{i}.lock"),
                             os.O_RDWR | os.O_CREAT, 0o600)
            except OSError:
                continue
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                held = fd
                break
            except OSError:
                os.close(fd)
        if held is None:
            if time.monotonic() >= deadline:
                break
            time.sleep(0.1)
    try:
        yield held is not None
    finally:
        if held is not None:
            os.close(held)


def _remove_copy(tmp_index):
    """Remove an index copy and the files git wrote next to it."""
    import glob
    for p in glob.glob(glob.escape(tmp_index) + "*"):
        try:
            os.unlink(p)
        except OSError:
            pass


def remove_copies_on_termination():
    """Remove this process's index copies when it is told to terminate.
    Python's default SIGTERM action ends the process without running
    `finally`, which left an index-sized file behind each time."""
    import signal

    def _on_term(signum, _frame):
        for tmp_index in list(_live_copies):
            _remove_copy(tmp_index)
        os._exit(128 + signum)

    try:
        signal.signal(signal.SIGTERM, _on_term)
    except (ValueError, OSError, AttributeError):
        pass  # not the main thread, or no SIGTERM here


def _hook_tmpdir():
    """Private per-user directory for throwaway index copies, or None to use
    the bare temp dir.

    An index copy can be hundreds of MB and a killed hook cannot clean up, so
    copies live in one 0700 directory and anything stale is swept on entry,
    here and in the bare temp dir. The name is predictable and the temp dir
    may be shared, so anything that is not a real directory we own is
    refused. Windows has no uid and its temp dir is already per-user."""
    import stat
    import tempfile
    base = tempfile.gettempdir()
    uid = os.getuid() if hasattr(os, "getuid") else None
    _sweep_stale_indexes(base, uid)
    if uid is None:
        return None
    d = os.path.join(base, f"claude-security-guidance-{uid}")
    try:
        os.mkdir(d, 0o700)
    except FileExistsError:
        pass
    except OSError:
        return None
    try:
        st = os.lstat(d)
    except OSError:
        return None
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != uid:
        return None
    try:
        os.chmod(d, 0o700)
    except OSError:
        pass
    _sweep_stale_indexes(d, uid)
    return d


@contextlib.contextmanager
def _temp_index(cwd, untracked_paths=None):
    """Yield an env dict pointing GIT_INDEX_FILE at a throwaway copy of the
    repo's index with `git add --intent-to-add` applied, so untracked files
    show up in subsequent `git diff` calls without touching the user's real
    index. Yields None if no index can be found (bare repo / not a repo) or
    no copy slot came free; the caller should fall back to a plain diff.
    Always cleans up the temp file.

    Perf: when `untracked_paths` is given, only those paths are added (O(n)
    in untracked count). The default `add -N .` stats every file in the
    worktree — slow in large repos vs fast targeted scan. v2 callers
    already know the untracked set from `git status --porcelain`, so they
    pass it; v1 keeps the whole-tree scan since it has no prior list.

    Cleanup removes `<tmp_index>*`, not just the copy: git writes
    `<index>.lock` and `<index>.stash.<pid>` next to the index it is given and
    cannot remove them itself when a subprocess timeout kills it."""
    real_index = _find_git_index(cwd)
    if not real_index:
        yield None
        return

    _sweep_stale_stash_indexes(real_index)
    tmpdir = _hook_tmpdir()
    try:
        index_bytes = os.path.getsize(real_index)
    except OSError:
        index_bytes = 0
    with _copy_slot(tmpdir, index_bytes) as got_slot:
        if not got_slot:
            debug_log("no index copy slot came free; going without a copy")
            yield None
            return
        with _copied_index(cwd, real_index, tmpdir, untracked_paths) as env:
            yield env


@contextlib.contextmanager
def _copied_index(cwd, real_index, tmpdir, untracked_paths):
    import shutil
    import tempfile

    tmp_fd, tmp_index = tempfile.mkstemp(
        prefix=f"{_TEMP_INDEX_PREFIX}pid{os.getpid()}_", dir=tmpdir)
    os.close(tmp_fd)
    _live_copies.add(tmp_index)
    try:
        # A hard link where the filesystem allows it: no bytes are copied, and
        # git never writes an index in place (it renames a new file over it),
        # so the real index cannot change through the link. Either way the
        # copy must keep .git/index's mtime (copy2, not copyfile): git
        # re-reads any file whose mtime is not older than the index file's,
        # and with a fresh mtime it would miss a same-size edit made in the
        # same second as the last index write.
        try:
            os.unlink(tmp_index)
            os.link(real_index, tmp_index)
        except (OSError, NotImplementedError, AttributeError):
            shutil.copy2(real_index, tmp_index)
        env = {**os.environ, "GIT_INDEX_FILE": tmp_index}
        if untracked_paths is None:
            add_args = ["."]
        elif untracked_paths:
            # `git add -N -- a b nonexistent` is atomic — one missing path
            # makes it exit 128 and add NOTHING, so a file removed between
            # `git status` and here would silently drop ALL untracked files
            # from the diff. --ignore-missing only works with --dry-run, so
            # filter to surviving paths (lexists so dangling symlinks count).
            surviving = [p for p in untracked_paths
                         if os.path.lexists(os.path.join(cwd, p))]
            add_args = ["--"] + surviving if surviving else None
        else:
            add_args = None
        if add_args:
            # No stdout used here (only returncode matters), but text=True
            # still spawns reader threads that decode stderr — git error
            # messages can reference non-ASCII filenames and crash on
            # cp1252. See #2099. Drop text=True so bytes stay raw.
            subprocess.run(
                [*GIT_CMD, "add", "--intent-to-add"] + add_args,
                cwd=cwd, capture_output=True, timeout=10,
                env=env,
            )
        yield env
    finally:
        _remove_copy(tmp_index)
        _live_copies.discard(tmp_index)


def _git_toplevel(cwd):
    """Absolute repo root for `cwd`, or None if not in a work tree."""
    try:
        # See #2099: stdout is a PATH — `C:\אבטחה\repo` returned as UTF-8
        # bytes by git. text=True would decode via cp1252 strict on Windows
        # → reader-thread crash. Decode manually with errors="replace".
        r = subprocess.run(
            [*GIT_CMD, "rev-parse", "--show-toplevel"],
            cwd=cwd, capture_output=True, timeout=5,
        )
        if r.returncode != 0:
            return None
        path = r.stdout.decode("utf-8", errors="replace").strip()
        return path if path else None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def _git_dir(repo_root):
    """Absolute shared `.git` directory for repo_root.

    Uses `rev-parse --git-common-dir` so linked worktrees resolve to the
    SHARED gitdir, not the per-worktree `.git/worktrees/<name>/`. That way
    push-sweep's reviewed-shas record (and the bash-hook-once sentinel)
    is per-clone — a commit reviewed in one worktree counts as reviewed
    if a different worktree later pushes it. Returns None on failure so
    callers can degrade (push-sweep state is best-effort).
    """
    try:
        # See #2099: stdout is a PATH (shared gitdir), may be non-ASCII.
        # Decode bytes manually to avoid cp1252 reader-thread crash.
        r = subprocess.run(
            [*GIT_CMD, "rev-parse", "--git-common-dir"],
            cwd=repo_root, capture_output=True, timeout=5,
        )
        if r.returncode != 0:
            return None
        d = r.stdout.decode("utf-8", errors="replace").strip()
        return d if os.path.isabs(d) else os.path.join(repo_root, d)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def _git_rev_list_range(repo_root, base, head="HEAD"):
    """Shas in `base..head`, oldest→newest. Empty list on error."""
    try:
        # See #2099: stdout is ASCII SHAs, but stderr can carry git error
        # messages referencing non-ASCII filenames — keep bytes raw.
        r = subprocess.run(
            [*GIT_CMD, "rev-list", "--reverse", f"{base}..{head}"],
            cwd=repo_root, capture_output=True, timeout=10,
        )
        if r.returncode != 0:
            return []
        return [s for s in r.stdout.decode("utf-8", errors="replace").strip().split("\n") if s]
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return []


def _git_diff_range(repo_root, base, head="HEAD"):
    """`git diff -p base head` as text on success, None on error.

    Distinguishing failure from success-with-empty-diff matters: the push-sweep
    caller marks the tail reviewed when the diff is empty (nothing to review),
    but on failure (timeout, non-zero exit, missing git) it must NOT mark
    them reviewed — otherwise unreviewed commits get permanently silenced.
    """
    try:
        # GIT_CMD globally passes core.quotePath=false (see definition) so
        # non-ASCII paths in `diff --git a/... b/...` headers come through as
        # raw UTF-8, not C-quoted. Required by the downstream
        # parse_diff_into_files / extract_file_paths_from_diff regex.
        r = subprocess.run(
            [*GIT_CMD, "diff", "-p", "--no-color", "--no-ext-diff", "--no-textconv", base, head],
            cwd=repo_root, capture_output=True, timeout=30,
        )
        if r.returncode != 0:
            return None
        return r.stdout.decode("utf-8", errors="replace")
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def _detect_main_branch(repo_root):
    for ref in ("origin/HEAD", "origin/main", "origin/master", "main", "master"):
        try:
            # See #2099: stdout is a SHA but stderr can carry non-ASCII git
            # warnings — keep bytes raw to avoid cp1252 reader-thread crash.
            r = subprocess.run(
                [*GIT_CMD, "rev-parse", "--verify", "-q", ref],
                cwd=repo_root, capture_output=True, timeout=5,
            )
            if r.returncode == 0 and r.stdout.strip():
                return ref
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass
    return None


def _git_reflog_recent_commits(repo_root, max_age_s=120, max_n=5):
    """Return (fresh_commit_shas, stale_count) from the HEAD reflog.

    Scans the last `max_n` reflog entries and returns the SHAs whose action is
    `commit*` AND whose commit timestamp is within `max_age_s` of now,
    newest-first. `stale_count` is the number of commit-action entries that
    were too old (so the caller can distinguish "no commit happened" from
    "commit happened earlier than the window").

    Used by commit-review when stdout-based `[branch sha]` detection fails
    (output piped/redirected/-q, or a chained command after `git commit`
    pushed the success line off — `git commit && git push` makes HEAD@{0}
    `update by push`, not `commit:`). The HEAD@{0}-only check
    keeps the not-yet-visible-HEAD skip rare; analysis showed the
    residual is dominated by these chained-command and noop-guard cases.

    Safety vs. blindly reading HEAD:
      - cross-repo (`cd ../other && git commit`): repo_root's own reflog has
        no fresh commit, so this returns ([], 0).
      - commit actually failed (pre-commit reject, nothing-staged): reflog's
        recent entries are the prior checkout/commit/reset → ([], 0) or only
        stale entries.
      - HEAD raced ahead (a second commit landed before this async hook ran):
        both commits appear in the scan and both get reviewed — correct.
      - prior Bash call's commit within the window: would be returned here,
        but the call site deduplicates against `.git/sg-reviewed-shas` so a
        SHA is reviewed at most once. This is also the non-overlap invariant
        with push-sweep.
    """
    if not repo_root:
        return [], 0
    try:
        # %gs (the reflog subject) is `commit: <commit-msg first line>` and can
        # contain `|`; put it LAST so split("|", 2) leaves it intact. %H is
        # hex and %ct is integer, so the first two fields are delimiter-safe.
        #
        # Bytes + decode utf-8/replace: %gs embeds commit-message subjects
        # which git stores as raw bytes — commits can be authored in
        # latin-1 / cp1252 / shift-jis etc., and text=True would raise
        # UnicodeDecodeError in the subprocess reader thread on Windows
        # cp1252 (subprocess.run returns r.stdout=None, then
        # r.stdout.splitlines() AttributeErrors). Mirrors the existing
        # migration at security_reminder_hook.py:540 — same pattern was
        # missed here. See anthropics/claude-plugins-official#2056.
        r = subprocess.run(
            [*GIT_CMD, "log", "-g", "-n", str(max_n),
             "--format=%H|%ct|%gs", "HEAD"],
            cwd=repo_root, capture_output=True, timeout=5,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
        return [], 0
    if r.returncode != 0:
        return [], 0
    stdout = (r.stdout or b"").decode("utf-8", errors="replace")
    import time as _time
    now = int(_time.time())
    fresh, stale = [], 0
    for idx, line in enumerate(stdout.splitlines()):
        parts = line.split("|", 2)
        if len(parts) != 3:
            continue
        sha, ct, subject = parts
        # `commit: msg`, `commit (amend): msg`, `commit (initial): msg`,
        # `commit (merge): msg` — all create a reviewable commit object.
        if not subject.startswith("commit"):
            continue
        try:
            age = now - int(ct)
        except ValueError:
            continue
        # HEAD@{0} (idx==0) is exempt from the age gate. The gate exists to
        # bound the WIDENED HEAD@{1..max_n-1} scan from picking up commits
        # made by *prior* Bash calls; HEAD@{0} is by definition the most
        # recent reflog entry and was previously accepted unconditionally
        # (_git_reflog_head_if_just_committed previously had no age check).
        # Applying max_age_s to idx==0 made the not-yet-visible-HEAD skip
        # noticeably more frequent on chained
        # `git commit && <slow command>` where %ct is >120s old by the
        # time the async PostToolUse hook fires.
        if idx == 0 or age <= max_age_s:
            fresh.append(sha)
        else:
            stale += 1
    return fresh, stale


def _git_name_only(cwd, base, include_untracked=False):
    """Return the set of repo-root-relative paths that differ from `base`,
    or None if git failed (unresolvable ref, not a repo, timeout). Callers
    must distinguish None (error → don't trust as a filter) from set()
    (genuinely nothing changed). `-c core.quotePath=false -z` keeps non-ASCII
    and space-containing paths intact.

    Against the work tree the set can also hold a file whose stat changed and
    whose content did not: the diff does not refresh the index. Callers
    intersect with `git status`, which compares content."""
    # Decode stdout/stderr as UTF-8 with errors="replace" instead of using
    # text=True. core.quotePath=false makes git emit raw UTF-8 for non-ASCII
    # paths, and text=True on Windows decodes via cp1252 strict — a non-ASCII
    # changed path would crash the subprocess reader thread, leave
    # result.stdout=None, and propagate AttributeError out of the helper.
    # Same fix shape as diffstate._list_untracked. See #2056.
    def _run(env):
        # core.quotePath=false comes from GIT_CMD globally (see definition).
        result = subprocess.run(
            [*GIT_CMD, "diff", "--name-only", "-z", base],
            cwd=cwd, capture_output=True, timeout=30,
            env=env,
        )
        if result.returncode != 0:
            stderr_str = (result.stderr or b"").decode("utf-8", errors="replace")
            debug_log(f"_git_name_only({base!r}) rc={result.returncode}: {stderr_str[:200]}")
            return None
        stdout = (result.stdout or b"").decode("utf-8", errors="replace")
        return {p for p in stdout.split("\0") if p}

    try:
        # The diff only reads the index (diff.autoRefreshIndex is off in
        # GIT_CMD); a copy is for `add -N` alone.
        if not include_untracked:
            return _run(None)
        with _temp_index(cwd) as env:
            return _run(env)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError) as e:
        debug_log(f"_git_name_only({base!r}) error: {e}")
        return None


def _git_status_porcelain(cwd):
    """One `git status --porcelain=v1 -z` → (tracked_dirty, untracked) sets of
    repo-root-relative paths, or (None, None) on error. Replaces the
    `_temp_index + git diff HEAD --name-only` pair for the v2 dirty_now
    computation: faster in large repos, and yields the
    untracked set separately so the later get_git_diff can do a targeted
    `add -N -- <files>` instead of a whole-tree `add -N .`.

    -uall: list individual files inside untracked directories (default
    collapses to `dir/`). Required so the untracked set subtracts cleanly
    against the UPS-time `_list_untracked` snapshot, which uses ls-files and
    therefore always lists individual files."""
    # Lenient decode: same UTF-8 + errors="replace" pattern as the
    # sibling helpers — a non-ASCII path in the worktree would otherwise
    # crash the cp1252 reader thread on Windows. See #2056.
    try:
        # core.quotePath=false comes from GIT_CMD globally (see definition).
        r = subprocess.run(
            [*GIT_CMD, "status", "--porcelain=v1", "-uall", "-z"],
            cwd=cwd, capture_output=True, timeout=30,
        )
        if r.returncode != 0:
            stderr_str = (r.stderr or b"").decode("utf-8", errors="replace")
            debug_log(f"_git_status_porcelain rc={r.returncode}: {stderr_str[:200]}")
            return None, None
        tracked, untracked = set(), set()
        stdout = (r.stdout or b"").decode("utf-8", errors="replace")
        entries = stdout.split("\0")
        i = 0
        while i < len(entries):
            e = entries[i]
            if not e:
                i += 1
                continue
            xy, path = e[:2], e[3:]
            if xy == "??":
                untracked.add(path)
            else:
                tracked.add(path)
                # Rename/copy entries are XY old\0new\0 — second NUL field is
                # the origin path; consume it so it isn't misparsed as a new
                # 2-char-status entry.
                if "R" in xy or "C" in xy:
                    i += 1
            i += 1
        return tracked, untracked
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError) as e:
        # ValueError guards against any future strict-decode regression
        # so the helper degrades to (None, None) instead of crashing.
        debug_log(f"_git_status_porcelain error: {e}")
        return None, None



def _is_ancestor(cwd, maybe_ancestor, descendant):
    """True if `maybe_ancestor` is reachable from `descendant` (i.e. HEAD
    moved forward via commit/merge, not sideways via checkout)."""
    try:
        # See #2099: only returncode matters, but text=True spawns reader
        # threads that decode stderr — git error messages can carry non-ASCII
        # filenames. Drop text=True to keep bytes raw, avoid cp1252 crash.
        result = subprocess.run(
            [*GIT_CMD, "merge-base", "--is-ancestor", maybe_ancestor, descendant],
            cwd=cwd, capture_output=True, timeout=5,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False



def get_git_diff(cwd, baseline_sha, full_context=False, paths=None, untracked_paths=None):
    """
    Get the git diff between the baseline SHA and the current working tree,
    including untracked (new) files.

    Uses a temporary copy of the git index (GIT_INDEX_FILE) so the user's
    real index is never modified. The temp index gets intent-to-add entries
    for untracked files, making them visible in the diff output. Cleanup
    is just deleting the temp file in a finally block.

    If `paths` is given, the diff is restricted to those paths (relative to
    cwd; absolute paths are converted, paths outside cwd are dropped).
    `untracked_paths` (repo-root-relative) is forwarded to _temp_index so it
    can add only those files instead of scanning the whole worktree.
    """
    pathspec = _diff_pathspec(cwd, paths)
    if paths and not pathspec:
        # Caller restricted to specific paths but none are inside this repo
        # (e.g. only ~/.claude/... edits). Returning "" flows to skip(6); an
        # empty pathspec would mean an UNRESTRICTED diff — the bug this whole
        # change exists to fix.
        return ""

    # core.quotePath=false comes from GIT_CMD globally (see definition).
    cmd = [*GIT_CMD, "diff", "--no-color", "--no-ext-diff", "--no-textconv", baseline_sha] + (["--unified=99999"] if full_context else []) + pathspec
    try:
        if untracked_paths is not None and not untracked_paths:
            # Nothing to `add -N`, and the diff only reads the index.
            result = subprocess.run(cmd, cwd=cwd, capture_output=True, timeout=30)
        else:
            with _temp_index(cwd, untracked_paths) as env:
                # env is None when there is no index (bare repo / not a repo)
                # or no copy slot — diff still runs, just without
                # untracked-file support.
                result = subprocess.run(cmd, cwd=cwd, capture_output=True, timeout=30, env=env)
        if result.returncode != 0:
            debug_log(f"git diff failed: {result.stderr[:200].decode('utf-8', errors='replace')}")
            return None
        # Decode with errors='replace' so binary diffs don't crash
        return result.stdout.decode("utf-8", errors="replace")
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        debug_log(f"git diff error: {e}")
        return None


# Source file extensions worth reviewing for security
SOURCE_CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.java', '.rb', '.php',
    '.rs', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.scala',
    '.html', '.htm', '.ejs', '.yaml', '.yml', '.properties',
    '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte',
    '.sh', '.bash', '.zsh', '.fish', '.ksh', '.ps1', '.sql',
    '.gradle', '.groovy',
    '.tf', '.hcl', '.tfvars',
    '.json', '.toml', '.ipynb',
}

# Reviewable files identified by basename rather than extension (lowercased).
# These are by-convention extensionless but contain executable recipes/DSL
# with shell/exec surface (Make recipes, Jenkinsfile Groovy, Rakefile Ruby).
SOURCE_CODE_BASENAMES = {
    'dockerfile', 'makefile', 'gnumakefile', 'jenkinsfile', 'vagrantfile',
    'rakefile', 'gemfile', 'procfile', 'brewfile', 'justfile',
}

# Extensionless basenames that are NOT source — plain-text metadata. Anything
# extensionless not in this set is treated as source (likely a shebang script
# under bin/ or scripts/). Analysis of skipped reviews found
# extensionless executables (bin/deploy, scripts/run-canary) were the largest
# remaining false-negative class — they carry shell-injection surface but
# `splitext` gives '' so they were filtered out. _cap_files_for_prompt bounds
# the byte cost downstream, and the reviewer ignores prose, so opting
# extensionless IN with this small deny-list is the better default than
# opting OUT.
NON_SOURCE_EXTENSIONLESS_BASENAMES = {
    'license', 'licence', 'copying', 'notice', 'patents', 'authors',
    'contributors', 'maintainers', 'changelog', 'changes', 'news',
    'readme', 'todo', 'install', 'version', 'codeowners',
    'owners', 'copyright',
}

# Directory components and file suffixes that are never worth reviewing even
# when the extension is in SOURCE_CODE_EXTENSIONS — vendored deps, build
# output, generated code, minified bundles, lockfiles, protobuf stubs.
# Matched as path *components* (so `node_modules/` matches anywhere in the
# path, not just as a prefix) and as case-sensitive suffixes (the ecosystems
# that emit `.min.js` / `_pb2.py` / `.pb.go` are case-consistent).
SKIP_PATH_PATTERNS = (
    'node_modules/', 'dist/', 'build/', '.next/', 'vendor/',
    '__generated__/', '__pycache__/', '.venv/', 'target/',
)
SKIP_FILE_SUFFIXES = (
    '.min.js', '.min.css', '.d.ts', '.d.mts', '.d.cts',
    '.lock', '_pb2.py', '.pb.go',
)

# Path tokens that bump a file's review priority when a commit exceeds
# MAX_DIFF_FILES and we have to pick a subset. These are exactly the surfaces
# single-shot and agentic reviews disagree on most (auth, routing, IPC,
# subprocess, deserialization). Matched as lowercase substrings against the
# path; not regex — keep it cheap.
_SECURITY_RISK_PATH_TOKENS = (
    "auth", "login", "session", "token", "secret", "credential", "perm",
    "acl", "rbac", "iam", "policy",
    "route", "handler", "controller", "endpoint", "api/", "/api", "gateway",
    "middleware", "view",
    "exec", "subprocess", "shell", "spawn", "command",
    "client", "request", "fetch", "http", "url",
    "serialize", "pickle", "yaml", "parse", "deser",
    # Short tokens that would substring-match unrelated names (`format`,
    # `transform`, `sandbox`, `platform`) are intentionally omitted —
    # `sql`/`query` already cover the DB surface.
    "sql", "query",
)
# Suffixes that pass _is_reviewable_source but are almost always low-signal
# in large scaffolds — generated clients, migrations, test fixtures, config
# shims. These go to the BACK of the priority sort, not dropped outright.
_LOW_PRIORITY_SUFFIXES = (
    ".gen.ts", ".gen.tsx", ".generated.ts", "_gen.py",
    ".test.ts", ".test.tsx", ".test.py", ".spec.ts", ".spec.js",
    ".config.js", ".config.ts", ".config.mjs", ".config.cjs",
)
_LOW_PRIORITY_PATH_TOKENS = (
    "/migrations/", "/alembic/versions/", "/__tests__/", "/fixtures/",
)


def _prioritize_diff_files(diff_files, cap):
    """When `diff_files` exceeds `cap`, return the top-`cap` by security
    relevance plus the count dropped. Otherwise return (diff_files, 0).

    Score = (risk_tokens_in_path, not_low_priority, added_lines). The
    added-lines proxy is `content.count('\\n+')` which counts diff additions
    cheaply without re-parsing hunks. This is a heuristic, not a guarantee —
    the goal is to review the likely-dangerous subset of an over-cap diff
    instead of reviewing nothing. Diffs that exceed the cap are typically
    large multi-file scaffolds, and the cross-file source→sink vulnerabilities
    in them concentrate in a handful of api/client/route files.
    """
    if len(diff_files) <= cap:
        return diff_files, 0

    def _score(item):
        fp, content = item
        low = fp.lower()
        # Prepend "/" so leading-slash patterns in _LOW_PRIORITY_PATH_TOKENS
        # match top-level dirs (git diff paths are repo-root-relative, e.g.
        # `migrations/001.py` not `/migrations/001.py`). Same trick as
        # _is_reviewable_source.
        low_slashed = "/" + low
        risk = sum(1 for t in _SECURITY_RISK_PATH_TOKENS if t in low)
        low_prio = (
            fp.endswith(_LOW_PRIORITY_SUFFIXES)
            or any(t in low_slashed for t in _LOW_PRIORITY_PATH_TOKENS)
        )
        # added_lines: count('\n+') over-counts by including '+++' header and
        # any literal '+' at line start in context, but it's a consistent
        # ordinal across files in the same diff which is all we need.
        added = content.count("\n+")
        return (risk, not low_prio, added)

    ranked = sorted(diff_files, key=_score, reverse=True)
    return ranked[:cap], len(diff_files) - cap


def _is_reviewable_source(file_path):
    # Normalize for component matching: a path like `.next/x.js` or
    # `pkg/node_modules/y.ts` should both be excluded; matching against
    # `'/' + path` lets each pattern be checked as `'/' + p in '/' + path`
    # without false-positiving on `rebuild/` matching `build/`.
    norm = "/" + file_path.replace("\\", "/")
    if any(("/" + p) in norm for p in SKIP_PATH_PATTERNS):
        return False
    if file_path.endswith(SKIP_FILE_SUFFIXES):
        return False
    ext = os.path.splitext(file_path)[1].lower()
    if ext in SOURCE_CODE_EXTENSIONS:
        return True
    base = os.path.basename(file_path).lower()
    # Accept dot-suffixed variants too: `Dockerfile.dev`, `Makefile.am`,
    # `Jenkinsfile.release`. splitext gives ext='.dev'/'.am' for these so they
    # miss both the extension check and the exact-basename check otherwise.
    if base in SOURCE_CODE_BASENAMES \
            or base.split(".", 1)[0] in SOURCE_CODE_BASENAMES:
        return True
    # Extensionless files default to reviewable unless they're known
    # plain-text metadata or dotfiles. Covers shebang scripts under bin/ or
    # scripts/ (`deploy`, `run-canary`, `entrypoint`) which carry
    # shell-injection surface but were previously filtered out — the largest
    # remaining false-negative class for extensionless files. Dotfiles (`.gitignore`,
    # `.nvmrc`, `.env`) are config, not code; `.bashrc`-style runnables are
    # rare in repos and not worth the noise. The deny-list is prefix-aware on
    # `-`/`_` so dual-license / i18n variants (`LICENSE-MIT`, `README-CN`)
    # don't fall through as source.
    if ext == "" and not base.startswith("."):
        if any(base == x or base.startswith(x + "-") or base.startswith(x + "_")
               for x in NON_SOURCE_EXTENSIONLESS_BASENAMES):
            return False
        return True
    return False


def extract_file_paths_from_diff(diff_output):
    """
    Extract file paths from unified diff output (without content).
    Only includes files with source code extensions.
    Returns a list of file paths.
    """
    if not diff_output or not diff_output.strip():
        return []

    paths = []
    file_diffs = diff_output.split("diff --git ")

    for file_diff in file_diffs:
        if not file_diff.strip():
            continue
        lines = file_diff.split('\n')
        header_match = re.match(r'^a/(.+?) b/(.+)$', lines[0])
        if not header_match:
            continue
        file_path = header_match.group(2) or header_match.group(1) or ''
        if not _is_reviewable_source(file_path):
            continue
        paths.append(file_path)

    return paths



def parse_diff_into_files(diff_output):
    """
    Parse unified diff output into a list of (file_path, diff_content) tuples.
    Only includes files with source code extensions.
    """
    if not diff_output or not diff_output.strip():
        return []

    files = []
    file_diffs = diff_output.split("diff --git ")

    for file_diff in file_diffs:
        if not file_diff.strip():
            continue

        # Extract filename from first line: "a/path/to/file b/path/to/file"
        lines = file_diff.split('\n')
        header_match = re.match(r'^a/(.+?) b/(.+)$', lines[0])
        if not header_match:
            continue

        file_path = header_match.group(2) or header_match.group(1) or ''

        # Filter to source code files only
        if not _is_reviewable_source(file_path):
            continue

        # Extract the diff content (from first @@ onwards)
        diff_lines = []
        in_hunks = False
        for line in lines[1:]:
            if line.startswith('@@'):
                in_hunks = True
            if in_hunks:
                diff_lines.append(line)

        if diff_lines:
            files.append((file_path, '\n'.join(diff_lines)))

    return files


def filter_preexisting_from_diff(diff_files, cwd, baseline_sha):
    """
    Filter out pre-existing content from diff files.
    When a file is fully rewritten (Write tool replaces entire content),
    git shows all lines as removed (-) then re-added (+). This function
    detects such rewrites and strips lines from the + section that also
    appeared in the - section, so the LLM reviewer only sees truly new code.
    """
    if not baseline_sha:
        return diff_files

    filtered = []
    for file_path, diff_content in diff_files:
        lines = diff_content.split('\n')

        # Collect removed and added lines (stripping the +/- prefix)
        removed_lines = set()
        added_lines = []
        for line in lines:
            if line.startswith('-') and not line.startswith('---'):
                removed_lines.add(line[1:].strip())
            elif line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:].strip())

        if not removed_lines:
            # New file, no pre-existing content to filter
            filtered.append((file_path, diff_content))
            continue

        # Check what fraction of added lines were pre-existing
        preexisting_count = sum(1 for l in added_lines if l in removed_lines)
        if preexisting_count == 0:
            filtered.append((file_path, diff_content))
            continue

        added_lines_set = set(added_lines)

        # Rebuild diff with pre-existing lines converted to context (space prefix).
        # Known imprecision: .strip() matches across indentation (so reindented
        # code is treated as unchanged) and the set lets one removal mask N
        # additions of the same stripped text. Accepted trade-off — this filter
        # exists for the full-file Write rewrite case where exact-match would
        # miss everything; the diff-review prompt's previous-findings recheck
        # is the backstop.
        new_lines = []
        for line in lines:
            if line.startswith('+') and not line.startswith('+++'):
                content = line[1:].strip()
                if content in removed_lines:
                    # Convert to context line (pre-existing, not new)
                    new_lines.append(' ' + line[1:])
                else:
                    new_lines.append(line)
            elif line.startswith('-') and not line.startswith('---'):
                content = line[1:].strip()
                if content in added_lines_set:
                    # Skip removed lines that were re-added (they become context)
                    continue
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)

        filtered.append((file_path, '\n'.join(new_lines)))

    return filtered

