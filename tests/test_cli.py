from __future__ import annotations

import json
from pathlib import Path

from ethos_aegis.mythos_runtime.cli import build_parser, main
from ethos_aegis.mythos_runtime.memory import MemoryEvent, MemoryLedger
from ethos_aegis.mythos_runtime.swd import StrictWriteDiscipline


# ---------------------------------------------------------------------------
# build_parser
# ---------------------------------------------------------------------------


def test_build_parser_prog_name() -> None:
    parser = build_parser()
    assert parser.prog == "mythos-runtime"


def test_build_parser_verify_subcommand() -> None:
    parser = build_parser()
    args = parser.parse_args(["verify"])
    assert args.command == "verify"
    assert args.json is False


def test_build_parser_verify_json_flag() -> None:
    parser = build_parser()
    args = parser.parse_args(["verify", "--json"])
    assert args.json is True


def test_build_parser_dream_defaults() -> None:
    parser = build_parser()
    args = parser.parse_args(["dream"])
    assert args.command == "dream"
    assert args.max_entries == 100
    assert args.keep_recent == 20
    assert args.dry_run is False


def test_build_parser_dream_custom_values() -> None:
    parser = build_parser()
    args = parser.parse_args(["dream", "--max-entries", "50", "--keep-recent", "10", "--dry-run"])
    assert args.max_entries == 50
    assert args.keep_recent == 10
    assert args.dry_run is True


# ---------------------------------------------------------------------------
# main — verify command (no drifted files)
# ---------------------------------------------------------------------------


def test_main_verify_plain_output(tmp_path: Path, capsys) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("file.txt", "stable\n")

    rc = main(["--root", str(tmp_path), "verify"])
    assert rc == 0
    captured = capsys.readouterr()
    assert "verified=" in captured.out
    assert "drifted=" in captured.out


def test_main_verify_json_output(tmp_path: Path, capsys) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("file.txt", "stable\n")

    rc = main(["--root", str(tmp_path), "verify", "--json"])
    assert rc == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert "verified" in payload
    assert "drifted" in payload
    assert "missing" in payload
    assert "unknown" in payload


# ---------------------------------------------------------------------------
# main — verify command with drifted file
# ---------------------------------------------------------------------------


def test_main_verify_detects_drift(tmp_path: Path, capsys) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("watch.txt", "original\n")
    # Tamper outside SWD
    (tmp_path / "watch.txt").write_text("tampered\n", encoding="utf-8")

    main(["--root", str(tmp_path), "--memory", "MEMORY.md", "verify", "--json"])
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert "watch.txt" in payload["drifted"]


# ---------------------------------------------------------------------------
# main — dream command
# ---------------------------------------------------------------------------


def test_main_dream_compresses(tmp_path: Path, capsys) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for i in range(10):
        ledger.append_event(MemoryEvent(event_type="x", summary=f"e{i}", payload={}))

    rc = main(["--root", str(tmp_path), "dream", "--max-entries", "5", "--keep-recent", "3"])
    assert rc == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["compressed"] is True
    assert result["preserved"] == 3


def test_main_dream_dry_run(tmp_path: Path, capsys) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for i in range(6):
        ledger.append_event(MemoryEvent(event_type="y", summary=f"e{i}", payload={}))
    original = (tmp_path / "MEMORY.md").read_text(encoding="utf-8")

    main(["--root", str(tmp_path), "dream", "--max-entries", "3", "--keep-recent", "2", "--dry-run"])
    assert (tmp_path / "MEMORY.md").read_text(encoding="utf-8") == original
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result.get("dry_run") is True


def test_main_dream_no_compress_needed(tmp_path: Path, capsys) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    ledger.append_event(MemoryEvent(event_type="z", summary="s", payload={}))

    rc = main(["--root", str(tmp_path), "dream", "--max-entries", "100"])
    assert rc == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["compressed"] is False
