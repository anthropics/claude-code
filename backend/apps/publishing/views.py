"""
Publishing Views
"""
from rest_framework import viewsets, permissions

from apps.core.models import Workspace
from apps.core.permissions import IsWorkspaceMember
from .models import PlatformConnection, Publish
from .serializers import PlatformConnectionSerializer, PublishSerializer


class WorkspaceScopedMixin:
    def get_user_workspaces(self):
        return Workspace.objects.filter(memberships__user=self.request.user)


class PlatformConnectionViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Platform connection management."""
    serializer_class = PlatformConnectionSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return PlatformConnection.objects.filter(
            brand__workspace__in=self.get_user_workspaces()
        )


class PublishViewSet(WorkspaceScopedMixin, viewsets.ReadOnlyModelViewSet):
    """View publish history."""
    serializer_class = PublishSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return Publish.objects.filter(
            workspace__in=self.get_user_workspaces()
        )
