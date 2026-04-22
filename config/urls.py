from django.contrib import admin
from django.conf import settings
from django.urls import path, include
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions


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
    path(
        "redoc/",
        schema_view.with_ui("redoc", cache_timeout=0),
        name="schema-redoc",
    ),
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/auth/", include("djoser.urls")),
    path("api/v1/auth/", include("apps.users.urls")),
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

admin.site.site_header = "Admin"
admin.site.site_title = "Admin Portal"
admin.site.index_title = "Welcome to site"
