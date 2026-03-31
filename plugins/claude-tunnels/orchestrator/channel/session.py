"""Per-source conversation session with turn history and state machine."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 30 * 60  # 30 min idle → auto-expire


class SessionState(Enum):
    IDLE = "idle"
    PENDING_CONFIRM = "pending_confirm"
    EXECUTING = "executing"
    AWAITING_FOLLOWUP = "awaiting_followup"


DONE_KEYWORDS = {"done", "no", "nothing", "nope", "end", "quit", "exit"}


@dataclass
class Turn:
    role: str  # "user" or "assistant"
    text: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class Session:
    source_key: str
    turns: list[Turn] = field(default_factory=list)
    state: SessionState = SessionState.IDLE
    pending_request_id: str | None = None
    created_at: float = field(default_factory=time.time)
    last_active: float = field(default_factory=time.time)

    @property
    def is_expired(self) -> bool:
        return (time.time() - self.last_active) > SESSION_TTL_SECONDS

    def add_user_turn(self, text: str) -> None:
        self.turns.append(Turn(role="user", text=text))
        self.last_active = time.time()

    def add_assistant_turn(self, text: str) -> None:
        self.turns.append(Turn(role="assistant", text=text))
        self.last_active = time.time()

    def to_context_string(self, max_turns: int = 20) -> str:
        recent = self.turns[-max_turns:]
        if not recent:
            return ""
        lines = []
        for turn in recent:
            prefix = "User" if turn.role == "user" else "Bot"
            lines.append(f"[{prefix}] {turn.text}")
        return "\n".join(lines)

    def clear(self) -> None:
        self.turns.clear()
        self.state = SessionState.IDLE
        self.pending_request_id = None
        self.last_active = time.time()


class SessionStore:
    """In-memory session store keyed by source_key."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def get_or_create(self, source_key: str) -> Session:
        session = self._sessions.get(source_key)
        if session is None or session.is_expired:
            if session and session.is_expired:
                logger.info("Session expired for %s, creating new", source_key)
            session = Session(source_key=source_key)
            self._sessions[source_key] = session
        return session

    def clear(self, source_key: str) -> None:
        session = self._sessions.get(source_key)
        if session:
            session.clear()
            logger.info("Session cleared for %s", source_key)

    def remove(self, source_key: str) -> None:
        self._sessions.pop(source_key, None)

    def cleanup_expired(self) -> int:
        expired = [k for k, s in self._sessions.items() if s.is_expired]
        for k in expired:
            del self._sessions[k]
        return len(expired)
