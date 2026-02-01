"""
Content API URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BrandViewSet, SourceSampleViewSet, TranscriptViewSet,
    ClipViewSet, ContentPlanViewSet, PlanItemViewSet, DraftViewSet
)

router = DefaultRouter()
router.register(r"brands", BrandViewSet, basename="brand")
router.register(r"samples", SourceSampleViewSet, basename="sample")
router.register(r"transcripts", TranscriptViewSet, basename="transcript")
router.register(r"clips", ClipViewSet, basename="clip")
router.register(r"plans", ContentPlanViewSet, basename="plan")
router.register(r"plan-items", PlanItemViewSet, basename="plan-item")
router.register(r"drafts", DraftViewSet, basename="draft")

urlpatterns = [
    path("", include(router.urls)),
]
