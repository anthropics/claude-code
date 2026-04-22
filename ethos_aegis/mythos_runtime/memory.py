from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


@dataclass
class MemoryEvent:
    event_type: str
    summary: str
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_markdown(self) -> str:
        return (
            f"## {self.created_at} · {self.event_type}\n"
            f"{self.summary}\n\n"
            f"```json\n{json.dumps(self.payload, indent=2, sort_keys=True)}\n```\n"
        )


class MemoryLedger:
    HEADER = (
        "# MEMORY\n\n"
        "Persistent execution ledger for Ethos Aegis × Claude Mythos.\n\n"
    )

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def ensure_exists(self) -> None:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(self.HEADER, encoding="utf-8")

    def append_event(self, event: MemoryEvent) -> None:
        self.ensure_exists()
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(event.to_markdown())
            handle.write("\n")

    def list_events(self) -> list[MemoryEvent]:
        if not self.path.exists():
            return []
        text = self.path.read_text(encoding="utf-8")
        sections = [
            section.strip()
            for section in text.split("## ")
            if section.strip() and "```json" in section
        ]
        events: list[MemoryEvent] = []
        for section in sections:
            try:
                heading, rest = section.split("\n", 1)
                summary, json_block = rest.split("```json\n", 1)
                payload_text = json_block.split("\n```", 1)[0]
                created_at, event_type = heading.split(" · ", 1)
                events.append(
                    MemoryEvent(
                        event_type=event_type.strip(),
                        summary=summary.strip(),
                        payload=json.loads(payload_text),
                        created_at=created_at.strip(),
                    )
                )
            except Exception:
                continue
        return events

    def compress(
        self,
        *,
        max_entries: int = 100,
        keep_recent: int = 20,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        events = self.list_events()
        if len(events) <= max_entries:
            return {"compressed": False, "events": len(events)}
        preserved = events[-keep_recent:]
        archived = events[:-keep_recent]
        summary_payload = {
            "archived_entries": len(archived),
            "event_type_counts": self._type_counts(archived),
            "from": archived[0].created_at if archived else None,
            "to": archived[-1].created_at if archived else None,
        }
        summary_event = MemoryEvent(
            event_type="dream_summary",
            summary=(
                "Compressed older ledger entries into a deterministic "
                "summary block."
            ),
            payload=summary_payload,
        )
        if dry_run:
            return {
                "compressed": True,
                "dry_run": True,
                "summary": summary_payload,
                "preserved": len(preserved),
            }
        self.ensure_exists()
        content = (
            self.HEADER
            + summary_event.to_markdown()
            + "\n"
            + "\n".join(event.to_markdown() for event in preserved)
            + "\n"
        )
        self.path.write_text(content, encoding="utf-8")
        return {
            "compressed": True,
            "summary": summary_payload,
            "preserved": len(preserved),
        }

    def _type_counts(self, events: Iterable[MemoryEvent]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for event in events:
            counts[event.event_type] = counts.get(event.event_type, 0) + 1
        return counts
