"""
Media API URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, presigned_upload

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="asset")

urlpatterns = [
    path("presigned-upload/", presigned_upload, name="presigned-upload"),
    path("", include(router.urls)),
]
