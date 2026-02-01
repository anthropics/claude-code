"""
Creator Studio - URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health_check(request):
    """Health check endpoint for load balancers and orchestration."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "healthy", "db": "ok"})
    except Exception as e:
        return JsonResponse({"status": "unhealthy", "error": str(e)}, status=503)


urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # Health check
    path("health/", health_check, name="health-check"),

    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),

    # API v1
    path("api/v1/auth/", include("apps.core.urls.auth")),
    path("api/v1/", include("apps.core.urls.api")),
    path("api/v1/", include("apps.content.urls")),
    path("api/v1/", include("apps.ai.urls")),
    path("api/v1/", include("apps.billing.urls")),
    path("api/v1/", include("apps.podcasts.urls")),
    path("api/v1/", include("apps.publishing.urls")),
    path("api/v1/", include("apps.media.urls")),
]
