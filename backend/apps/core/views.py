"""
Core Views - User, Workspace, Jobs
"""
from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .models import Workspace, WorkspaceMember, GenerationJob
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    PasswordChangeSerializer,
    WorkspaceSerializer,
    WorkspaceMemberSerializer,
    GenerationJobSerializer,
)
from .permissions import IsWorkspaceOwnerOrAdmin, IsWorkspaceMember

User = get_user_model()


# =============================================================================
# Authentication Views
# =============================================================================

class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    """Get/update current user."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PasswordChangeView(generics.GenericAPIView):
    """Change password endpoint."""
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"message": "Password changed successfully"})


# =============================================================================
# Workspace Views
# =============================================================================

class WorkspaceViewSet(viewsets.ModelViewSet):
    """Workspace CRUD."""
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Return workspaces the user has access to."""
        return Workspace.objects.filter(
            memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        workspace = serializer.save(owner=self.request.user)
        WorkspaceMember.objects.create(
            workspace=workspace,
            user=self.request.user,
            role="owner",
        )


class WorkspaceMemberViewSet(viewsets.ModelViewSet):
    """Workspace member management."""
    serializer_class = WorkspaceMemberSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceOwnerOrAdmin]

    def get_queryset(self):
        """Return members of workspaces the user has access to."""
        user_workspaces = Workspace.objects.filter(
            memberships__user=self.request.user
        )
        return WorkspaceMember.objects.filter(workspace__in=user_workspaces)


# =============================================================================
# Generation Job Views
# =============================================================================

class GenerationJobViewSet(viewsets.ReadOnlyModelViewSet):
    """View generation job status."""
    serializer_class = GenerationJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return jobs for user's workspaces."""
        user_workspaces = Workspace.objects.filter(
            memberships__user=self.request.user
        )
        return GenerationJob.objects.filter(workspace__in=user_workspaces)

    @action(detail=True, methods=["get"])
    def poll(self, request, pk=None):
        """
        Poll job status - lightweight endpoint for frontend polling.
        """
        job = self.get_object()
        return Response({
            "id": str(job.id),
            "status": job.status,
            "progress": job.progress,
            "completed": job.status in ["completed", "failed"],
        })


class JobStatusView(APIView):
    """
    Quick job status check by ID.
    GET /api/v1/jobs/{job_id}/status/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        try:
            # Verify user has access
            user_workspaces = Workspace.objects.filter(
                memberships__user=request.user
            )
            job = GenerationJob.objects.get(
                id=job_id,
                workspace__in=user_workspaces
            )

            return Response({
                "id": str(job.id),
                "job_type": job.job_type,
                "status": job.status,
                "progress": job.progress,
                "result": job.result if job.status == "completed" else None,
                "error": job.error_message if job.status == "failed" else None,
            })

        except GenerationJob.DoesNotExist:
            return Response(
                {"error": "Job not found"},
                status=status.HTTP_404_NOT_FOUND
            )
