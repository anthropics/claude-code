"""
Core API URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views import WorkspaceViewSet, WorkspaceMemberViewSet, GenerationJobViewSet, JobStatusView

router = DefaultRouter()
router.register(r"workspaces", WorkspaceViewSet, basename="workspace")
router.register(r"workspace-members", WorkspaceMemberViewSet, basename="workspace-member")
router.register(r"jobs", GenerationJobViewSet, basename="job")

urlpatterns = [
    path("", include(router.urls)),
    path("jobs/<uuid:job_id>/status/", JobStatusView.as_view(), name="job-status"),
]
