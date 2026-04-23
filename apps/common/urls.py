"""URL patterns for common utility views.

`/api/health/` は config/urls.py 側でトップレベル登録しているため、本モジュールでは
扱わない (python-reviewer PR #55 MEDIUM: 重複登録の混乱を回避)。
`/debug-sentry/` は DEBUG=True の時だけ config/urls.py 経由で配信する。
"""

from __future__ import annotations

from django.urls import URLPattern, URLResolver, path

from apps.common.views import debug_sentry

urlpatterns: list[URLPattern | URLResolver] = [
    path("", debug_sentry, name="debug-sentry"),
]
