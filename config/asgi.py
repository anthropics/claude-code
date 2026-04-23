"""ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

HTTP は Django の get_asgi_application、WebSocket は Channels の URLRouter に振り分ける。
Phase 3 (DM) で websocket_urlpatterns を apps.dm.routing 等から import して拡張する。
"""

from __future__ import annotations

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Django の設定読み込みを Channels のインポートより先に行う
django_asgi_app = get_asgi_application()

# channels は Phase 0 で追加導入済み (P0-01)
from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.urls import path  # noqa: E402


async def health_consumer(scope, receive, send):
    """WebSocket ヘルスチェック用 minimal consumer. Phase 0.5 の smoke test で利用。"""
    if scope["type"] == "websocket":
        await receive()  # websocket.connect
        await send({"type": "websocket.accept"})
        await send({"type": "websocket.close", "code": 1000})


websocket_urlpatterns = [
    path("ws/health/", health_consumer),
    # Phase 3 以降で各 app の routing を include する:
    # *dm_routing.websocket_urlpatterns,
    # *notifications_routing.websocket_urlpatterns,
]


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(
                URLRouter(websocket_urlpatterns),
            ),
        ),
    },
)
