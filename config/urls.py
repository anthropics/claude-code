from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

from apps.common.views import health as health_view

schema_view = get_schema_view(
    openapi.Info(
        title="Alpha Apartments API",
        default_version="v1",
        description="An Apartment Management API for Real Estate",
        contact=openapi.Contact(email="api.imperfect@gmail.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    # ALB target group の health check が叩くエンドポイント (P0.5-11)。
    # /api/v1/ より短い /api/health/ に置き、ALB listener rule の /api/* が
    # app target group に流した時にそのまま 200 を返す。
    path("api/health/", health_view, name="api-health"),
    path(
        "redoc/",
        schema_view.with_ui("redoc", cache_timeout=0),
        name="schema-redoc",
    ),
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/auth/", include("djoser.urls")),
    path("api/v1/auth/", include("apps.users.urls")),
    # P1-03 #89: プロフィール API (SPEC §2)。
    # /api/v1/users/me/ (GET/PATCH) と /api/v1/users/<handle>/ (GET) を提供。
    # 認証系 (/api/v1/auth/) と分離するため apps.users.urls_profile として別登録。
    path("api/v1/users/", include("apps.users.urls_profile")),
    # Phase 0 scaffold (P0-04). Each app ships empty urlpatterns until
    # the owning phase adds real endpoints (see docs/ROADMAP.md).
    path("api/v1/tweets/", include("apps.tweets.urls")),
    path("api/v1/tags/", include("apps.tags.urls")),
    path("api/v1/follows/", include("apps.follows.urls")),
    path("api/v1/reactions/", include("apps.reactions.urls")),
    path("api/v1/boxes/", include("apps.boxes.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/dm/", include("apps.dm.urls")),
    path("api/v1/boards/", include("apps.boards.urls")),
    path("api/v1/articles/", include("apps.articles.urls")),
    path("api/v1/moderation/", include("apps.moderation.urls")),
    path("api/v1/bots/", include("apps.bots.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/search/", include("apps.search.urls")),
]

# Sentry smoke test endpoint (P0-06). DEBUG=True の環境だけ URL 登録すること自体を
# 行い、本番デプロイのルーティングテーブルに載らないようにする。
# (security-reviewer PR #38 MEDIUM 指摘反映)
# /api/health/ は本 urlpatterns 直接登録、debug-sentry のみ apps.common.urls に残す。
if settings.DEBUG:
    from apps.common.views import debug_sentry

    urlpatterns += [
        path("debug-sentry/", debug_sentry, name="debug-sentry"),
    ]

admin.site.site_header = "Admin"
admin.site.site_title = "Admin Portal"
admin.site.index_title = "Welcome to site"
