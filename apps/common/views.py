"""Views shared across apps.

Hosts:
- `/api/health/` — ALB/CloudFront 用の軽量ヘルスチェック (P0.5-11)
- `/api/v1/auth/csrf/` — SPA 用 csrftoken cookie bootstrap (P1-13a)
- `/debug-sentry/` — Sentry 配線確認 (P0-06、DEBUG=True のみ)
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

from django.conf import settings
from django.db import connections
from django.db.utils import DatabaseError
from django.http import Http404, HttpRequest, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET


@require_GET
@never_cache
def health(_request: HttpRequest) -> JsonResponse:
    """Liveness + light readiness probe for ALB target group and CD smoke tests.

    Responds 200 when Django is up and RDS is reachable; 503 when the DB is
    unreachable (ECS task should be cycled). Deliberately cheap — no auth,
    no DB write, no session. Health-check traffic (30s interval × 3 タスク)
    must not generate load or contend with real traffic.

    レスポンス例:
        {
          "status": "ok",
          "version": "7ca1708",
          "time": "2026-04-23T12:34:56.789012+00:00",
          "db": "ok"
        }

    注: `environment` を含めないのは偵察耐性のため (python-reviewer PR #55 MEDIUM)。
    運用者が環境を知りたい場合は CloudWatch Logs か Sentry を参照する。
    """
    db_state = "ok"
    try:
        # cursor をコンテキストマネージャで閉じて connection leak を防ぐ
        # (python-reviewer PR #55 HIGH)。DatabaseError を親クラスで catch して
        # OperationalError / InterfaceError / ProgrammingError を全て拾う。
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        db_state = "unreachable"

    status_code = 200 if db_state == "ok" else 503

    payload = {
        "status": "ok" if status_code == 200 else "degraded",
        "version": os.environ.get("SENTRY_RELEASE", "unknown"),
        "time": datetime.now(UTC).isoformat(),
        "db": db_state,
    }
    return JsonResponse(payload, status=status_code)


@require_GET
@never_cache
@ensure_csrf_cookie
def csrf_token(_request: HttpRequest) -> JsonResponse:
    """CSRF cookie bootstrap endpoint for the SPA (P1-13a).

    SPA は最初の state-changing POST (``/auth/cookie/create/`` 等) を送る前に
    このエンドポイントを GET して ``csrftoken`` cookie を取得する必要がある。
    Django の ``CsrfViewMiddleware`` は ``get_token()`` が呼ばれた view でしか
    cookie を set しないため、``@ensure_csrf_cookie`` で明示的に cookie を発行
    する。認証不要・副作用なし・軽量。
    """
    return JsonResponse({"detail": "CSRF cookie set"})


def debug_sentry(_request: HttpRequest) -> JsonResponse:
    """Intentionally raise to verify Sentry capture works.

    Only exposed when DEBUG is True; this view never runs in stg/prod
    where DEBUG is disabled. Returns without executing if someone wires
    it up in production by mistake.
    """
    if not settings.DEBUG:
        raise Http404("debug endpoint is only available when DEBUG=True")
    # The explicit ZeroDivisionError gives Sentry a unique fingerprint
    # that is easy to find in the dashboard.
    _ = 1 / 0
    return JsonResponse({"unreachable": True})  # pragma: no cover
