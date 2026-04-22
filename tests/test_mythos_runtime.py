from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ethos_aegis.mythos_runtime import (  # noqa: E402
    DriftDetector,
    MemoryEvent,
    MemoryLedger,
    StrictWriteDiscipline,
)
from ethos_aegis.veriflow.ckan_adapter import (  # noqa: E402
    CKANCapabilityMatrix,
    CKANIngestionResult,
    CKANVersion,
    CapabilityRecord,
    IngestionAttempt,
    SchemaField,
)
from ethos_aegis.veriflow.immune_system import VeriflowImmuneSystem  # noqa: E402


class FakeVerificationResult:
    passed = True
    issue_type = ""


class FakeVerifier:
    def verify_source_snapshot(self, payload: str) -> FakeVerificationResult:
        return FakeVerificationResult()


class FakeCKAN:
    base_url = "https://example.test"

    def probe_capabilities(
        self,
        *,
        sample_resource_id: str | None = None,
    ) -> CKANCapabilityMatrix:
        capabilities = {
            "datastore": CapabilityRecord(
                name="datastore",
                state="available",
                source="test",
            )
        }
        return CKANCapabilityMatrix(
            api_base="https://example.test/api/3/action",
            version=CKANVersion.parse("2.11.4"),
            capabilities=capabilities,
        )

    def ingest_resource(self, resource_id: str, **kwargs) -> CKANIngestionResult:
        return CKANIngestionResult(
            resource_id=resource_id,
            package_id="pkg-1",
            path="datastore",
            rows=[{"visits": 10, "clicks": 2}],
            fields=[
                SchemaField(name="visits", field_type="integer"),
                SchemaField(name="clicks", field_type="integer"),
            ],
            resource={"id": resource_id, "package_id": "pkg-1"},
            package={"id": "pkg-1"},
            attempts=[
                IngestionAttempt("datastore", True, "selected datastore")
            ],
            metadata={"source": "datastore"},
        )


def test_strict_write_discipline_verifies_create_and_modify(
    tmp_path: Path,
) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)

    create = swd.write_text("a.txt", "alpha\n", description="create")
    modify = swd.write_text("a.txt", "beta\n", description="modify")

    assert create.ok is True
    assert modify.ok is True
    assert len(ledger.list_events()) >= 2


def test_drift_detector_flags_changed_file(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    swd = StrictWriteDiscipline(tmp_path, memory_ledger=ledger)
    swd.write_text("a.txt", "alpha\n")
    (tmp_path / "a.txt").write_text("changed\n", encoding="utf-8")

    result = DriftDetector(tmp_path, ledger=ledger, swd=swd).scan()
    assert "a.txt" in result.drifted


def test_memory_compress_summarizes_old_entries(tmp_path: Path) -> None:
    ledger = MemoryLedger(tmp_path / "MEMORY.md")
    for idx in range(6):
        ledger.append_event(
            MemoryEvent(
                event_type="write",
                summary=f"event {idx}",
                payload={"idx": idx},
            )
        )
    result = ledger.compress(max_entries=3, keep_recent=2)
    assert result["compressed"] is True
    events = ledger.list_events()
    assert any(event.event_type == "dream_summary" for event in events)


def test_immune_system_persists_state_through_swd_and_logs_memory(
    tmp_path: Path,
) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        verifier=FakeVerifier(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    immune.refresh_resource("res-1")

    assert immune.state_file.exists()
    memory_path = tmp_path / "MEMORY.md"
    assert memory_path.exists()
    memory_text = memory_path.read_text(encoding="utf-8")
    assert "verified_write" in memory_text
    assert "resource_refresh" in memory_text
