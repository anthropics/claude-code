"""Main entry point: starts configured channel adapters."""

import asyncio
import logging
import os
import signal

for _key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
    os.environ.pop(_key, None)

from orchestrator import CONFIG
from orchestrator.server import ConfirmGate, register_channel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def main() -> None:
    confirm_gate = ConfirmGate()
    channels_config = CONFIG.get("channels", {})
    tasks = []

    if channels_config.get("slack", {}).get("enabled"):
        from orchestrator.channel.slack import SlackChannel
        slack_ch = SlackChannel(confirm_gate)
        register_channel("slack", slack_ch)
        tasks.append(asyncio.create_task(slack_ch.start()))
        logger.info("  Slack: Socket Mode")

    if channels_config.get("telegram", {}).get("enabled"):
        from orchestrator.channel.telegram import TelegramChannel
        tg_ch = TelegramChannel(confirm_gate)
        register_channel("telegram", tg_ch)
        tasks.append(asyncio.create_task(tg_ch.start()))
        logger.info("  Telegram: Long Polling")

    if channels_config.get("teams", {}).get("enabled"):
        from orchestrator.channel.teams import TeamsChannel
        teams_port = channels_config.get("teams", {}).get("port", 3978)
        teams_ch = TeamsChannel(confirm_gate, port=teams_port)
        register_channel("teams", teams_ch)
        tasks.append(asyncio.create_task(teams_ch.start()))
        logger.info("  Teams: Bot Framework webhook on port %d", teams_port)

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    logger.info("Orchestrator started.")
    await stop_event.wait()
    logger.info("Shutting down...")

    for name, adapter in list(_channels_items()):
        try: await adapter.stop()
        except: pass
    for t in tasks:
        t.cancel()
    logger.info("Orchestrator stopped.")

def _channels_items():
    from orchestrator.server import _channels
    return _channels.items()

if __name__ == "__main__":
    asyncio.run(main())
