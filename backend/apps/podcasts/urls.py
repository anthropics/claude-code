"""
Podcast API URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShowViewSet, EpisodeViewSet, PodcastHostConnectionViewSet

router = DefaultRouter()
router.register(r"shows", ShowViewSet, basename="show")
router.register(r"episodes", EpisodeViewSet, basename="episode")
router.register(r"podcast-connections", PodcastHostConnectionViewSet, basename="podcast-connection")

urlpatterns = [
    path("", include(router.urls)),
]
