class DriftDetector:
    def __init__(
        self,
        root: str | Path,
        *,
        ledger: MemoryLedger,
        swd: StrictWriteDiscipline | None = None,
    ) -> None:
        self.root = Path(root)
        self.ledger = ledger
        self.swd = swd or StrictWriteDiscipline(
            root,
            memory_ledger=ledger,
        )

    def scan(self) -> DriftScanResult:
        last_known, missing_candidates = self._collect_last_known()
        return self._compare_against_filesystem(
            last_known,
            missing_candidates,
        )

    def _collect_last_known(self) -> tuple[dict[str, str | None], set[str]]:
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
        return last_known, missing_candidates

    def _compare_against_filesystem(
        self,
        last_known: dict[str, str | None],
        missing_candidates: set[str],
    ) -> DriftScanResult:
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
