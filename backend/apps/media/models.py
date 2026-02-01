"""
Media Models - Assets and File Storage
"""
from django.db import models
from apps.core.models import BaseModel, Workspace


class Asset(BaseModel):
    """
    Media asset (audio, video, image, etc.)
    """
    KIND_CHOICES = [
        ("audio", "Audio"),
        ("video", "Video"),
        ("image", "Image"),
        ("transcript", "Transcript"),
        ("document", "Document"),
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="assets"
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)

    # File info
    filename = models.CharField(max_length=500, blank=True, default="")
    storage_url = models.TextField()  # S3/R2 URL
    content_type = models.CharField(max_length=100, blank=True, default="")
    file_size_bytes = models.BigIntegerField(null=True, blank=True)

    # Media metadata
    duration_seconds = models.IntegerField(null=True, blank=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)

    # Additional metadata
    metadata = models.JSONField(default=dict)

    class Meta:
        db_table = "assets"
        indexes = [
            models.Index(fields=["workspace", "kind"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename or self.id} ({self.kind})"
