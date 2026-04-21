from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .memory import MemoryLedger
from .swd import StrictWriteDiscipline


@dataclass(slots=True)
class DriftScanResult:
    verified: list[str] = field(default_factory=list)
    drifted: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    unknown: list[str] = field(default_factory=list)


class DriftDetector:
    def __init__(self, root: str | Path, *, ledger: MemoryLedger, swd: StrictWriteDiscipline | None = None) -> None:
        self.root = Path(root)
        self.ledger = ledger
        self.swd = swd or StrictWriteDiscipline(root, memory_ledger=ledger)

    def scan(self) -> DriftScanResult:
        last_known: dict[str, str | None] = {}
        missing_candidates: set[str] = set()
        for event in self.ledger.list_events():
            if event.event_type != "verified_write":
                continue
            for action in event.payload.get("verified_actions", []):
                path = str(action.get("path") or "")
                after = action.get("after") or {}
                if not path:
                    continue
                if after.get("exists"):
                    last_known[path] = after.get("sha256")
                else:
                    missing_candidates.add(path)
        result = DriftScanResult()
        for path, known_hash in last_known.items():
            current = self.swd.snapshot([path]).get(path)
            if current is None or not current.exists:
                result.missing.append(path)
            elif current.sha256 == known_hash:
                result.verified.append(path)
            else:
                result.drifted.append(path)
        for path in sorted(missing_candidates - set(last_known)):
            if not (self.root / path).exists():
                result.missing.append(path)
        return result
