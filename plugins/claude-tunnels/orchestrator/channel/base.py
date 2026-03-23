"""Base channel adapter: shared confirm/cancel flow + session + user text refinement."""

from __future__ import annotations

import logging
import traceback
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, TYPE_CHECKING

from orchestrator.channel.session import (
    DONE_KEYWORDS,
    Session,
    SessionState,
    SessionStore,
)

if TYPE_CHECKING:
    from orchestrator.server import ConfirmGate

logger = logging.getLogger(__name__)

CONFIRM_KEYWORDS = {"yes", "y", "ok", "confirm", "proceed", "go"}
CANCEL_KEYWORDS = {"cancel", "no", "n", "abort", "stop"}


def load_credential_file(path: Path) -> dict[str, str]:
    """Parse a key : value credential file into a dict."""
    data: dict[str, str] = {}
    for line in path.read_text().strip().splitlines():
        if " : " not in line:
            continue
        key, value = line.split(" : ", 1)
        data[key.strip()] = value.strip()
    return data


def split_message(text: str, max_len: int = 2000) -> list[str]:
    """Split long messages at newlines to stay under max_len."""
    chunks: list[str] = []
    remaining = text
    while remaining:
        if len(remaining) <= max_len:
            chunks.append(remaining)
            break
        split_idx = remaining.rfind("\n", 0, max_len)
        if split_idx == -1 or split_idx < max_len // 2:
            split_idx = max_len
        chunks.append(remaining[:split_idx])
        remaining = remaining[split_idx:].lstrip("\n")
    return chunks


class BaseChannel(ABC):
    """Abstract base for channel adapters with shared session + confirm/cancel flow."""

    channel_name: str

    def __init__(self, confirm_gate: ConfirmGate) -> None:
        self._confirm_gate = confirm_gate
        self._sessions = SessionStore()

    @abstractmethod
    async def _send(self, callback_info: Any, text: str) -> None:
        """Send a message back to the user. Subclasses implement transport."""

    async def _send_and_record(self, session: Session, callback_info: Any, text: str) -> None:
        try:
            await self._send(callback_info, text)
        except Exception:
            logger.exception("Failed to send message via %s", self.channel_name)
        session.add_assistant_turn(text)

    async def _handle_text(
        self,
        user_text: str,
        source_key: str,
        callback_info: dict,
    ) -> None:
        """Session-aware confirm/cancel/new-request flow."""
        if not user_text:
            return

        session = self._sessions.get_or_create(source_key)
        text_lower = user_text.lower()

        # State: AWAITING_FOLLOWUP
        if session.state == SessionState.AWAITING_FOLLOWUP:
            if text_lower in DONE_KEYWORDS:
                await self._send_and_record(session, callback_info, "Session ended.")
                self._sessions.clear(source_key)
                return
            session.state = SessionState.IDLE

        # State: PENDING_CONFIRM
        if session.state == SessionState.PENDING_CONFIRM:
            pending_id = session.pending_request_id

            if pending_id and text_lower in CONFIRM_KEYWORDS:
                session.add_user_turn(user_text)
                await self._do_confirm(session, pending_id, callback_info)
                return

            if pending_id and text_lower in CANCEL_KEYWORDS:
                session.add_user_turn(user_text)
                self._confirm_gate._pending.pop(pending_id, None)
                session.pending_request_id = None
                session.state = SessionState.IDLE
                await self._send_and_record(session, callback_info, "Cancelled.")
                return

            if pending_id:
                self._confirm_gate._pending.pop(pending_id, None)
                session.pending_request_id = None
            session.state = SessionState.IDLE

        # State: IDLE → new request
        session.add_user_turn(user_text)

        context = session.to_context_string(max_turns=10)
        if len(session.turns) > 1 and context:
            refined_message = (
                f"[Previous context]\n{context}\n\n"
                f"[Current request]\n{user_text}"
            )
        else:
            refined_message = user_text

        request_id = uuid.uuid4().hex[:8]
        self._confirm_gate.create_request(
            request_id=request_id,
            message=refined_message,
            channel=self.channel_name,
            callback_info=callback_info,
            raw_message=user_text,
        )
        session.pending_request_id = request_id
        session.state = SessionState.PENDING_CONFIRM

        confirm_msg = (
            f"[{request_id}] I understood your request as:\n"
            f"> {user_text}\n\n"
            f'Reply "yes" to proceed, "cancel" to abort.'
        )
        await self._send_and_record(session, callback_info, confirm_msg)

    async def _do_confirm(
        self,
        session: Session,
        request_id: str,
        callback_info: dict,
    ) -> None:
        req = self._confirm_gate.get_pending(request_id)
        if req is None:
            await self._send_and_record(session, callback_info, "Request already processed.")
            session.state = SessionState.IDLE
            session.pending_request_id = None
            return

        raw_message = req.raw_message

        session.state = SessionState.EXECUTING
        session.pending_request_id = None
        await self._send_and_record(
            session, callback_info, f"`{request_id}` Starting work..."
        )

        try:
            result = await self._confirm_gate.confirm(request_id)

            if result.get("status") == "clarification_needed":
                msg = result.get("message", "Need more information.")
                session.state = SessionState.IDLE
                await self._send_and_record(session, callback_info, f"`{request_id}` {msg}")
                return

            if result.get("status") == "direct_answer":
                from orchestrator.server import to_slack_mrkdwn
                msg = to_slack_mrkdwn(result.get("message", ""))
                formatted = (
                    f"*Request*\n{raw_message}\n\n"
                    f"---\n\n"
                    f"*Response*\n{msg}"
                )
                await self._send_and_record(session, callback_info, formatted)
                session.state = SessionState.AWAITING_FOLLOWUP
                await self._send_and_record(
                    session, callback_info,
                    "Anything else? (reply 'done' to end session)"
                )
                return

            from orchestrator.server import format_results
            task_id = result.get("task_id", request_id)
            project = result.get("project", "unknown")

            formatted = format_results(
                raw_message,
                {project: result},
                self.channel_name,
                task_id=task_id,
            )
            await self._send_and_record(session, callback_info, formatted)

            session.state = SessionState.AWAITING_FOLLOWUP
            await self._send_and_record(
                session, callback_info,
                "Anything else? (reply 'done' to end session)"
            )

        except Exception as exc:
            logger.exception("handle_request failed for %s", request_id)
            tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
            error_summary = f"{type(exc).__name__}: {exc}"
            error_detail = "".join(tb[-3:])

            session.add_assistant_turn(f"[Failed: {error_summary}]")
            session.state = SessionState.AWAITING_FOLLOWUP

            await self._send_and_record(
                session, callback_info,
                f"*Failed* `{request_id}`\n"
                f"```{error_summary}\n{error_detail}```\n"
                f"Try again or request something else."
            )

    @abstractmethod
    async def start(self) -> None: ...

    @abstractmethod
    async def stop(self) -> None: ...
