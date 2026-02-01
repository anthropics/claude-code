"""
Publishing API URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlatformConnectionViewSet, PublishViewSet

router = DefaultRouter()
router.register(r"connections", PlatformConnectionViewSet, basename="connection")
router.register(r"publishes", PublishViewSet, basename="publish")

urlpatterns = [
    path("", include(router.urls)),
]
