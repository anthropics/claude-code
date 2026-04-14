from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CKANVersion:
    raw: str
    major: int | None = None
    minor: int | None = None
    patch: int | None = None
    prerelease: str | None = None

    @classmethod
    def parse(cls, value: str) -> "CKANVersion":
        text = (value or "").strip()
        if not text:
            return cls(raw="unknown")
        prerelease = None
        core = text
        for marker in ("a", "b", "rc"):
            if marker in text:
                idx = text.find(marker)
                core = text[:idx]
                prerelease = text[idx:]
                break
        parts = core.split(".")
        nums: list[int | None] = []
        for part in parts[:3]:
            try:
                nums.append(int(part))
            except ValueError:
                nums.append(None)
        while len(nums) < 3:
            nums.append(None)
        return cls(
            raw=text,
            major=nums[0],
            minor=nums[1],
            patch=nums[2],
            prerelease=prerelease,
        )


@dataclass
class SchemaField:
    name: str
    label: str | None = None
    description: str | None = None
    aliases: tuple[str, ...] = ()
    unit: str | None = None
    field_type: str = "string"


@dataclass
class IngestionAttempt:
    path: str
    ok: bool
    detail: str


@dataclass
class CapabilityRecord:
    name: str
    state: str
    source: str = "unknown"
    detail: str = ""


@dataclass
class CKANCapabilityMatrix:
    api_base: str
    version: CKANVersion
    capabilities: dict[str, CapabilityRecord] = field(default_factory=dict)

    def supports(self, name: str) -> bool:
        record = self.capabilities.get(name)
        return bool(record and record.state in {"available", "inferred", "partial"})

    def to_dict(self) -> dict[str, Any]:
        return {
            "api_base": self.api_base,
            "version": {
                "raw": self.version.raw,
                "major": self.version.major,
                "minor": self.version.minor,
                "patch": self.version.patch,
                "prerelease": self.version.prerelease,
            },
            "capabilities": {
                name: {
                    "name": record.name,
                    "state": record.state,
                    "source": record.source,
                    "detail": record.detail,
                }
                for name, record in self.capabilities.items()
            },
        }


@dataclass
class CKANIngestionResult:
    resource_id: str
    package_id: str | None
    path: str
    rows: list[dict[str, Any]]
    fields: list[SchemaField]
    resource: dict[str, Any]
    package: dict[str, Any] | None
    attempts: list[IngestionAttempt] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class CKANClient:
    def __init__(self, base_url: str, api_key: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def probe_capabilities(
        self,
        *,
        sample_resource_id: str | None = None,
    ) -> CKANCapabilityMatrix:
        return CKANCapabilityMatrix(
            api_base=f"{self.base_url}/api/3/action",
            version=CKANVersion(raw="unknown"),
            capabilities={},
        )

    def ingest_resource(self, resource_id: str, **_: Any) -> CKANIngestionResult:
        raise NotImplementedError(
            "Provide a concrete CKAN client or test double for resource ingestion."
        )
