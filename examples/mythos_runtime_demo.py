from __future__ import annotations

from pathlib import Path
import tempfile

from ethos_aegis.mythos_runtime import DriftDetector, MemoryLedger, StrictWriteDiscipline


def main() -> None:
    root = Path(tempfile.mkdtemp(prefix="mythos_runtime_demo_"))
    ledger = MemoryLedger(root / "MEMORY.md")
    swd = StrictWriteDiscipline(root, memory_ledger=ledger)

    report = swd.write_text("notes/example.txt", "hello mythos\n", description="Create demo note")
    print({"ok": report.ok, "detail": report.detail, "path": "notes/example.txt"})

    drift = DriftDetector(root, ledger=ledger, swd=swd).scan()
    print({"verified": drift.verified, "drifted": drift.drifted, "missing": drift.missing})


if __name__ == "__main__":
    main()
