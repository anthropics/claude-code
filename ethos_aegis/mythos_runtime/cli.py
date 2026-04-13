from __future__ import annotations

import argparse
import json
from pathlib import Path

from .drift import DriftDetector
from .memory import MemoryLedger
from .swd import StrictWriteDiscipline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mythos-runtime", description="Strict write discipline and memory tools for Ethos Aegis.")
    parser.add_argument("--root", default=".", help="Project root")
    parser.add_argument("--memory", default="MEMORY.md", help="Memory ledger path relative to root")
    sub = parser.add_subparsers(dest="command", required=True)

    verify = sub.add_parser("verify", help="Scan project state against ledger.")
    verify.add_argument("--json", action="store_true", help="Emit JSON output")

    dream = sub.add_parser("dream", help="Compress old memory entries.")
    dream.add_argument("--max-entries", type=int, default=100)
    dream.add_argument("--keep-recent", type=int, default=20)
    dream.add_argument("--dry-run", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    ledger = MemoryLedger(root / args.memory)
    swd = StrictWriteDiscipline(root, memory_ledger=ledger)

    if args.command == "verify":
        result = DriftDetector(root, ledger=ledger, swd=swd).scan()
        payload = {
            "verified": result.verified,
            "drifted": result.drifted,
            "missing": result.missing,
            "unknown": result.unknown,
        }
        if args.json:
            print(json.dumps(payload, indent=2, sort_keys=True))
        else:
            print(f"verified={len(result.verified)} drifted={len(result.drifted)} missing={len(result.missing)}")
        return 0

    if args.command == "dream":
        result = ledger.compress(max_entries=args.max_entries, keep_recent=args.keep_recent, dry_run=args.dry_run)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0

    return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
if dry_run:
    return {
        "compressed": True,
        "dry_run": True,
        "summary": summary_payload,
        "preserved": len(preserved),
    }

content = (
    self.HEADER
    + summary_event.to_markdown()
    + "\n"
    + "\n".join(event.to_markdown() for event in preserved)
    + "\n"
)
