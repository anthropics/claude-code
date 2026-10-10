import os
import shutil
import subprocess
import tempfile
import time

import pytest

from conftest import (
    GIT_ENV, VULN_PY, commit_file, bash_payload, edit_payload, git, make_repo,
    metrics_of, run_hook, stop_payload, ups_payload,
)

import diffstate
import gitutil


@pytest.fixture
def tmproot(tmp_path, monkeypatch):
    """A temp dir of our own, and the environment restored afterwards
    (apply_safe_git_env writes to os.environ)."""
    d = tmp_path / "tmproot"
    d.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(d))
    saved = dict(os.environ)
    os.environ.update(GIT_ENV)
    yield d
    os.environ.clear()
    os.environ.update(saved)


def _leftovers(root):
    """Everything left under `root` but the slot files, which stay."""
    return sorted(
        os.path.join(dirpath, f)
        for dirpath, _, files in os.walk(root) for f in files
        if not (f.startswith("slot") and f.endswith(".lock"))
    )


def _index_copies_left(root):
    """Index copies and the files git writes next to them. The whole hook may
    also start the detached SDK bootstrap, which uses the temp dir too."""
    return [p for p in _leftovers(root)
            if os.path.basename(p).startswith(gitutil._TEMP_INDEX_PREFIX)]


def _leftovers_of_copies(root):
    return _index_copies_left(root)


def _index_litter(git_dir):
    return sorted(n for n in os.listdir(git_dir) if n.startswith("index") and n != "index")


def _index_sig(git_dir):
    st = os.stat(os.path.join(git_dir, "index"))
    return (st.st_ino, st.st_mtime_ns, st.st_size)


def _make_stat_stale(path):
    """Move a tracked file's mtime, content unchanged: a stat mismatch that
    git would normally write back to the index it read."""
    t = os.stat(path).st_mtime + 2
    os.utime(path, (t, t))


def _is_stash_create(args):
    return list(args[-2:]) == ["stash", "create"]


