from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ethos_aegis.mythos_runtime.memory import MemoryEvent, MemoryLedger


# ---------------------------------------------------------------------------
# MemoryEvent.to_markdown
# ---------------------------------------------------------------------------


def test_to_markdown_contains_event_type(tmp_path: Path) -> None:
    event = MemoryEvent(event_type="test_event", summary="hello", payload={"k": 1}, created_at="2024-01-01T00:00:00+00:00")
    md = event.to_markdown()
    assert "test_event" in md
    assert "hello" in md
    assert "2024-01-01T00:00:00+00:00" in md


def test_to_markdown_valid_json_block() -> None:
    event = MemoryEvent(event_type="e", summary="s", payload={"x": 42})
    md = event.to_markdown()
    start = md.index("```json\n") + len("```json\n")
    end = md.index("\n```", start)
    parsed = json.loads(md[start:end])
    assert parsed["x"] == 42


# ---------------------------------------------------------------------------
# MemoryLedger – basic append / list_events
# ---------------------------------------------------------------------------


def test_append_and_list_events(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    event = MemoryEvent(event_type="ping", summary="pong", payload={"n": 1})
    ledger.append_event(event)
    events = ledger.list_events()
    assert len(events) == 1
    assert events[0].event_type == "ping"
    assert events[0].payload["n"] == 1


def test_list_events_returns_empty_when_file_missing(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "nonexistent.md")
    assert ledger.list_events() == []


def test_ensure_exists_creates_file_and_parents(tmp_path: Path) -> None:
    deep_path = tmp_path / "a" / "b" / "MEMORY.md"
    ledger = MemoryLedger(deep_path)
    ledger.ensure_exists()
    assert deep_path.exists()
    assert MemoryLedger.HEADER in deep_path.read_text(encoding="utf-8")


def test_ensure_exists_idempotent(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    ledger.ensure_exists()
    ledger.ensure_exists()  # second call must not overwrite
    text = (tmp_path / "MEMORY.md").read_text(encoding="utf-8")
    assert text.count("# MEMORY") == 1


def test_list_events_skips_corrupt_sections(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    ledger.append_event(MemoryEvent(event_type="good", summary="ok", payload={}))
    # Inject a malformed section
    with (tmp_path / "MEMORY.md").open("a", encoding="utf-8") as f:
        f.write("## NOT·VALID\n\nsome text without json block\n\n")
    events = ledger.list_events()
    # Only the well-formed event should parse
    assert all(e.event_type == "good" for e in events)


# ---------------------------------------------------------------------------
# MemoryLedger.compress
# ---------------------------------------------------------------------------


def test_compress_returns_false_when_below_limit(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for i in range(3):
        ledger.append_event(MemoryEvent(event_type="x", summary=f"e{i}", payload={"i": i}))
    result = ledger.compress(max_entries=10, keep_recent=5)
    assert result["compressed"] is False
    assert result["events"] == 3


def test_compress_dry_run_does_not_modify_file(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for i in range(6):
        ledger.append_event(MemoryEvent(event_type="x", summary=f"e{i}", payload={}))
    original_text = (tmp_path / "MEMORY.md").read_text(encoding="utf-8")
    result = ledger.compress(max_entries=3, keep_recent=2, dry_run=True)
    assert result["compressed"] is True
    assert result.get("dry_run") is True
    assert (tmp_path / "MEMORY.md").read_text(encoding="utf-8") == original_text


def test_compress_keeps_recent_events(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for i in range(10):
        ledger.append_event(MemoryEvent(event_type="x", summary=f"event {i}", payload={"i": i}))
    ledger.compress(max_entries=5, keep_recent=3)
    events = ledger.list_events()
    # One dream_summary + 3 preserved
    assert len(events) == 4
    summaries = [e for e in events if e.event_type == "dream_summary"]
    assert len(summaries) == 1


def test_compress_summary_payload_counts(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for i in range(8):
        etype = "write" if i % 2 == 0 else "read"
        ledger.append_event(MemoryEvent(event_type=etype, summary="s", payload={}))
    ledger.compress(max_entries=4, keep_recent=2)
    dream = next(e for e in ledger.list_events() if e.event_type == "dream_summary")
    counts = dream.payload["event_type_counts"]
    assert counts["write"] + counts["read"] == 6  # 8 - 2 archived


# ---------------------------------------------------------------------------
# MemoryLedger._type_counts
# ---------------------------------------------------------------------------


def test_type_counts_direct(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    events = [
        MemoryEvent(event_type="a", summary="", payload={}),
        MemoryEvent(event_type="b", summary="", payload={}),
        MemoryEvent(event_type="a", summary="", payload={}),
    ]
    counts = ledger._type_counts(events)
    assert counts == {"a": 2, "b": 1}
