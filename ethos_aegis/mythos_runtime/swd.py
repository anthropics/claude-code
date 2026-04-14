from __future__ import annotations

import fnmatch
import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from .memory import MemoryEvent, MemoryLedger


@dataclass(frozen=True)
class FileSnapshot:
    path: str
    exists: bool
    size: int | None
    sha256: str | None


@dataclass
class ClaimedFileAction:
    path: str
    action: str
    description: str = ""


@dataclass
class VerificationReport:
    ok: bool
    claimed_actions: list[ClaimedFileAction]
    verified_actions: list[ClaimedFileAction]
    before: dict[str, FileSnapshot]
    after: dict[str, FileSnapshot]
    detail: str
    dry_run: bool = False


class StrictWriteDiscipline:
    def __init__(
        self,
        root: str | Path,
        *,
        memory_ledger: MemoryLedger | None = None,
        ignore_patterns: list[str] | None = None,
    ) -> None:
        self.root = Path(root)
        self.memory_ledger = memory_ledger
        self.ignore_patterns = ignore_patterns or [
            ".git/*",
            "__pycache__/*",
            "*.pyc",
        ]

    def snapshot(self, paths: Iterable[str] | None = None) -> dict[str, FileSnapshot]:
        if paths is None:
            candidates = [path for path in self.root.rglob("*") if path.is_file()]
            rel_paths = [
                str(path.relative_to(self.root))
                for path in candidates
                if not self._ignored(path.relative_to(self.root))
            ]
        else:
            rel_paths = [self._normalize(path) for path in paths]
        snapshots: dict[str, FileSnapshot] = {}
        for rel_path in rel_paths:
            full_path = self.root / rel_path
            if full_path.exists() and full_path.is_file():
                data = full_path.read_bytes()
                snapshots[rel_path] = FileSnapshot(
                    path=rel_path,
                    exists=True,
                    size=len(data),
                    sha256=hashlib.sha256(data).hexdigest(),
                )
            else:
                snapshots[rel_path] = FileSnapshot(
                    path=rel_path,
                    exists=False,
                    size=None,
                    sha256=None,
                )
        return snapshots

    def verify_claims(
        self,
        claimed_actions: list[ClaimedFileAction],
        before: dict[str, FileSnapshot],
        after: dict[str, FileSnapshot],
        *,
        dry_run: bool = False,
    ) -> VerificationReport:
        verified: list[ClaimedFileAction] = []
        mismatches: list[str] = []
        for action in claimed_actions:
            before_state = before.get(
                action.path,
                FileSnapshot(action.path, False, None, None),
            )
            after_state = after.get(
                action.path,
                FileSnapshot(action.path, False, None, None),
            )
            matched = (
                (action.action == "CREATE" and not before_state.exists and after_state.exists)
                or (
                    action.action == "MODIFY"
                    and before_state.exists
                    and after_state.exists
                    and before_state.sha256 != after_state.sha256
                )
                or (action.action == "DELETE" and before_state.exists and not after_state.exists)
            )
            if matched or dry_run:
                verified.append(action)
            else:
                mismatches.append(f"{action.action} {action.path}")
        ok = not mismatches
        detail = "verified" if ok else f"mismatch: {', '.join(mismatches)}"
        report = VerificationReport(
            ok=ok,
            claimed_actions=claimed_actions,
            verified_actions=verified,
            before=before,
            after=after,
            detail=detail,
            dry_run=dry_run,
        )
        self._record_report(report)
        return report

    def write_text(
        self,
        path: str | Path,
        content: str,
        *,
        description: str = "",
        dry_run: bool = False,
    ) -> VerificationReport:
        rel_path = self._normalize(path)
        full_path = self.root / rel_path
        action = "MODIFY" if full_path.exists() else "CREATE"
        before = self.snapshot([rel_path])
        if not dry_run:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
        after = self.snapshot([rel_path]) if not dry_run else before
        return self.verify_claims(
            [ClaimedFileAction(rel_path, action, description)],
            before,
            after,
            dry_run=dry_run,
        )

    def _record_report(self, report: VerificationReport) -> None:
        if self.memory_ledger is None:
            return
        payload = {
            "ok": report.ok,
            "detail": report.detail,
            "dry_run": report.dry_run,
            "claimed_actions": [
                {
                    "path": action.path,
                    "action": action.action,
                    "description": action.description,
                }
                for action in report.claimed_actions
            ],
            "verified_actions": [
                {
                    "path": action.path,
                    "action": action.action,
                    "description": action.description,
                    "after": (
                        asdict(report.after.get(action.path))
                        if report.after.get(action.path)
                        else None
                    ),
                }
                for action in report.verified_actions
            ],
        }
        self.memory_ledger.append_event(
            MemoryEvent(
                event_type="verified_write",
                summary="Strict write discipline verification completed.",
                payload=payload,
            )
        )

    def _normalize(self, path: str | Path) -> str:
        return str(Path(path)).replace("\\", "/")

    def _ignored(self, rel_path: Path) -> bool:
        text = str(rel_path).replace("\\", "/")
        return any(fnmatch.fnmatch(text, pattern) for pattern in self.ignore_patterns)
