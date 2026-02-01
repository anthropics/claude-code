"""
Podcast Views
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count

from apps.core.models import Workspace, GenerationJob
from apps.core.permissions import IsWorkspaceMember
from .models import Show, Episode, EpisodeVersion, PodcastHostConnection
from .serializers import (
    ShowSerializer, EpisodeSerializer, PodcastHostConnectionSerializer,
    EpisodeGenerateSerializer, EpisodePublishSerializer
)


class WorkspaceScopedMixin:
    def get_user_workspaces(self):
        return Workspace.objects.filter(memberships__user=self.request.user)


class ShowViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Podcast show management."""
    serializer_class = ShowSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return Show.objects.filter(
            brand__workspace__in=self.get_user_workspaces()
        ).annotate(episodes_count=Count("episodes"))

    @action(detail=True, methods=["post"])
    def generate_episode(self, request, pk=None):
        """
        POST /shows/{id}/generate_episode/
        Generate a new episode script.
        """
        show = self.get_object()
        serializer = EpisodeGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create episode record
        episode = Episode.objects.create(
            show=show,
            title=data.get("title", data["topic"][:80]),
            status="draft",
        )

        # Create job
        job = GenerationJob.objects.create(
            workspace=show.brand.workspace,
            job_type="generate_drafts",
            input_data={
                "episode_id": str(episode.id),
                "topic": data["topic"],
                "angle": data.get("angle", ""),
                "length_minutes": data["length_minutes"],
            },
        )

        # For now, create a simple script (real implementation would use AI)
        EpisodeVersion.objects.create(
            episode=episode,
            version=1,
            script=f"Episode about: {data['topic']}\nAngle: {data.get('angle', 'general')}\n",
            show_notes="",
            created_by="ai",
        )

        episode.status = "ready_for_review"
        episode.save(update_fields=["status"])
        job.mark_completed(result={"episode_id": str(episode.id)})

        return Response({
            "episode_id": str(episode.id),
            "status": "created",
        }, status=status.HTTP_201_CREATED)


class EpisodeViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Episode management with publishing."""
    serializer_class = EpisodeSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return Episode.objects.filter(
            show__brand__workspace__in=self.get_user_workspaces()
        ).prefetch_related("versions")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve episode for publishing."""
        episode = self.get_object()
        episode.status = "approved"
        episode.save(update_fields=["status", "updated_at"])
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """
        POST /episodes/{id}/publish/
        Publish to podcast host.
        """
        episode = self.get_object()
        serializer = EpisodePublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Check for host connection
        try:
            connection = PodcastHostConnection.objects.get(
                show=episode.show,
                host=data["host"]
            )
        except PodcastHostConnection.DoesNotExist:
            return Response(
                {"error": f"No {data['host']} connection for this show"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create job
        job = GenerationJob.objects.create(
            workspace=episode.show.brand.workspace,
            job_type="bulk_generate",  # Reusing for publish
            input_data={
                "episode_id": str(episode.id),
                "host": data["host"],
                "publish_at": str(data.get("publish_at")) if data.get("publish_at") else None,
            },
        )

        # Queue publish task
        from apps.podcasts.tasks import publish_episode_task
        task = publish_episode_task.delay(
            str(job.id),
            str(episode.id),
            data["host"],
            str(data.get("publish_at")) if data.get("publish_at") else None,
        )
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        episode.status = "scheduled" if data.get("publish_at") else "published"
        episode.scheduled_for = data.get("publish_at")
        episode.save(update_fields=["status", "scheduled_for", "updated_at"])

        return Response({
            "status": "queued",
            "job_id": str(job.id),
        }, status=status.HTTP_202_ACCEPTED)


class PodcastHostConnectionViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Podcast host connection management."""
    serializer_class = PodcastHostConnectionSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return PodcastHostConnection.objects.filter(
            show__brand__workspace__in=self.get_user_workspaces()
        )
