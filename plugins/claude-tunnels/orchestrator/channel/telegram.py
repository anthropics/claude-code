"""Telegram channel adapter: long-polling receive + Bot API send.

Inherits BaseChannel for shared session management, confirm/cancel flow,
and message splitting. Only implements Telegram-specific transport.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, TYPE_CHECKING

import aiohttp

from orchestrator import ARCHIVE_PATH
from orchestrator.channel.base import BaseChannel, load_credential_file, split_message

if TYPE_CHECKING:
    from orchestrator.server import ConfirmGate

logger = logging.getLogger(__name__)

CREDENTIAL_PATH = ARCHIVE_PATH / "telegram" / "credentials"

POLL_TIMEOUT = 30
POLL_ERROR_BACKOFF = 5
HTTP_TOTAL_TIMEOUT = POLL_TIMEOUT + 30


def load_credentials(path: Path | None = None) -> dict[str, str]:
    p = path or CREDENTIAL_PATH
    return load_credential_file(p)


class TelegramChannel(BaseChannel):
    """Telegram channel: receives messages via long polling, sends via Bot API.

    Shares BaseChannel's session state machine, confirm/cancel flow, and
    message splitting. Only the transport layer (HTTP to Telegram Bot API)
    is Telegram-specific.
    """

    channel_name = "telegram"

    def __init__(self, confirm_gate: ConfirmGate) -> None:
        super().__init__(confirm_gate)
        creds = load_credentials()
        self._bot_token = creds["bot_token"]
        self._api_base = f"https://api.telegram.org/bot{self._bot_token}"
        self._allowed_users: set[str] = set()
        allowed = creds.get("allowed_users", "")
        if allowed:
            self._allowed_users = {u.strip() for u in allowed.split(",") if u.strip()}
        self._offset: int = 0
        self._running = False
        self._poll_task: asyncio.Task | None = None
        self._session: aiohttp.ClientSession | None = None

    # ── Transport: send ──────────────────────────────────────────────

    async def _send(self, callback_info: Any, text: str) -> None:
        """BaseChannel calls this to deliver messages. We split + send via Bot API."""
        chat_id = callback_info["chat_id"]
        chunks = split_message(text, max_len=4096)
        for chunk in chunks:
            await self._send_message(chat_id, chunk)

    async def _send_message(self, chat_id: int | str, text: str) -> None:
        session = await self._ensure_session()
        try:
            async with session.post(
                f"{self._api_base}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            ) as resp:
                if resp.status == 200:
                    return
                body = await resp.text()
                logger.warning("Telegram sendMessage Markdown failed (%d): %s", resp.status, body[:300])
        except Exception:
            logger.exception("Telegram sendMessage Markdown exception")

        # Fallback: retry without parse_mode (Markdown can fail on special chars)
        try:
            async with session.post(
                f"{self._api_base}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.error("Telegram sendMessage plain also failed (%d): %s", resp.status, body[:300])
        except Exception:
            logger.exception("Telegram sendMessage plain exception")

    # ── Transport: receive (long polling) ────────────────────────────

    async def _poll_updates(self) -> None:
        """Long-poll Telegram getUpdates API with persistent session."""
        session = await self._ensure_session()
        while self._running:
            try:
                async with session.get(
                    f"{self._api_base}/getUpdates",
                    params={
                        "offset": self._offset,
                        "timeout": POLL_TIMEOUT,
                        "allowed_updates": '["message"]',
                    },
                    timeout=aiohttp.ClientTimeout(total=HTTP_TOTAL_TIMEOUT),
                ) as resp:
                    if resp.status != 200:
                        logger.error("Telegram getUpdates failed: %d", resp.status)
                        await asyncio.sleep(POLL_ERROR_BACKOFF)
                        continue
                    data = await resp.json()

                if not data.get("ok"):
                    logger.error("Telegram API error: %s", data)
                    await asyncio.sleep(POLL_ERROR_BACKOFF)
                    continue

                for update in data.get("result", []):
                    self._offset = update["update_id"] + 1
                    await self._handle_update(update)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Telegram polling error")
                await asyncio.sleep(POLL_ERROR_BACKOFF)

    async def _handle_update(self, update: dict) -> None:
        message = update.get("message")
        if not message:
            return

        text = message.get("text", "").strip()
        if not text:
            return

        chat = message.get("chat", {})
        chat_id = chat.get("id")
        user = message.get("from", {})
        username = user.get("username", "")
        user_id = str(user.get("id", ""))

        if self._allowed_users:
            if username not in self._allowed_users and user_id not in self._allowed_users:
                logger.warning("Telegram: unauthorized user %s (%s)", username, user_id)
                return

        source_key = str(chat_id)
        callback_info = {
            "chat_id": chat_id,
            "user_id": user_id,
            "username": username,
        }

        logger.info("Telegram from %s (chat %s): %s", username or user_id, chat_id, text[:100])
        await self._handle_text(text, source_key, callback_info)

    # ── Lifecycle ────────────────────────────────────────────────────

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def start(self) -> None:
        self._running = True
        session = await self._ensure_session()

        # Verify bot token with getMe
        try:
            async with session.get(f"{self._api_base}/getMe") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    bot_name = data.get("result", {}).get("username", "unknown")
                    logger.info("Telegram channel starting (bot: @%s)...", bot_name)
                else:
                    body = await resp.text()
                    logger.error("Telegram bot token invalid! Status %d: %s", resp.status, body[:200])
                    return
        except Exception:
            logger.exception("Telegram getMe failed — check network/token")
            return

        self._poll_task = asyncio.create_task(self._poll_updates())

    async def stop(self) -> None:
        self._running = False
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
        logger.info("Telegram channel stopped.")
