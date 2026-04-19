from __future__ import annotations

from pathlib import Path

from ethos_aegis.mythos_runtime.memory import MemoryLedger
from ethos_aegis.mythos_runtime.swd import ClaimedFileAction, StrictWriteDiscipline


# ---------------------------------------------------------------------------
# snapshot — all files (no paths argument)
# ---------------------------------------------------------------------------


def test_snapshot_all_files(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
    (tmp_path / "b.txt").write_text("world", encoding="utf-8")
    swd = StrictWriteDiscipline(tmp_path)
    snap = swd.snapshot()
    assert "a.txt" in snap
    assert "b.txt" in snap
    assert snap["a.txt"].exists is True
    assert snap["b.txt"].sha256 is not None


def test_snapshot_ignores_pycache(tmp_path: Path) -> None:
    (tmp_path / "kept.txt").write_text("x", encoding="utf-8")
    pycache = tmp_path / "__pycache__"
    pycache.mkdir()
    (pycache / "mod.pyc").write_bytes(b"bytecode")
    swd = StrictWriteDiscipline(tmp_path)
    snap = swd.snapshot()
    assert "kept.txt" in snap
    for key in snap:
        assert "__pycache__" not in key
        assert key.endswith(".pyc") is False


def test_snapshot_custom_ignore_patterns(tmp_path: Path) -> None:
    (tmp_path / "keep.py").write_text("x", encoding="utf-8")
    (tmp_path / "skip.log").write_text("y", encoding="utf-8")
    swd = StrictWriteDiscipline(tmp_path, ignore_patterns=["*.log"])
    snap = swd.snapshot()
    assert "keep.py" in snap
    assert "skip.log" not in snap


def test_snapshot_nonexistent_path_returns_missing(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)
    snap = swd.snapshot(["does_not_exist.txt"])
    assert snap["does_not_exist.txt"].exists is False
    assert snap["does_not_exist.txt"].sha256 is None


# ---------------------------------------------------------------------------
# verify_claims — DELETE action
# ---------------------------------------------------------------------------


def test_verify_claims_delete(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)
    (tmp_path / "del.txt").write_text("bye", encoding="utf-8")
    before = swd.snapshot(["del.txt"])
    (tmp_path / "del.txt").unlink()
    after = swd.snapshot(["del.txt"])
    report = swd.verify_claims(
        [ClaimedFileAction("del.txt", "DELETE", "removed")],
        before,
        after,
    )
    assert report.ok is True
    assert report.detail == "verified"


def test_verify_claims_mismatch_create_existing_file(tmp_path: Path) -> None:
    """CREATE claim fails when file already existed before."""
    swd = StrictWriteDiscipline(tmp_path)
    (tmp_path / "exists.txt").write_text("old", encoding="utf-8")
    before = swd.snapshot(["exists.txt"])
    (tmp_path / "exists.txt").write_text("new", encoding="utf-8")
    after = swd.snapshot(["exists.txt"])
    report = swd.verify_claims(
        [ClaimedFileAction("exists.txt", "CREATE")],
        before,
        after,
    )
    assert report.ok is False
    assert "mismatch" in report.detail


def test_verify_claims_dry_run_accepts_all(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)
    before = swd.snapshot(["ghost.txt"])  # doesn't exist
    after = swd.snapshot(["ghost.txt"])  # still doesn't exist
    report = swd.verify_claims(
        [ClaimedFileAction("ghost.txt", "CREATE")],
        before,
        after,
        dry_run=True,
    )
    assert report.ok is True  # dry_run always appends claimed action
    assert report.dry_run is True


def test_verify_claims_modify(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)
    (tmp_path / "mod.txt").write_text("original", encoding="utf-8")
    before = swd.snapshot(["mod.txt"])
    (tmp_path / "mod.txt").write_text("changed", encoding="utf-8")
    after = swd.snapshot(["mod.txt"])
    report = swd.verify_claims(
        [ClaimedFileAction("mod.txt", "MODIFY")],
        before,
        after,
    )
    assert report.ok is True


def test_verify_claims_modify_same_content_fails(tmp_path: Path) -> None:
    """MODIFY requires that sha256 actually changed."""
    swd = StrictWriteDiscipline(tmp_path)
    (tmp_path / "same.txt").write_text("constant", encoding="utf-8")
    snapshot = swd.snapshot(["same.txt"])
    report = swd.verify_claims(
        [ClaimedFileAction("same.txt", "MODIFY")],
        snapshot,
        snapshot,
    )
    assert report.ok is False


# ---------------------------------------------------------------------------
# write_text — dry_run
# ---------------------------------------------------------------------------


def test_write_text_dry_run_does_not_create_file(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)
    report = swd.write_text("new.txt", "content\n", dry_run=True)
    assert report.dry_run is True
    assert not (tmp_path / "new.txt").exists()


def test_write_text_without_ledger(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)  # no memory_ledger
    report = swd.write_text("solo.txt", "data\n")
    assert report.ok is True
    assert (tmp_path / "solo.txt").read_text(encoding="utf-8") == "data\n"


# ---------------------------------------------------------------------------
# _record_report — no ledger is a no-op
# ---------------------------------------------------------------------------


def test_record_report_no_op_without_ledger(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)  # no memory_ledger
    # Should not raise
    report = swd.write_text("x.txt", "y\n")
    assert report.ok is True


# ---------------------------------------------------------------------------
# _normalize
# ---------------------------------------------------------------------------


def test_normalize_converts_backslashes(tmp_path: Path) -> None:
    swd = StrictWriteDiscipline(tmp_path)
    normalized = swd._normalize(Path("sub\\file.txt"))
    assert "\\" not in normalized


# ---------------------------------------------------------------------------
# StrictWriteDiscipline with ledger integration
# ---------------------------------------------------------------------------


def test_ledger_records_write_events(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("rec.txt", "recorded\n", description="ledger-test")
    events = ledger.list_events()
    assert any(e.event_type == "verified_write" for e in events)
