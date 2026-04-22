"""URL patterns for common utility views (debug-sentry etc.)."""
from __future__ import annotations

from django.urls import URLPattern, URLResolver, path

from apps.common.views import debug_sentry

urlpatterns: list[URLPattern | URLResolver] = [
    path("", debug_sentry, name="debug-sentry"),
]
