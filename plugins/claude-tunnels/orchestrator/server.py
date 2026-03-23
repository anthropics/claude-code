"""Entry point: channel routing, confirm gate, and full orchestration flow."""

from __future__ import annotations

import asyncio
import logging
import random
import string
import traceback
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from orchestrator.router import route_request
from orchestrator.po import get_execution_plan
from orchestrator.executor import execute_phases
from orchestrator.task_log import write_task_log
from orchestrator.direct_handler import handle_direct_request

logger = logging.getLogger(__name__)


class ChannelSender(Protocol):
    async def send(self, *args: Any, **kwargs: Any) -> None: ...


_channels: dict[str, Any] = {}


def register_channel(name: str, adapter: Any) -> None:
    _channels[name] = adapter


def get_channel(name: str) -> Any | None:
    return _channels.get(name)


@dataclass
class PendingRequest:
    request_id: str
    message: str
    raw_message: str
    channel: str
    callback_info: dict


class ConfirmGate:
    def __init__(self):
        self._pending: dict[str, PendingRequest] = {}

    def create_request(self, request_id: str, message: str, channel: str,
                       callback_info: dict, raw_message: str = "") -> PendingRequest:
        req = PendingRequest(
            request_id=request_id, message=message,
            raw_message=raw_message or message, channel=channel,
            callback_info=callback_info,
        )
        self._pending[request_id] = req
        return req

    def get_pending(self, request_id: str) -> PendingRequest | None:
        return self._pending.get(request_id)

    async def confirm(self, request_id: str) -> dict:
        req = self._pending.pop(request_id, None)
        if req is None:
            raise KeyError(f"No pending request: {request_id}")
        return await handle_request(
            user_message=req.message, raw_message=req.raw_message,
            channel=req.channel, callback_info=req.callback_info,
            send_results=False, request_id=request_id,
        )

    @property
    def pending_requests(self) -> dict[str, PendingRequest]:
        return dict(self._pending)


def to_slack_mrkdwn(text: str) -> str:
    import re
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    text = re.sub(r"^#{1,6}\s+(.+)$", r"*\1*", text, flags=re.MULTILINE)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"<\2|\1>", text)
    return text


def format_results(original_request: str, project_results: dict[str, dict],
                   channel: str, task_id: str = "") -> str:
    clean_request = original_request
    if "[Current request]" in clean_request:
        clean_request = clean_request.split("[Current request]", 1)[1].strip()
    elif "[Previous context]" in clean_request:
        clean_request = clean_request.split("[Previous context]", 1)[0].strip() or clean_request

    sections: list[str] = []
    sections.append(f"*Request*\n{clean_request}")
    result_lines: list[str] = []

    for project, data in project_results.items():
        if "error" in data and "results" not in data:
            result_lines.append(f"[{project}] FAILED: {data['error']}")
            continue
        phases = data.get("phases", [])
        results = data.get("results", {})
        if len(project_results) > 1:
            result_lines.append(f"*{project}*")
        if not phases and not results:
            result_lines.append(f"[{project}] No phases to execute.")
            continue
        for i, phase_workspaces in enumerate(phases, 1):
            ws_names = ", ".join(phase_workspaces)
            result_lines.append(f"Phase {i}: {ws_names}")
            for ws in phase_workspaces:
                result = results.get(ws, {})
                error = result.get("error")
                test_result = "fail" if error else result.get("test_result", "skip")
                summary = result.get("summary") or "No result"
                changed = result.get("changed_files", [])
                result_lines.append(f"[{test_result}] *{ws}*")
                result_lines.append(summary)
                if changed:
                    changed_str = ", ".join(f"`{f}`" for f in changed)
                    result_lines.append(f"Changed: {changed_str}")
                if error:
                    result_lines.append(f"```{str(error)[:200]}```")

    sections.append(f"*Results*\n" + "\n".join(result_lines))
    result_text = "\n\n---\n\n".join(sections)
    return to_slack_mrkdwn(result_text)


async def send_to_channel(channel: str, message: str, callback_info: dict) -> None:
    if channel == "cli":
        print(message)
        return
    adapter = get_channel(channel)
    if adapter is None:
        logger.warning("No adapter registered for channel '%s'", channel)
        return
    try:
        if channel == "slack":
            channel_id = callback_info.get("channel_id", "")
            thread_ts = callback_info.get("thread_ts")
            await adapter.send(channel_id, message, thread_ts)
        else:
            await adapter.send(callback_info, message)
    except Exception:
        logger.exception("Failed to send message via %s", channel)


