from __future__ import annotations

import hashlib
import json
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ethos_aegis.mythos_runtime.memory import MemoryEvent, MemoryLedger
from ethos_aegis.mythos_runtime.swd import StrictWriteDiscipline

from .ckan_adapter import (
    CKANCapabilityMatrix,
    CKANClient,
    CKANIngestionResult,
    IngestionAttempt,
    SchemaField,
)


@dataclass
class DatasetCacheEntry:
    resource_id: str
    digest: str
    rows: list[dict[str, Any]]
    fields: list[SchemaField]
    package_id: str | None = None
    ingestion_path: str = "unknown"
    ingestion_attempts: list[IngestionAttempt] = field(default_factory=list)
    ingestion_metadata: dict[str, Any] = field(default_factory=dict)


class VeriflowImmuneSystem:
    def __init__(
        self,
        ckan: CKANClient,
        verifier: Any | None = None,
        *,
        probe_on_startup: bool = True,
        sample_resource_id: str | None = None,
        fingerprint_mode: str = "auto",
        persist_host_state: bool = True,
        state_dir: str | Path | None = None,
    ) -> None:
        self.ckan = ckan
        self.verifier = verifier
        # Supported values: "auto" (default), "lightweight", "full".
        # "auto" selects the best available fingerprinting strategy.
        self.fingerprint_mode = fingerprint_mode
        self._cache: dict[str, DatasetCacheEntry] = {}
        self._capability_matrix: CKANCapabilityMatrix | None = None
        self._probe_sample_resource_id = sample_resource_id
        self._persist_host_state = persist_host_state
        self._state_dir = (
            Path(state_dir)
            if state_dir is not None
            else Path(tempfile.gettempdir()) / "ethos_aegis_veriflow_state"
        )
        self._memory_ledger = MemoryLedger(self._state_dir / "MEMORY.md")
        self._runtime_discipline = StrictWriteDiscipline(
            self._state_dir,
            memory_ledger=self._memory_ledger,
        )
        self._state = (
            self._load_state() if persist_host_state else {"resources": {}}
        )
        if probe_on_startup:
            self.bootstrap(sample_resource_id=sample_resource_id)

    @property
    def capability_matrix(self) -> CKANCapabilityMatrix | None:
        return self._capability_matrix

    @property
    def state_file(self) -> Path:
        return self._state_dir / f"{self._host_key()}.json"

    def _host_key(self) -> str:
        return hashlib.sha256(self.ckan.base_url.encode("utf-8")).hexdigest()[:16]

    def _load_state(self) -> dict[str, Any]:
        path = self.state_file
        if not path.exists():
            return {"host": self.ckan.base_url, "resources": {}}
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"host": self.ckan.base_url, "resources": {}}
        if not isinstance(payload, dict):
            return {"host": self.ckan.base_url, "resources": {}}
        payload.setdefault("host", self.ckan.base_url)
        payload.setdefault("resources", {})
        return payload

    def _save_state(self) -> None:
        if not self._persist_host_state:
            return
        payload = json.dumps(self._state, indent=2, sort_keys=True)
        self._runtime_discipline.write_text(
            self.state_file.name,
            payload,
            description="Persist host capability and resource state",
        )

    def bootstrap(self, *, sample_resource_id: str | None = None) -> CKANCapabilityMatrix:
        sample = sample_resource_id or self._probe_sample_resource_id
        matrix = self.ckan.probe_capabilities(sample_resource_id=sample)
        self._capability_matrix = matrix
        self._probe_sample_resource_id = sample
        self._state["capability_matrix"] = matrix.to_dict()
        self._state["probe_sample_resource_id"] = sample
        self._save_state()
        return matrix

    def refresh_resource(self, resource_id: str) -> DatasetCacheEntry:
        if self._capability_matrix is None:
            self.bootstrap(sample_resource_id=resource_id)
        result: CKANIngestionResult = self.ckan.ingest_resource(resource_id)
        digest = hashlib.sha256(
            json.dumps(result.rows, sort_keys=True).encode("utf-8")
        ).hexdigest()
        entry = DatasetCacheEntry(
            resource_id=result.resource_id,
            digest=digest,
            rows=result.rows,
            fields=result.fields,
            package_id=result.package_id,
            ingestion_path=result.path,
            ingestion_attempts=result.attempts,
            ingestion_metadata=result.metadata,
        )
        self._cache[resource_id] = entry
        self._state.setdefault("resources", {})[resource_id] = {
            "digest": digest,
            "package_id": result.package_id,
            "ingestion_path": result.path,
            "ingestion_metadata": result.metadata,
        }
        self._save_state()
        self._memory_ledger.append_event(
            MemoryEvent(
                event_type="resource_refresh",
                summary=f"Refreshed resource {resource_id} through {result.path}.",
                payload={
                    "resource_id": resource_id,
                    "ingestion_path": result.path,
                    "rows": len(result.rows),
                },
            )
        )
        return entry

    def cache_entry(self, resource_id: str) -> DatasetCacheEntry | None:
        return self._cache.get(resource_id)
