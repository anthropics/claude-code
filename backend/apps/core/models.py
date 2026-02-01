"""
Core Models - User, Workspace, and base classes
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone


# =============================================================================
# Abstract Base Models
# =============================================================================

class TimestampedModel(models.Model):
    """Abstract base with created_at and updated_at timestamps."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Abstract base with UUID primary key."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimestampedModel):
    """Standard base model with UUID and timestamps."""

    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """Manager that filters out soft-deleted records."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(BaseModel):
    """Base model with soft delete capability."""
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        """Soft delete - set deleted_at timestamp."""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def hard_delete(self):
        """Permanently delete the record."""
        super().delete()

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])

    class Meta:
        abstract = True


# =============================================================================
# User Model
# =============================================================================

class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user model with email as username."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None  # Remove username field
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200, blank=True, default="")

    # Onboarding
    onboarding_completed = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return self.email


# =============================================================================
# Workspace Model (simplified for MVP - single user focus)
# =============================================================================

class Workspace(BaseModel):
    """
    Workspace is the top-level container for all user data.
    MVP: One workspace per user, created automatically on signup.
    """
    name = models.CharField(max_length=120)
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="owned_workspaces"
    )

    class Meta:
        db_table = "workspaces"
        indexes = [
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.owner.email})"


class WorkspaceMember(BaseModel):
    """
    Workspace membership - for future team features.
    MVP: Just owner role, expanded later.
    """
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="memberships"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="workspace_memberships"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="owner")

    class Meta:
        db_table = "workspace_members"
        unique_together = ("workspace", "user")
        indexes = [
            models.Index(fields=["workspace", "user"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.role} of {self.workspace.name}"


# =============================================================================
# Generation Job (tracks async AI operations)
# =============================================================================

class GenerationJob(BaseModel):
    """
    Tracks async generation jobs with real status.
    Used for: transcription, clip detection, content generation.
    """
    JOB_TYPES = [
        ("transcribe", "Transcribe Audio"),
        ("analyze", "Analyze Content"),
        ("extract_clips", "Extract Clips"),
        ("generate_drafts", "Generate Drafts"),
        ("learn_voice", "Learn Voice"),
        ("bulk_generate", "Bulk Generate Week"),
    ]

    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="generation_jobs"
    )
    job_type = models.CharField(max_length=30, choices=JOB_TYPES)
    input_data = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")
    progress = models.IntegerField(default=0)  # 0-100
    result = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    celery_task_id = models.CharField(max_length=100, blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "generation_jobs"
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["celery_task_id"]),
            models.Index(fields=["job_type", "status"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.job_type} - {self.status}"

    def mark_running(self):
        self.status = "running"
        self.save(update_fields=["status", "updated_at"])

    def mark_completed(self, result=None):
        self.status = "completed"
        self.progress = 100
        self.result = result
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "progress", "result", "completed_at", "updated_at"])

    def mark_failed(self, error_message: str):
        self.status = "failed"
        self.error_message = error_message[:2000]
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "error_message", "completed_at", "updated_at"])

    def update_progress(self, progress: int):
        self.progress = min(max(progress, 0), 100)
        self.save(update_fields=["progress", "updated_at"])