async def _run_single_project(plan: dict, user_message: str, channel: str,
                              callback_info: dict, started_at: datetime,
                              request_id: str | None = None) -> dict:
    project = plan["project"]
    task_id = request_id or plan["task_id"]
    task_label = plan["task_label"]
    phases = plan["phases"]
    tasks = plan["task_per_workspace"]

    logger.info("[%s] Executing phases for '%s': %s", task_id, project, phases)
    results = await execute_phases(project, phases, tasks)
    logger.info("[%s] Execution complete. Results: %s", task_id, list(results.keys()))

    log_path = await write_task_log(
        task_id=task_id, task_label=task_label, project=project,
        channel=channel, original_request=user_message, phases=phases,
        results=results, started_at=started_at,
    )
    logger.info("[%s] Task log written to %s", task_id, log_path)
    return {"task_id": task_id, "project": project, "phases": phases, "results": results}


def _generate_task_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=4))


async def _write_failure_log(user_message: str, channel: str, error: Exception,
                             started_at: datetime, project: str = "unknown") -> Path | None:
    try:
        task_id = _generate_task_id()
        tb = traceback.format_exception(type(error), error, error.__traceback__)
        error_summary = f"{type(error).__name__}: {error}"
        log_path = await write_task_log(
            task_id=task_id, task_label="failed-request", project=project,
            channel=channel, original_request=user_message, phases=[],
            results={"_error": {"changed_files": [], "summary": error_summary,
                                "test_result": "fail", "error": "".join(tb)}},
            started_at=started_at,
        )
        return log_path
    except Exception:
        logger.exception("Failed to write failure task log")
        return None


async def _plan_and_run_project(project: str, refined_message: str, original_message: str,
                                channel: str, callback_info: dict, started_at: datetime,
                                request_id: str | None = None) -> dict:
    plan = await get_execution_plan(refined_message, project=project)
    if plan.get("clarification_needed"):
        return {"status": "clarification_needed", "message": plan["clarification_needed"]}
    if plan.get("direct_answer"):
        return {"status": "direct_answer", "message": plan["direct_answer"]}
    if "project" not in plan:
        plan = {**plan, "project": project}
    required_keys = {"phases", "task_per_workspace"}
    missing = required_keys - plan.keys()
    if missing:
        return {"status": "clarification_needed",
                "message": "Failed to generate execution plan. Please be more specific."}
    return await _run_single_project(plan, original_message, channel, callback_info, started_at, request_id)


async def handle_request(user_message: str, channel: str, callback_info: dict,
                         send_results: bool = True, request_id: str | None = None,
                         raw_message: str = "") -> dict:
    started_at = datetime.now()
    log_message = raw_message or user_message
    try:
        return await _handle_request_inner(
            user_message, log_message, channel, callback_info,
            started_at, send_results, request_id,
        )
    except Exception as exc:
        logger.exception("handle_request failed for message: %s", user_message[:200])
        await _write_failure_log(log_message, channel, exc, started_at)
        raise


async def _handle_request_inner(user_message: str, log_message: str, channel: str,
                                callback_info: dict, started_at: datetime,
                                send_results: bool = True, request_id: str | None = None) -> dict:
    route = await route_request(user_message)
    if route.clarification_needed:
        if send_results:
            await send_to_channel(channel, route.clarification_needed, callback_info)
        return {"status": "clarification_needed", "message": route.clarification_needed}

    refined = route.refined_message

    if len(route.projects) > 1:
        coros = [
            _plan_and_run_project(proj, refined, log_message, channel, callback_info, started_at, request_id)
            for proj in route.projects
        ]
        project_results_list = await asyncio.gather(*coros, return_exceptions=True)
        combined: dict[str, dict] = {}
        for proj, result in zip(route.projects, project_results_list):
            if isinstance(result, BaseException):
                combined[proj] = {"error": str(result)}
            else:
                combined[proj] = result
        if send_results:
            await send_to_channel(channel, format_results(log_message, combined, channel), callback_info)
        return combined

    if len(route.projects) == 1:
        result = await _plan_and_run_project(
            route.projects[0], refined, log_message, channel, callback_info, started_at, request_id)
        if result.get("status") in ("clarification_needed", "direct_answer"):
            if send_results:
                await send_to_channel(channel, result["message"], callback_info)
            return result
        if send_results:
            await send_to_channel(channel, format_results(log_message, {route.projects[0]: result}, channel), callback_info)
        return result

    answer = await handle_direct_request(refined)
    if send_results:
        await send_to_channel(channel, answer, callback_info)
    return {"status": "direct_answer", "message": answer}
