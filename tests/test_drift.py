from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ethos_aegis.mythos_runtime.drift import DriftDetector, DriftScanResult
from ethos_aegis.mythos_runtime.memory import MemoryLedger
from ethos_aegis.mythos_runtime.swd import StrictWriteDiscipline


# ---------------------------------------------------------------------------
# Verified file — content unchanged
# ---------------------------------------------------------------------------


def test_drift_detector_reports_verified(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("stable.txt", "no-change\n")
    result = DriftDetector(tmp_path, ledger=ledger, swd=swd).scan()
    assert "stable.txt" in result.verified
    assert "stable.txt" not in result.drifted


# ---------------------------------------------------------------------------
# Missing file — was written but later deleted
# ---------------------------------------------------------------------------


def test_drift_detector_reports_missing(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("gone.txt", "here\n")
    (tmp_path / "gone.txt").unlink()
    result = DriftDetector(tmp_path, ledger=ledger, swd=swd).scan()
    assert "gone.txt" in result.missing


# ---------------------------------------------------------------------------
# Multiple files — mix of verified, drifted, missing
# ---------------------------------------------------------------------------


def test_drift_detector_mixed_states(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)

    swd.write_text("ok.txt", "stable\n")
    swd.write_text("changed.txt", "original\n")
    swd.write_text("removed.txt", "content\n")

    # Drift changed.txt
    (tmp_path / "changed.txt").write_text("different\n", encoding="utf-8")
    # Remove removed.txt
    (tmp_path / "removed.txt").unlink()

    result = DriftDetector(tmp_path, ledger=ledger, swd=swd).scan()
    assert "ok.txt" in result.verified
    assert "changed.txt" in result.drifted
    assert "removed.txt" in result.missing


# ---------------------------------------------------------------------------
# DriftDetector creates its own SWD when not provided
# ---------------------------------------------------------------------------


def test_drift_detector_creates_swd_if_none(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    # Pass no swd — DriftDetector should instantiate one internally
    detector = DriftDetector(tmp_path, ledger=ledger, swd=None)
    result = detector.scan()
    assert isinstance(result, DriftScanResult)


# ---------------------------------------------------------------------------
# Empty ledger yields empty result
# ---------------------------------------------------------------------------


def test_drift_detector_empty_ledger(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    result = DriftDetector(tmp_path, ledger=ledger, swd=swd).scan()
    assert result.verified == []
    assert result.drifted == []
    assert result.missing == []