class TestBaselineCapture:
    def test_stash_create_gets_a_throwaway_index(self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("x = 2\n")
        before = _index_sig(repo / ".git")
        seen = []
        real_run = subprocess.run

        def spy(args, **kw):
            if _is_stash_create(args):
                seen.append(kw["env"]["GIT_INDEX_FILE"])
            return real_run(args, **kw)

        monkeypatch.setattr(subprocess, "run", spy)
        assert diffstate.capture_git_baseline(str(repo))
        assert len(seen) == 1
        assert os.path.realpath(seen[0]).startswith(os.path.realpath(tmproot) + os.sep)
        assert _index_sig(repo / ".git") == before
        assert _index_litter(repo / ".git") == []
        assert _leftovers(tmproot) == []

    def test_killed_stash_create_leaves_nothing(self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("x = 2\n")
        real_run = subprocess.run

        def killed(args, **kw):
            if _is_stash_create(args):
                idx = kw["env"]["GIT_INDEX_FILE"]
                for suffix in (".lock", ".stash.4242", ".stash.4242.lock"):
                    with open(idx + suffix, "wb") as f:
                        f.write(b"partial")
                raise subprocess.TimeoutExpired(args, kw["timeout"])
            return real_run(args, **kw)

        monkeypatch.setattr(subprocess, "run", killed)
        assert diffstate.capture_git_baseline(str(repo)) is None
        assert _index_litter(repo / ".git") == []
        assert _leftovers(tmproot) == []

    def test_succeeds_while_index_lock_exists(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("x = 2\n")
        head = git(repo, "rev-parse", "HEAD").strip()
        (repo / ".git" / "index.lock").touch()
        sha = diffstate.capture_git_baseline(str(repo))
        assert sha and sha != head
        assert git(repo, "show", f"{sha}:app.py") == "x = 2\n"
        assert _index_litter(repo / ".git") == ["index.lock"]

    def test_dirty_tree_matches_a_plain_stash_create(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("staged\n")
        git(repo, "add", "app.py")
        (repo / "app.py").write_text("staged\nunstaged\n")
        gitutil.apply_safe_git_env()
        ours = diffstate.capture_git_baseline(str(repo))
        plain = git(repo, "stash", "create").strip()
        assert git(repo, "show", f"{ours}:app.py") == "staged\nunstaged\n"
        assert (git(repo, "rev-parse", f"{ours}^{{tree}}")
                == git(repo, "rev-parse", f"{plain}^{{tree}}"))

    def test_clean_tree_returns_head(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        head = git(repo, "rev-parse", "HEAD").strip()
        assert diffstate.capture_git_baseline(str(repo)) == head

    def test_missing_index_returns_head(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        head = git(repo, "rev-parse", "HEAD").strip()
        (repo / ".git" / "index").unlink()
        assert diffstate.capture_git_baseline(str(repo)) == head
        assert _index_litter(repo / ".git") == []

    def test_linked_worktree_uses_its_own_index(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        wt = tmp_path / "wt"
        git(repo, "worktree", "add", "-q", "-b", "side", str(wt))
        assert (wt / ".git").is_file()
        wt_git_dir = repo / ".git" / "worktrees" / "wt"
        (wt / "app.py").write_text("x = 3\n")
        (wt_git_dir / "index.lock").touch()
        sha = diffstate.capture_git_baseline(str(wt))
        assert git(wt, "show", f"{sha}:app.py") == "x = 3\n"
        assert _index_litter(wt_git_dir) == ["index.lock"]
        assert _index_litter(repo / ".git") == []
        assert _leftovers(tmproot) == []


class TestRacilyCleanEdit:
    def test_same_size_edit_in_the_second_the_index_was_written(self, tmp_path, tmproot):
        """Every stat field git caches still matches, so git only notices by
        comparing the file's mtime with the index file's own mtime."""
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        git(repo, "config", "core.trustctime", "false")
        then = int(time.time()) - 100
        os.utime(repo / "app.py", (then, then))
        git(repo, "update-index", "--refresh")
        (repo / "app.py").write_text("x = 2\n")
        os.utime(repo / "app.py", (then, then))
        os.utime(repo / ".git" / "index", (then, then))
        gitutil.apply_safe_git_env()
        sha = diffstate.capture_git_baseline(str(repo))
        assert git(repo, "show", f"{sha}:app.py") == "x = 2\n"
        assert gitutil._git_name_only(str(repo), "HEAD") == {"app.py"}
        assert "+x = 2" in gitutil.get_git_diff(str(repo), "HEAD", untracked_paths=[])


class TestReadOnlyGitLeavesTheRealIndexAlone:
    def test_env_carries_optional_locks_off(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        os.environ.pop("GIT_OPTIONAL_LOCKS", None)
        gitutil.apply_safe_git_env()
        assert os.environ["GIT_OPTIONAL_LOCKS"] == "0"
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            assert env["GIT_OPTIONAL_LOCKS"] == "0"

    def test_status(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "new.py").write_text("n = 1\n")
        _make_stat_stale(repo / "app.py")
        before = _index_sig(repo / ".git")
        gitutil.apply_safe_git_env()
        assert gitutil._git_status_porcelain(str(repo)) == (set(), {"new.py"})
        assert _index_sig(repo / ".git") == before

    def test_work_tree_diff(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n", "b.py": "b = 1\n"})
        (repo / "b.py").write_text("b = 2\n")
        _make_stat_stale(repo / "app.py")
        before = _index_sig(repo / ".git")
        head = git(repo, "rev-parse", "HEAD").strip()
        gitutil.apply_safe_git_env()
        # app.py: stat changed, content did not. The name list may hold it,
        # the review set must not.
        assert "b.py" in gitutil._git_name_only(str(repo), "HEAD")
        paths, _, _, _, _ = diffstate.compute_v2_review_set(str(repo), head, head)
        assert paths == [os.path.join(os.path.realpath(repo), "b.py")]
        assert _index_sig(repo / ".git") == before
        assert _leftovers(tmproot) == []

    def test_diffs_need_no_index_copy(self, tmp_path, tmproot, monkeypatch):
        """Every copy is index-sized, so only `add -N` and stash get one."""
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n", "b.py": "b = 1\n"})
        first = git(repo, "rev-parse", "HEAD").strip()
        commit_file(repo, "app.py", "x = 2\n")
        (repo / "b.py").write_text("b = 2\n")
        _make_stat_stale(repo / "app.py")
        before = _index_sig(repo / ".git")

        def no_copy(*a, **kw):
            raise AssertionError("copied the index")

        monkeypatch.setattr(gitutil, "_temp_index", no_copy)
        assert gitutil._git_name_only(str(repo), f"{first}..HEAD") == {"app.py"}
        assert "b.py" in gitutil._git_name_only(str(repo), "HEAD")
        diff = gitutil.get_git_diff(str(repo), "HEAD", untracked_paths=[])
        assert "+b = 2" in diff and "app.py" not in diff
        assert _index_sig(repo / ".git") == before

    def test_untracked_files_still_reach_the_diff(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "new.py").write_text("n = 1\n")
        before = _index_sig(repo / ".git")
        diff = gitutil.get_git_diff(str(repo), "HEAD", untracked_paths=["new.py"])
        assert "+n = 1" in diff
        assert gitutil._git_name_only(str(repo), "HEAD", include_untracked=True) == {"new.py"}
        assert _index_sig(repo / ".git") == before
        assert _leftovers_of_copies(tmproot) == []


@pytest.mark.skipif(os.name == "nt", reason="uses a /bin/sh git shim")
class TestWholeHook:
    def _shim(self, tmp_path, hook_env):
        """Put a logging `git` first on PATH; returns (env, read_log)."""
        real_git = shutil.which("git")
        bindir = tmp_path / "bin"
        bindir.mkdir()
        log = tmp_path / "git.log"
        shim = bindir / "git"
        shim.write_text(
            "#!/bin/sh\n"
            f'printf "%s\\t%s\\t%s\\n" "$GIT_OPTIONAL_LOCKS" "$GIT_INDEX_FILE" "$*" >> "{log}"\n'
            f'exec "{real_git}" "$@"\n'
        )
        shim.chmod(0o755)
        tmproot = tmp_path / "tmproot"
        tmproot.mkdir()
        env = dict(hook_env)
        env.pop("GIT_OPTIONAL_LOCKS", None)
        env["PATH"] = f"{bindir}{os.pathsep}{env['PATH']}"
        env["TMPDIR"] = str(tmproot)

        prefix = " ".join(gitutil.GIT_CMD[1:]) + " "

        def read_log():
            """[(optional_locks, index_file, [subcommand, *args])] per call."""
            calls = []
            for ln in log.read_text().splitlines():
                locks, index_file, argv = ln.split("\t", 2)
                if argv.startswith(prefix):
                    argv = argv[len(prefix):]
                calls.append((locks, index_file, argv.split()))
            return calls

        return env, tmproot, read_log

    def test_every_git_call_of_a_turn(self, tmp_path, hook_env, stub_api):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n", "wip.py": "w = 1\n"})
        env, tmproot, read_log = self._shim(tmp_path, hook_env)
        (repo / "wip.py").write_text("w = 2\n")
        _make_stat_stale(repo / "app.py")
        before = _index_sig(repo / ".git")

        run_hook(ups_payload(repo), env)
        (repo / "app.py").write_text(VULN_PY)
        (repo / "new.py").write_text(VULN_PY)
        run_hook(edit_payload(repo, repo / "app.py", VULN_PY), env)
        run_hook(edit_payload(repo, repo / "new.py", VULN_PY), env)
        rc, so, se = run_hook(stop_payload(repo), env)
        m = metrics_of(so)
        assert m.get("skip_reason") is None and m["files_reviewed"] == 2, m

        calls = read_log()
        assert {"stash", "status", "diff", "add"} <= {sub[0] for _, _, sub in calls}
        assert [c for c in calls if c[0] != "0"] == []
        for _, index_file, sub in calls:
            if sub[0] in ("stash", "add"):
                assert index_file.startswith(str(tmproot)), sub
        assert _index_sig(repo / ".git") == before
        assert _index_litter(repo / ".git") == []
        assert _index_copies_left(tmproot) == []

    def test_every_git_call_of_a_commit_review(self, tmp_path, hook_env, stub_api):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        env, tmproot, read_log = self._shim(tmp_path, hook_env)
        sha, out = commit_file(repo, "app.py", VULN_PY)
        before = _index_sig(repo / ".git")
        rc, so, se = run_hook(bash_payload(repo, "git commit -m change", stdout=out), env)
        assert metrics_of(so).get("skip_reason") is None
        calls = read_log()
        assert calls and [c for c in calls if c[0] != "0"] == []
        assert _index_sig(repo / ".git") == before
        assert _index_litter(repo / ".git") == []
        assert _index_copies_left(tmproot) == []
