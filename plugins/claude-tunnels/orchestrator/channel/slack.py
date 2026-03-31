"""Slack channel adapter: Socket Mode receive + Web API send."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TYPE_CHECKING

from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from slack_bolt.async_app import AsyncApp
from slack_sdk.web.async_client import AsyncWebClient

from orchestrator import ARCHIVE_PATH
from orchestrator.channel.base import BaseChannel, load_credential_file

if TYPE_CHECKING:
    from orchestrator.server import ConfirmGate

logger = logging.getLogger(__name__)

CREDENTIAL_PATH = ARCHIVE_PATH / "slack" / "credentials"

# Slack user IDs allowed to interact with the bot. Empty set = allow all.
ALLOWED_USERS: set[str] = set()


@dataclass(frozen=True)
class SlackCredentials:
    app_id: str
    client_id: str
    client_secret: str
    signing_secret: str
    app_level_token: str
    bot_token: str = ""


def load_credentials(path: Path | None = None) -> SlackCredentials:
    p = path or CREDENTIAL_PATH
    data = load_credential_file(p)
    return SlackCredentials(
        app_id=data["app_id"],
        client_id=data["client_id"],
        client_secret=data["client_secret"],
        signing_secret=data["signing_secret"],
        app_level_token=data["app_level_token"],
        bot_token=data.get("bot_token", ""),
    )


class SlackChannel(BaseChannel):
    channel_name = "slack"

    def __init__(self, confirm_gate: ConfirmGate) -> None:
        super().__init__(confirm_gate)
        creds = load_credentials()
        self._creds = creds
        self._web = AsyncWebClient(token=creds.bot_token)
        self._app = AsyncApp(
            token=creds.bot_token,
            signing_secret=creds.signing_secret,
        )
        self._handler: AsyncSocketModeHandler | None = None
        self._bot_user_id: str | None = None
        self._register_events()

    def _register_events(self) -> None:
        @self._app.event("message")
        async def _on_message(event: dict, say: Any) -> None:
            await self._handle_incoming(event)

        @self._app.event("app_mention")
        async def _on_mention(event: dict, say: Any) -> None:
            await self._handle_incoming(event)

    async def _get_bot_user_id(self) -> str:
        if self._bot_user_id is None:
            auth = await self._web.auth_test()
            self._bot_user_id = auth["user_id"]
        return self._bot_user_id

    async def _handle_incoming(self, event: dict) -> None:
        user = event.get("user", "")
        channel_id = event.get("channel", "")
        text = event.get("text", "")

        if not text or not user:
            return

        bot_id = await self._get_bot_user_id()
        if user == bot_id:
            return

        if ALLOWED_USERS and user not in ALLOWED_USERS:
            logger.warning("Slack message from unauthorized user %s, ignoring", user)
            return

        text_clean = re.sub(r"<@[A-Z0-9]+>\s*", "", text).strip()
        if not text_clean:
            return

        callback_info = {
            "channel_id": channel_id,
            "user_id": user,
            "thread_ts": event.get("ts"),
        }
        await self._handle_text(text_clean, channel_id, callback_info)

    async def _send(self, callback_info: Any, text: str) -> None:
        channel_id = callback_info["channel_id"]
        thread_ts = callback_info.get("thread_ts")
        await self.send(channel_id, text, thread_ts)

    async def send(self, channel_id: str, text: str, thread_ts: str | None = None) -> None:
        kwargs: dict[str, Any] = {"channel": channel_id, "text": text}
        if thread_ts:
            kwargs["thread_ts"] = thread_ts
        await self._web.chat_postMessage(**kwargs)

    async def start(self) -> None:
        self._handler = AsyncSocketModeHandler(
            app=self._app,
            app_token=self._creds.app_level_token,
        )
        logger.info("Slack channel starting (Socket Mode)...")
        await self._handler.start_async()

    async def stop(self) -> None:
        if self._handler:
            await self._handler.close_async()
            logger.info("Slack channel stopped.")
