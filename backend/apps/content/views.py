"""
Content Views - Brand, Transcript, Clip, Draft management
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from django.db import transaction

from apps.core.models import Workspace, GenerationJob
from apps.core.permissions import IsWorkspaceMember
from .models import (
    Brand, VoiceFingerprint, SourceSample, Transcript, Clip,
    ContentPlan, PlanItem, Draft, DraftVersion
)
from .serializers import (
    BrandSerializer, BrandCreateSerializer, VoiceFingerprintSerializer,
    SourceSampleSerializer, SourceSampleCreateSerializer,
    TranscriptSerializer, TranscriptCreateSerializer,
    ClipSerializer, ContentPlanSerializer, PlanItemSerializer,
    DraftSerializer, DraftEditSerializer, DraftRegenSerializer,
    GeneratePlanSerializer, GenerateDraftSerializer,
)


class WorkspaceScopedMixin:
    """Mixin to filter querysets by user's workspaces."""

    def get_user_workspaces(self):
        return Workspace.objects.filter(memberships__user=self.request.user)


# =============================================================================
# Brand ViewSet
# =============================================================================

class BrandViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Brand CRUD with voice learning."""
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_serializer_class(self):
        if self.action == "create":
            return BrandCreateSerializer
        return BrandSerializer

    def get_queryset(self):
        return Brand.objects.filter(
            workspace__in=self.get_user_workspaces()
        ).select_related("voice")

    def perform_create(self, serializer):
        # Get user's primary workspace
        workspace = self.get_user_workspaces().first()
        if not workspace:
            raise ValueError("No workspace found")

        brand = serializer.save(workspace=workspace)

        # Create empty voice fingerprint
        VoiceFingerprint.objects.create(brand=brand)

    @action(detail=True, methods=["post"])
    def learn_voice(self, request, pk=None):
        """
        POST /brands/{id}/learn_voice/
        Triggers voice learning from brand's samples.
        """
        brand = self.get_object()
        workspace = brand.workspace

        # Create job
        job = GenerationJob.objects.create(
            workspace=workspace,
            job_type="learn_voice",
            input_data={"brand_id": str(brand.id)},
        )

        # Queue task
        from apps.ai.tasks import learn_voice_task
        task = learn_voice_task.delay(str(job.id), str(brand.id))
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        return Response({
            "status": "queued",
            "job_id": str(job.id),
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"])
    def generate_plan(self, request, pk=None):
        """
        POST /brands/{id}/generate_plan/
        Generate a week's content plan.
        """
        brand = self.get_object()
        serializer = GeneratePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create job
        job = GenerationJob.objects.create(
            workspace=brand.workspace,
            job_type="bulk_generate",
            input_data={
                "brand_id": str(brand.id),
                **serializer.validated_data,
                "week_start": str(serializer.validated_data["week_start"]),
            },
        )

        # Queue task
        from apps.ai.tasks import generate_content_plan_task
        task = generate_content_plan_task.delay(
            str(job.id),
            str(brand.id),
            str(serializer.validated_data["week_start"]),
            serializer.validated_data["platforms"],
            serializer.validated_data["posts_per_day"],
        )
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        return Response({
            "status": "queued",
            "job_id": str(job.id),
        }, status=status.HTTP_202_ACCEPTED)


# =============================================================================
# Source Sample ViewSet
# =============================================================================

class SourceSampleViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Source samples for voice learning."""
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_serializer_class(self):
        if self.action == "create":
            return SourceSampleCreateSerializer
        return SourceSampleSerializer

    def get_queryset(self):
        return SourceSample.objects.filter(
            brand__workspace__in=self.get_user_workspaces()
        )


# =============================================================================
# Transcript ViewSet
# =============================================================================

class TranscriptViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Transcript management with clip detection."""
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]
    serializer_class = TranscriptSerializer

    def get_queryset(self):
        return Transcript.objects.filter(
            brand__workspace__in=self.get_user_workspaces()
        ).annotate(clips_count=Count("clips"))

    def create(self, request, *args, **kwargs):
        """Create transcript and optionally trigger transcription."""
        serializer = TranscriptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Verify brand access
        brand = Brand.objects.filter(
            id=data["brand_id"],
            workspace__in=self.get_user_workspaces()
        ).first()

        if not brand:
            return Response(
                {"error": "Brand not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create transcript
        transcript = Transcript.objects.create(
            brand=brand,
            title=data.get("title", ""),
            source_type=data["source_type"],
            source_url=data.get("audio_url", ""),
            raw_text=data.get("raw_text", ""),
            status="ready" if data["source_type"] == "paste" else "processing",
        )

        # If audio upload, trigger transcription
        if data["source_type"] == "upload" and data.get("audio_url"):
            job = GenerationJob.objects.create(
                workspace=brand.workspace,
                job_type="transcribe",
                input_data={
                    "transcript_id": str(transcript.id),
                    "audio_url": data["audio_url"],
                },
            )

            from apps.ai.tasks import transcribe_audio_task
            task = transcribe_audio_task.delay(str(job.id), data["audio_url"])
            job.celery_task_id = task.id
            job.save(update_fields=["celery_task_id"])

            return Response({
                "transcript": TranscriptSerializer(transcript).data,
                "job_id": str(job.id),
                "status": "transcription_queued",
            }, status=status.HTTP_202_ACCEPTED)

        return Response(
            TranscriptSerializer(transcript).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def detect_clips(self, request, pk=None):
        """
        POST /transcripts/{id}/detect_clips/
        Detect viral clips in transcript.
        """
        transcript = self.get_object()

        if transcript.status != "ready":
            return Response(
                {"error": "Transcript not ready"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create job
        job = GenerationJob.objects.create(
            workspace=transcript.brand.workspace,
            job_type="extract_clips",
            input_data={"transcript_id": str(transcript.id)},
        )

        from apps.ai.tasks import detect_clips_task
        task = detect_clips_task.delay(str(job.id), str(transcript.id))
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        return Response({
            "status": "queued",
            "job_id": str(job.id),
        }, status=status.HTTP_202_ACCEPTED)


# =============================================================================
# Clip ViewSet
# =============================================================================

class ClipViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Clip management."""
    serializer_class = ClipSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return Clip.objects.filter(
            transcript__brand__workspace__in=self.get_user_workspaces()
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a clip for content creation."""
        clip = self.get_object()
        clip.status = "approved"
        clip.save(update_fields=["status", "updated_at"])
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a clip."""
        clip = self.get_object()
        clip.status = "rejected"
        clip.save(update_fields=["status", "updated_at"])
        return Response({"status": "rejected"})


# =============================================================================
# Content Plan ViewSet
# =============================================================================

class ContentPlanViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Content plan management."""
    serializer_class = ContentPlanSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return ContentPlan.objects.filter(
            brand__workspace__in=self.get_user_workspaces()
        ).annotate(items_count=Count("items"))

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """Activate a plan."""
        plan = self.get_object()
        plan.status = "active"
        plan.save(update_fields=["status", "updated_at"])
        return Response({"status": "active"})


# =============================================================================
# Plan Item ViewSet
# =============================================================================

class PlanItemViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Plan item management with draft generation."""
    serializer_class = PlanItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return PlanItem.objects.filter(
            content_plan__brand__workspace__in=self.get_user_workspaces()
        )

    @action(detail=True, methods=["post"])
    def generate_draft(self, request, pk=None):
        """
        POST /plan-items/{id}/generate_draft/
        Generate a draft for this plan item.
        """
        plan_item = self.get_object()
        serializer = GenerateDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        platform = serializer.validated_data.get("platform", plan_item.platform)
        workspace = plan_item.content_plan.brand.workspace

        # Create job
        job = GenerationJob.objects.create(
            workspace=workspace,
            job_type="generate_drafts",
            input_data={
                "plan_item_id": str(plan_item.id),
                "platform": platform,
            },
        )

        from apps.ai.tasks import generate_draft_task
        task = generate_draft_task.delay(str(job.id), str(plan_item.id), platform)
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        # Update plan item status
        plan_item.status = "drafting"
        plan_item.save(update_fields=["status", "updated_at"])

        return Response({
            "status": "queued",
            "job_id": str(job.id),
        }, status=status.HTTP_202_ACCEPTED)


# =============================================================================
# Draft ViewSet
# =============================================================================

class DraftViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    """Draft management with edit and regeneration."""
    serializer_class = DraftSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return Draft.objects.filter(
            plan_item__content_plan__brand__workspace__in=self.get_user_workspaces()
        ).prefetch_related("versions")

    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None):
        """
        POST /drafts/{id}/edit/
        Create a new version with user edits.
        """
        draft = self.get_object()
        serializer = DraftEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create new version
        new_version_num = draft.current_version + 1
        with transaction.atomic():
            DraftVersion.objects.create(
                draft=draft,
                version=new_version_num,
                content=serializer.validated_data["content"],
                metadata={"edited_from": draft.current_version},
                created_by="user",
            )
            draft.current_version = new_version_num
            draft.status = "ready_for_review"
            draft.save(update_fields=["current_version", "status", "updated_at"])

        return Response({
            "status": "updated",
            "version": new_version_num,
        })

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        """
        POST /drafts/{id}/regenerate/
        Regenerate with feedback.
        """
        draft = self.get_object()
        serializer = DraftRegenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        workspace = draft.plan_item.content_plan.brand.workspace

        # Create job
        job = GenerationJob.objects.create(
            workspace=workspace,
            job_type="generate_drafts",
            input_data={
                "draft_id": str(draft.id),
                "feedback": serializer.validated_data["feedback"],
            },
        )

        from apps.ai.tasks import regenerate_draft_task
        task = regenerate_draft_task.delay(
            str(job.id),
            str(draft.id),
            serializer.validated_data["feedback"],
        )
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        return Response({
            "status": "queued",
            "job_id": str(job.id),
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a draft."""
        draft = self.get_object()
        draft.status = "approved"
        draft.save(update_fields=["status", "updated_at"])

        # Also update plan item
        draft.plan_item.status = "approved"
        draft.plan_item.save(update_fields=["status", "updated_at"])

        return Response({"status": "approved"})
