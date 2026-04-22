from __future__ import annotations

import json
from pathlib import Path

from ethos_aegis.veriflow.ckan_adapter import (
    CKANCapabilityMatrix,
    CKANIngestionResult,
    CKANVersion,
    CapabilityRecord,
    IngestionAttempt,
    SchemaField,
)
from ethos_aegis.veriflow.immune_system import DatasetCacheEntry, VeriflowImmuneSystem


# ---------------------------------------------------------------------------
# Test doubles shared across tests
# ---------------------------------------------------------------------------


class FakeVerificationResult:
    passed = True
    issue_type = ""


class FakeVerifier:
    def verify_source_snapshot(self, payload: str) -> FakeVerificationResult:
        return FakeVerificationResult()


class FakeCKAN:
    base_url = "https://fake.test"

    def probe_capabilities(
        self,
        *,
        sample_resource_id: str | None = None,
    ) -> CKANCapabilityMatrix:
        return CKANCapabilityMatrix(
            api_base="https://fake.test/api/3/action",
            version=CKANVersion.parse("2.11.0"),
            capabilities={
                "datastore": CapabilityRecord(name="datastore", state="available", source="test"),
            },
        )

    def ingest_resource(self, resource_id: str, **kwargs) -> CKANIngestionResult:
        return CKANIngestionResult(
            resource_id=resource_id,
            package_id="pkg-test",
            path="datastore",
            rows=[{"value": 99}],
            fields=[SchemaField(name="value", field_type="integer")],
            resource={"id": resource_id},
            package={"id": "pkg-test"},
            attempts=[IngestionAttempt("datastore", True, "ok")],
            metadata={"source": "datastore"},
        )


# ---------------------------------------------------------------------------
# bootstrap / capability_matrix
# ---------------------------------------------------------------------------


def test_bootstrap_sets_capability_matrix(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    assert immune.capability_matrix is not None
    assert immune.capability_matrix.supports("datastore") is True


def test_bootstrap_without_probe_on_startup(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    assert immune.capability_matrix is None


def test_bootstrap_explicit_call(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    matrix = immune.bootstrap()
    assert immune.capability_matrix is matrix


# ---------------------------------------------------------------------------
# refresh_resource
# ---------------------------------------------------------------------------


def test_refresh_resource_returns_entry(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    entry = immune.refresh_resource("res-abc")
    assert isinstance(entry, DatasetCacheEntry)
    assert entry.resource_id == "res-abc"
    assert entry.rows == [{"value": 99}]
    assert entry.package_id == "pkg-test"


def test_refresh_resource_triggers_bootstrap_if_needed(tmp_path: Path) -> None:
    """Calling refresh_resource without prior bootstrap should auto-bootstrap."""
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    assert immune.capability_matrix is None
    immune.refresh_resource("res-xyz")
    assert immune.capability_matrix is not None


def test_refresh_resource_digest_is_sha256_of_rows(tmp_path: Path) -> None:
    import hashlib

    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    entry = immune.refresh_resource("r1")
    expected = hashlib.sha256(json.dumps([{"value": 99}], sort_keys=True).encode()).hexdigest()
    assert entry.digest == expected


# ---------------------------------------------------------------------------
# cache_entry
# ---------------------------------------------------------------------------


def test_cache_entry_returns_none_before_refresh(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    assert immune.cache_entry("missing") is None


def test_cache_entry_returns_entry_after_refresh(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    immune.refresh_resource("r2")
    assert immune.cache_entry("r2") is not None
    assert immune.cache_entry("r2").resource_id == "r2"


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------


def test_state_file_is_created(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    assert immune.state_file.exists()


def test_state_file_contains_resource_entry(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    immune.refresh_resource("r3")
    state = json.loads(immune.state_file.read_text(encoding="utf-8"))
    assert "r3" in state["resources"]
    assert state["resources"]["r3"]["ingestion_path"] == "datastore"


def test_persist_host_state_false_does_not_create_file(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        persist_host_state=False,
        state_dir=tmp_path,
    )
    assert not immune.state_file.exists()


# ---------------------------------------------------------------------------
# _load_state — existing and corrupt state
# ---------------------------------------------------------------------------


def test_load_state_reuses_existing(tmp_path: Path) -> None:
    immune1 = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    immune1.refresh_resource("r-persist")

    # Second instance reads back the same state
    immune2 = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    assert "r-persist" in immune2._state.get("resources", {})


def test_load_state_handles_corrupt_json(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    # Corrupt the state file
    immune.state_file.write_text("NOT VALID JSON", encoding="utf-8")

    # A new instance should gracefully fall back to a fresh state
    immune2 = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    assert immune2._state.get("host") == "https://fake.test"
    assert immune2._state.get("resources") == {}


def test_load_state_handles_non_dict_json(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    immune.state_file.write_text("[1, 2, 3]", encoding="utf-8")

    immune2 = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        state_dir=tmp_path,
    )
    assert isinstance(immune2._state, dict)
    assert immune2._state.get("resources") == {}


# ---------------------------------------------------------------------------
# fingerprint_mode stored
# ---------------------------------------------------------------------------


def test_fingerprint_mode_stored(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=False,
        fingerprint_mode="lightweight",
        state_dir=tmp_path,
    )
    assert immune.fingerprint_mode == "lightweight"


# ---------------------------------------------------------------------------
# Memory ledger logs resource_refresh events
# ---------------------------------------------------------------------------


def test_memory_ledger_has_resource_refresh_event(tmp_path: Path) -> None:
    immune = VeriflowImmuneSystem(
        FakeCKAN(),
        probe_on_startup=True,
        state_dir=tmp_path,
    )
    immune.refresh_resource("r-mem")
    memory_text = (tmp_path / "MEMORY.md").read_text(encoding="utf-8")
    assert "resource_refresh" in memory_text
    assert "r-mem" in memory_text
