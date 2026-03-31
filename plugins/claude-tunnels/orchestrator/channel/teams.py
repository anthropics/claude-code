"""Microsoft Teams channel adapter: Bot Framework webhook receive + async reply.

Uses botbuilder-integration-aiohttp to handle incoming Activities from Azure Bot
Service. Inherits BaseChannel for shared session management, confirm/cancel flow,
and message splitting.
"""

from __future__ import annotations

import asyncio
import logging
import sys
import traceback
from pathlib import Path
from typing import Any, TYPE_CHECKING

from aiohttp import web
from botbuilder.core import TurnContext, MessageFactory
from botbuilder.core.integration import aiohttp_error_middleware
from botbuilder.core.teams import TeamsActivityHandler
from botbuilder.integration.aiohttp import CloudAdapter, ConfigurationBotFrameworkAuthentication
from botbuilder.schema import Activity

from orchestrator import ARCHIVE_PATH
from orchestrator.channel.base import BaseChannel, load_credential_file, split_message

if TYPE_CHECKING:
    from orchestrator.server import ConfirmGate

logger = logging.getLogger(__name__)

CREDENTIAL_PATH = ARCHIVE_PATH / "teams" / "credentials"
DEFAULT_PORT = 3978


def load_credentials(path: Path | None = None) -> dict[str, str]:
    p = path or CREDENTIAL_PATH
    return load_credential_file(p)


class _BotFrameworkConfig:
    """Config object that ConfigurationBotFrameworkAuthentication reads from."""

    def __init__(self, app_id: str, app_password: str, app_type: str = "MultiTenant", tenant_id: str = ""):
        self.APP_ID = app_id
        self.APP_PASSWORD = app_password
        self.APP_TYPE = app_type
        self.APP_TENANTID = tenant_id


class TeamsChannel(BaseChannel):
    """Teams channel: receives messages via Bot Framework webhook, sends via Bot Connector.

    Shares BaseChannel's session state machine, confirm/cancel flow, and
    message splitting. Only the transport layer (Bot Framework SDK) is
    Teams-specific.
    """

    channel_name = "teams"

    def __init__(self, confirm_gate: ConfirmGate, port: int = DEFAULT_PORT) -> None:
        super().__init__(confirm_gate)
        creds = load_credentials()
        self._app_id = creds["app_id"]
        self._port = port

        config = _BotFrameworkConfig(
            app_id=creds["app_id"],
            app_password=creds["app_password"],
            app_type=creds.get("app_type", "MultiTenant"),
            tenant_id=creds.get("app_tenant_id", ""),
        )
        self._adapter = CloudAdapter(ConfigurationBotFrameworkAuthentication(config))
        self._adapter.on_turn_error = self._on_turn_error

        allowed = creds.get("allowed_users", "")
        self._allowed_users: set[str] = set()
        if allowed:
            self._allowed_users = {u.strip() for u in allowed.split(",") if u.strip()}

        # Store conversation references for async replies, keyed by conversation ID
        self._conv_refs: dict[str, Any] = {}

        self._runner: web.AppRunner | None = None
        self._bot = _TeamsBot(self)

    # -- Transport: send -------------------------------------------------------

    async def _send(self, callback_info: Any, text: str) -> None:
        """BaseChannel calls this to deliver messages. We split + send via Bot Connector."""
        conv_id = callback_info.get("conversation_id", "")
        conv_ref = self._conv_refs.get(conv_id)
        if not conv_ref:
            logger.error("No conversation reference for %s, cannot send reply", conv_id)
            return

        chunks = split_message(text, max_len=4096)
        for chunk in chunks:
            await self._adapter.continue_conversation(
                conv_ref,
                lambda turn_ctx, c=chunk: turn_ctx.send_activity(MessageFactory.text(c)),
                self._app_id,
            )

    # -- Incoming message handling ---------------------------------------------

    async def _on_teams_message(self, turn_context: TurnContext) -> None:
        """Called by the inner _TeamsBot when an @mention message arrives."""
        activity = turn_context.activity

        # Strip @mention
        TurnContext.remove_recipient_mention(activity)
        text = (activity.text or "").strip()
        if not text:
            return

        user_id = activity.from_property.id if activity.from_property else ""
        user_name = activity.from_property.name if activity.from_property else ""

        if self._allowed_users:
            if user_id not in self._allowed_users and user_name not in self._allowed_users:
                logger.warning("Teams: unauthorized user %s (%s)", user_name, user_id)
                return

        # Save conversation reference for async replies
        conv_ref = TurnContext.get_conversation_reference(activity)
        conv_id = activity.conversation.id if activity.conversation else ""
        self._conv_refs[conv_id] = conv_ref

        callback_info = {
            "conversation_id": conv_id,
            "user_id": user_id,
            "user_name": user_name,
        }

        logger.info("Teams from %s (conv %s): %s", user_name or user_id, conv_id[:20], text[:100])
        await self._handle_text(text, conv_id, callback_info)

    # -- Error handler ---------------------------------------------------------

    async def _on_turn_error(self, turn_context: TurnContext, error: Exception) -> None:
        logger.error("Teams bot turn error: %s", error)
        traceback.print_exc(file=sys.stderr)
        try:
            await turn_context.send_activity("An error occurred processing your request.")
        except Exception:
            logger.exception("Failed to send error message to Teams")

    # -- Lifecycle -------------------------------------------------------------

    async def start(self) -> None:
        app = web.Application(middlewares=[aiohttp_error_middleware])
        app.router.add_post("/api/messages", self._handle_webhook)
        app.router.add_get("/health", self._handle_health)

        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, "0.0.0.0", self._port)
        await site.start()
        logger.info("Teams channel started on port %d", self._port)

    async def stop(self) -> None:
        if self._runner:
            await self._runner.cleanup()
            self._runner = None
        logger.info("Teams channel stopped.")

    # -- Webhook endpoint ------------------------------------------------------

    async def _handle_webhook(self, request: web.Request) -> web.Response:
        return await self._adapter.process(request, self._bot)

    async def _handle_health(self, request: web.Request) -> web.Response:
        return web.json_response({"status": "ok", "channel": "teams", "port": self._port})


class _TeamsBot(TeamsActivityHandler):
    """Inner bot class that delegates to TeamsChannel for message handling."""

    def __init__(self, channel: TeamsChannel) -> None:
        super().__init__()
        self._channel = channel

    async def on_message_activity(self, turn_context: TurnContext) -> None:
        await self._channel._on_teams_message(turn_context)
