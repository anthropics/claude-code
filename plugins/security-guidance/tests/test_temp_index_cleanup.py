import os
import stat
import tempfile
import time

import pytest

from conftest import GIT_ENV, make_repo

import gitutil

posix_only = pytest.mark.skipif(not hasattr(os, "getuid"), reason="needs a uid")


@pytest.fixture
def tmproot(tmp_path, monkeypatch):
    """A temp dir of our own, so nothing here reads or sweeps the real one."""
    d = tmp_path / "tmproot"
    d.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(d))
    for k, v in GIT_ENV.items():
        monkeypatch.setenv(k, v)
    return d


def _leftovers(root):
    """Everything left under `root` but the slot files, which stay."""
    return sorted(
        os.path.join(dirpath, f)
        for dirpath, _, files in os.walk(root) for f in files
        if not (f.startswith("slot") and f.endswith(".lock"))
    )


def _write(path):
    with open(path, "w") as f:
        f.write("x")
    return path


def _advance_clock(monkeypatch, seconds):
    """ctime cannot be set, so files are aged by moving the clock instead."""
    real = time.time
    monkeypatch.setattr(time, "time", lambda: real() + seconds)


class TestTempIndex:
    @posix_only
    def test_copy_lives_in_private_dir_and_is_removed(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            idx = env["GIT_INDEX_FILE"]
            private = tmproot / f"claude-security-guidance-{os.getuid()}"
            assert os.path.dirname(idx) == str(private)
            assert stat.S_IMODE(os.lstat(private).st_mode) == 0o700
            assert os.path.isfile(idx)
        assert _leftovers(tmproot) == []

    def test_cleanup_removes_what_a_killed_git_leaves(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            for suffix in (".lock", ".stash.12345", ".stash.12345.lock"):
                _write(env["GIT_INDEX_FILE"] + suffix)
        assert _leftovers(tmproot) == []

    def test_cleanup_when_body_raises(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        with pytest.raises(RuntimeError):
            with gitutil._temp_index(str(repo), untracked_paths=[]):
                raise RuntimeError("boom")
        assert _leftovers(tmproot) == []

    def test_live_copy_keeps_index_mtime_and_survives_a_sweep(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        old = int(time.time()) - 7200
        os.utime(repo / ".git" / "index", (old, old))
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            assert int(os.stat(env["GIT_INDEX_FILE"]).st_mtime) == old
            gitutil._hook_tmpdir()
            assert os.path.isfile(env["GIT_INDEX_FILE"])


class TestSweep:
    @posix_only
    def test_reclaims_stale_files_in_both_dirs(self, tmproot, monkeypatch):
        private = gitutil._hook_tmpdir()
        stale = [
            _write(os.path.join(d, name))
            for d in (private, str(tmproot))
            for name in ("security_hook_idx_dead", "security_hook_idx_dead.lock")
        ]
        _advance_clock(monkeypatch, 3600)
        keep = [
            _write(os.path.join(private, "security_hook_idx_live")),
            _write(os.path.join(str(tmproot), "security_hook_idx_live")),
        ]
        for p in keep:
            os.utime(p, (time.time(), time.time()))
        keep.append(_write(os.path.join(str(tmproot), "unrelated")))
        gitutil._hook_tmpdir()
        assert [p for p in stale if os.path.exists(p)] == []
        assert [p for p in keep if not os.path.exists(p)] == []

    def test_backdated_mtime_alone_is_not_stale(self, tmproot):
        p = _write(str(tmproot / "security_hook_idx_copy2"))
        old = time.time() - 7200
        os.utime(p, (old, old))
        gitutil._hook_tmpdir()
        assert os.path.exists(p)

    @posix_only
    def test_only_our_own_regular_files(self, tmproot, monkeypatch):
        target = _write(str(tmproot / "target"))
        os.symlink(target, tmproot / "security_hook_idx_link")
        (tmproot / "security_hook_idx_dir").mkdir()
        mine = _write(str(tmproot / "security_hook_idx_mine"))
        _advance_clock(monkeypatch, 3600)
        gitutil._sweep_stale_indexes(str(tmproot), os.getuid() + 1)
        assert os.path.exists(mine)
        gitutil._sweep_stale_indexes(str(tmproot), os.getuid())
        assert not os.path.exists(mine)
        assert os.path.lexists(tmproot / "security_hook_idx_link")
        assert os.path.exists(target)
        assert (tmproot / "security_hook_idx_dir").is_dir()

    def test_large_backlog_is_drained_in_slices(self, tmproot, monkeypatch):
        for i in range(3):
            _write(str(tmproot / f"security_hook_idx_{i}"))
        _advance_clock(monkeypatch, 3600)
        monkeypatch.setattr(gitutil, "_SWEEP_BUDGET_S", -1)
        gitutil._sweep_stale_indexes(str(tmproot), None)
        assert len(_leftovers(tmproot)) == 2


class TestPrivateDir:
    @posix_only
    def test_refuses_symlink_or_file_at_the_predictable_path(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        predictable = tmproot / f"claude-security-guidance-{os.getuid()}"
        elsewhere = tmp_path / "elsewhere"
        elsewhere.mkdir()
        os.symlink(elsewhere, predictable)
        assert gitutil._hook_tmpdir() is None
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            assert os.path.dirname(env["GIT_INDEX_FILE"]) == str(tmproot)
        assert list(elsewhere.iterdir()) == []
        predictable.unlink()
        predictable.write_text("")
        assert gitutil._hook_tmpdir() is None

    @posix_only
    def test_refuses_a_directory_owned_by_someone_else(self, tmproot, monkeypatch):
        uid = os.getuid()
        (tmproot / f"claude-security-guidance-{uid + 1}").mkdir()
        monkeypatch.setattr(os, "getuid", lambda: uid + 1)
        assert gitutil._hook_tmpdir() is None

    def test_without_getuid_uses_and_sweeps_the_bare_temp_dir(
            self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo")
        monkeypatch.delattr(os, "getuid", raising=False)
        stale = _write(str(tmproot / "security_hook_idx_dead"))
        _advance_clock(monkeypatch, 3600)
        assert gitutil._hook_tmpdir() is None
        assert not os.path.exists(stale)
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            assert os.path.dirname(env["GIT_INDEX_FILE"]) == str(tmproot)
        assert _leftovers(tmproot) == []


def _dead_pid():
    import subprocess
    import sys
    p = subprocess.Popen([sys.executable, "-c", "pass"])
    p.wait()
    return p.pid


class TestOwnerGone:
    @posix_only
    def test_copy_name_carries_the_hook_pid(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo")
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            name = os.path.basename(env["GIT_INDEX_FILE"])
            assert name.startswith(f"security_hook_idx_pid{os.getpid()}_")
            assert not gitutil._owner_is_gone(name)
            assert not gitutil._owner_is_gone(name + ".lock")

    @posix_only
    def test_fresh_copies_of_a_dead_hook_go_at_once(self, tmproot):
        private = gitutil._hook_tmpdir()
        dead = f"security_hook_idx_pid{_dead_pid()}_abcdefgh"
        gone = [_write(os.path.join(d, dead + suffix))
                for d in (private, str(tmproot))
                for suffix in ("", ".lock", ".stash.77")]
        keep = [
            _write(os.path.join(private, f"security_hook_idx_pid{os.getpid()}_abcdefgh")),
            # Earlier releases: 8 random characters, which may look like a pid.
            _write(os.path.join(private, "security_hook_idx_pid1_abc")),
            _write(os.path.join(private, "security_hook_idx_12345678")),
            _write(os.path.join(str(tmproot), f"unrelated_pid{_dead_pid()}_abcdefgh")),
        ]
        gitutil._hook_tmpdir()
        assert [p for p in gone if os.path.exists(p)] == []
        assert [p for p in keep if not os.path.exists(p)] == []

    def test_no_process_is_probed_without_getuid(self, tmproot, monkeypatch):
        """On Windows os.kill ends the process it is given."""
        monkeypatch.delattr(os, "getuid", raising=False)

        def no_kill(*a):
            raise AssertionError("probed a process")

        monkeypatch.setattr(os, "kill", no_kill)
        p = _write(str(tmproot / "security_hook_idx_pid999999_abcdefgh"))
        gitutil._hook_tmpdir()
        assert os.path.exists(p)


@pytest.mark.skipif(os.name == "nt", reason="uses signals and a /bin/sh git shim")
class TestHookProcessKilled:
    def _start_slow_hook(self, tmp_path, hook_env, repo):
        """Start a UserPromptSubmit hook whose `git stash create` hangs, and
        return once its index copy exists."""
        import shutil
        import subprocess
        import sys
        import json
        from conftest import HOOK_SCRIPT, ups_payload
        real_git = shutil.which("git")
        bindir = tmp_path / "bin"
        bindir.mkdir(exist_ok=True)
        shim = bindir / "git"
        shim.write_text(
            "#!/bin/sh\n"
            'case "$*" in *"stash create"*) [ -n "$SLOW_GIT" ] && exec sleep 60;; esac\n'
            f'exec "{real_git}" "$@"\n'
        )
        shim.chmod(0o755)
        tmproot = tmp_path / "hooktmp"
        tmproot.mkdir(exist_ok=True)
        env = dict(hook_env)
        env["PATH"] = f"{bindir}{os.pathsep}{env['PATH']}"
        env["TMPDIR"] = str(tmproot)
        env["SLOW_GIT"] = "1"
        proc = subprocess.Popen(
            [sys.executable, str(HOOK_SCRIPT)], stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
        proc.stdin.write(json.dumps(ups_payload(repo)).encode())
        proc.stdin.close()
        deadline = time.time() + 30
        while time.time() < deadline and not self._copies(tmproot):
            assert proc.poll() is None, "hook exited before copying the index"
            time.sleep(0.05)
        assert self._copies(tmproot)
        return proc, env, tmproot

    def _copies(self, root):
        return [p for p in _leftovers(root)
                if os.path.basename(p).startswith("security_hook_idx_")]

    def test_terminated_hook_removes_its_copy(self, tmp_path, hook_env, stub_api):
        import signal
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("x = 2\n")
        proc, env, tmproot = self._start_slow_hook(tmp_path, hook_env, repo)
        proc.send_signal(signal.SIGTERM)
        assert proc.wait(timeout=30) == 128 + signal.SIGTERM
        assert self._copies(tmproot) == []

    def test_next_run_reclaims_the_copy_of_a_killed_hook(self, tmp_path, hook_env, stub_api):
        from conftest import run_hook, ups_payload
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("x = 2\n")
        proc, env, tmproot = self._start_slow_hook(tmp_path, hook_env, repo)
        proc.kill()
        proc.wait(timeout=30)
        assert self._copies(tmproot)
        env.pop("SLOW_GIT")
        run_hook(ups_payload(repo, session_id="s2"), env)
        assert self._copies(tmproot) == []


class TestHardLink:
    @posix_only
    def test_copy_is_a_link_and_git_cannot_change_the_index_through_it(self, tmp_path, tmproot):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "new.py").write_text("n = 1\n")
        index = repo / ".git" / "index"
        before = index.read_bytes()
        with gitutil._temp_index(str(repo), untracked_paths=["new.py"]) as env:
            copy = env["GIT_INDEX_FILE"]
            # `add -N` wrote a new index over the link.
            assert os.stat(copy).st_ino != os.stat(index).st_ino
            assert open(copy, "rb").read() != before
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            assert os.stat(env["GIT_INDEX_FILE"]).st_ino == os.stat(index).st_ino
        assert index.read_bytes() == before
        assert _leftovers(tmproot) == []

    def test_falls_back_to_a_copy(self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        index = repo / ".git" / "index"
        old = int(time.time()) - 7200
        os.utime(index, (old, old))

        def no_link(*a, **kw):
            raise OSError(18, "Invalid cross-device link")

        monkeypatch.setattr(os, "link", no_link)
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            copy = env["GIT_INDEX_FILE"]
            assert os.stat(copy).st_ino != os.stat(index).st_ino
            assert open(copy, "rb").read() == index.read_bytes()
            assert int(os.stat(copy).st_mtime) == old
        assert _leftovers(tmproot) == []


@posix_only
class TestCopySlots:
    def test_only_so_many_copies_at_once(self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        monkeypatch.setattr(gitutil, "_MAX_LIVE_COPIES", 1)
        monkeypatch.setattr(gitutil, "_SLOT_WAIT_S", 0.3)
        with gitutil._temp_index(str(repo), untracked_paths=[]) as first:
            assert first is not None
            with gitutil._temp_index(str(repo), untracked_paths=[]) as second:
                assert second is None
        with gitutil._temp_index(str(repo), untracked_paths=[]) as again:
            assert again is not None
        assert _leftovers(tmproot) == []

    def test_fewer_slots_when_the_disk_is_nearly_full(self, tmproot, monkeypatch):
        import collections
        import shutil
        usage = collections.namedtuple("usage", "total used free")
        gb = 1024 ** 3
        index = 350 * 1024 ** 2

        def free(n):
            monkeypatch.setattr(shutil, "disk_usage", lambda p: usage(250 * gb, 0, n))

        free(200 * gb)
        assert gitutil._copy_slots(str(tmproot), index) == gitutil._MAX_LIVE_COPIES
        free(10 * gb)
        assert gitutil._copy_slots(str(tmproot), index) == 2
        free(5 * gb)
        assert gitutil._copy_slots(str(tmproot), index) == 1
        free(0)
        assert gitutil._copy_slots(str(tmproot), index) == 1
        free(1 * gb)
        assert gitutil._copy_slots(str(tmproot), 1000) == gitutil._MAX_LIVE_COPIES

    def test_waits_for_a_slot(self, tmp_path, tmproot, monkeypatch):
        import threading
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        monkeypatch.setattr(gitutil, "_MAX_LIVE_COPIES", 1)
        monkeypatch.setattr(gitutil, "_SLOT_WAIT_S", 10)
        release = threading.Event()
        holding = threading.Event()

        def holder():
            with gitutil._temp_index(str(repo), untracked_paths=[]):
                holding.set()
                release.wait(10)

        t = threading.Thread(target=holder)
        t.start()
        assert holding.wait(10)
        threading.Timer(0.5, release.set).start()
        with gitutil._temp_index(str(repo), untracked_paths=[]) as env:
            assert env is not None
        t.join()

    def test_slot_of_a_killed_hook_is_free(self, tmp_path, tmproot, monkeypatch):
        import signal
        import subprocess
        import sys
        monkeypatch.setattr(gitutil, "_MAX_LIVE_COPIES", 1)
        monkeypatch.setattr(gitutil, "_SLOT_WAIT_S", 0.3)
        private = gitutil._hook_tmpdir()
        holder = subprocess.Popen(
            [sys.executable, "-c",
             "import fcntl, os, sys, time\n"
             "fd = os.open(sys.argv[1], os.O_RDWR | os.O_CREAT, 0o600)\n"
             "fcntl.flock(fd, fcntl.LOCK_EX)\n"
             "print('held', flush=True)\n"
             "time.sleep(60)\n",
             os.path.join(private, "slot0.lock")],
            stdout=subprocess.PIPE)
        assert holder.stdout.readline().strip() == b"held"
        with gitutil._copy_slot(private) as got:
            assert not got
        holder.send_signal(signal.SIGKILL)
        holder.wait()
        with gitutil._copy_slot(private) as got:
            assert got

    def test_baseline_falls_back_to_head_without_a_slot(self, tmp_path, tmproot, monkeypatch):
        import diffstate
        from conftest import git
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        (repo / "app.py").write_text("x = 2\n")
        head = git(repo, "rev-parse", "HEAD").strip()
        monkeypatch.setattr(gitutil, "_MAX_LIVE_COPIES", 1)
        monkeypatch.setattr(gitutil, "_SLOT_WAIT_S", 0.3)
        private = gitutil._hook_tmpdir()
        with gitutil._copy_slot(private) as got:
            assert got
            assert diffstate.capture_git_baseline(str(repo)) == head
        assert diffstate.capture_git_baseline(str(repo)) != head
        assert _leftovers(tmproot) == []


class TestStashIndexesLeftInGitDir:
    """What releases before 2.0.10 left next to the real index."""

    def test_old_ones_go_and_nothing_else_does(self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        git_dir = repo / ".git"
        index = (git_dir / "index").read_bytes()
        old = [_write(str(git_dir / n)) for n in ("index.stash.123", "index.stash.99999")]
        not_ours = [_write(str(git_dir / n)) for n in (
            "index.lock", "index.stash.12.bak", "index.stash.abc", "index.stash.", "myindex.stash.5")]
        _advance_clock(monkeypatch, gitutil._TEMP_INDEX_STALE_S + 60)
        fresh = _write(str(git_dir / "index.stash.456"))
        now = time.time()  # the moved clock
        os.utime(fresh, (now, now))

        with gitutil._temp_index(str(repo), untracked_paths=[]):
            pass

        assert [p for p in old if os.path.exists(p)] == []
        assert [p for p in not_ours if not os.path.exists(p)] == []
        assert os.path.exists(fresh)
        assert (git_dir / "index").read_bytes() == index

    def test_a_directory_or_link_by_that_name_stays(self, tmp_path, tmproot, monkeypatch):
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        git_dir = repo / ".git"
        target = _write(str(tmp_path / "elsewhere"))
        os.mkdir(git_dir / "index.stash.1")
        os.symlink(target, git_dir / "index.stash.2")
        _advance_clock(monkeypatch, gitutil._TEMP_INDEX_STALE_S + 60)

        with gitutil._temp_index(str(repo), untracked_paths=[]):
            pass

        assert os.path.isdir(git_dir / "index.stash.1")
        assert os.path.islink(git_dir / "index.stash.2")
        assert os.path.exists(target)

    def test_linked_worktree_has_its_own(self, tmp_path, tmproot, monkeypatch):
        from conftest import git
        repo = make_repo(tmp_path / "repo", {"app.py": "x = 1\n"})
        wt = tmp_path / "wt"
        git(repo, "worktree", "add", "-q", str(wt), "-b", "side")
        wt_git_dir = repo / ".git" / "worktrees" / "wt"
        mine = _write(str(wt_git_dir / "index.stash.7"))
        main = _write(str(repo / ".git" / "index.stash.7"))
        _advance_clock(monkeypatch, gitutil._TEMP_INDEX_STALE_S + 60)

        with gitutil._temp_index(str(wt), untracked_paths=[]):
            pass

        assert not os.path.exists(mine)
        assert os.path.exists(main)
