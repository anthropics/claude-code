"""Lightweight HTTP API for external channel gateways."""

from __future__ import annotations
import logging, uuid
from aiohttp import web
from orchestrator.server import ConfirmGate

logger = logging.getLogger(__name__)

def create_app(confirm_gate: ConfirmGate) -> web.Application:
    app = web.Application()
    app["confirm_gate"] = confirm_gate
    app.router.add_post("/request", _handle_incoming)
    app.router.add_post("/confirm/{request_id}", _handle_confirm)
    app.router.add_get("/pending", _handle_pending)
    app.router.add_get("/health", _handle_health)
    return app

async def _handle_incoming(request: web.Request) -> web.Response:
    gate: ConfirmGate = request.app["confirm_gate"]
    try: body = await request.json()
    except: return web.json_response({"error": "invalid JSON"}, status=400)
    message = body.get("message", "").strip()
    if not message: return web.json_response({"error": "message required"}, status=400)
    request_id = uuid.uuid4().hex[:8]
    gate.create_request(request_id=request_id, message=message,
                        channel=body.get("channel", "api"), callback_info=body.get("callback_info", {}))
    return web.json_response({"request_id": request_id, "status": "pending_confirm"})

async def _handle_confirm(request: web.Request) -> web.Response:
    gate: ConfirmGate = request.app["confirm_gate"]
    request_id = request.match_info["request_id"]
    if not gate.get_pending(request_id):
        return web.json_response({"error": f"No pending: {request_id}"}, status=404)
    try:
        result = await gate.confirm(request_id)
        return web.json_response({"status": "completed", "result": result})
    except Exception as e:
        return web.json_response({"error": str(e), "status": "failed"}, status=500)

async def _handle_pending(request: web.Request) -> web.Response:
    gate: ConfirmGate = request.app["confirm_gate"]
    return web.json_response({rid: {"message": r.message, "channel": r.channel} for rid, r in gate.pending_requests.items()})

async def _handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})
