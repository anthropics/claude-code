"""
Publishing Models - Platform Connections and Publish Records
"""
from django.db import models
from apps.core.models import BaseModel, Workspace
from apps.content.models import Brand, Draft
from apps.core.crypto import encrypt_str, decrypt_str


class PlatformConnection(BaseModel):
    """
    OAuth connection to a social platform.
    Stores encrypted tokens.
    """
    PLATFORM_CHOICES = [
        ("youtube", "YouTube"),
        ("tiktok", "TikTok"),
        ("x", "X/Twitter"),
        ("instagram", "Instagram"),
        ("threads", "Threads"),
        ("linkedin", "LinkedIn"),
    ]

    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="platform_connections"
    )
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)

    # Account info
    account_id = models.CharField(max_length=200, blank=True, default="")
    account_handle = models.CharField(max_length=200, blank=True, default="")
    account_name = models.CharField(max_length=200, blank=True, default="")

    # Encrypted tokens
    _access_token_encrypted = models.TextField(blank=True, default="", db_column="access_token")
    _refresh_token_encrypted = models.TextField(blank=True, default="", db_column="refresh_token")

    # Token metadata
    expires_at = models.DateTimeField(null=True, blank=True)
    scopes = models.TextField(blank=True, default="")

    # Status
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        db_table = "platform_connections"
        unique_together = ("brand", "platform")
        indexes = [
            models.Index(fields=["brand", "platform"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.brand.name} -> {self.platform}"

    @property
    def access_token(self) -> str:
        if not self._access_token_encrypted:
            return ""
        return decrypt_str(self._access_token_encrypted)

    @access_token.setter
    def access_token(self, value: str):
        if value:
            self._access_token_encrypted = encrypt_str(value)
        else:
            self._access_token_encrypted = ""

    @property
    def refresh_token(self) -> str:
        if not self._refresh_token_encrypted:
            return ""
        return decrypt_str(self._refresh_token_encrypted)

    @refresh_token.setter
    def refresh_token(self, value: str):
        if value:
            self._refresh_token_encrypted = encrypt_str(value)
        else:
            self._refresh_token_encrypted = ""


class Publish(BaseModel):
    """
    Record of content publishing attempt.
    Audit trail for all publishing actions.
    """
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("published", "Published"),
        ("failed", "Failed"),
        ("canceled", "Canceled"),
    ]

    CONTENT_TYPE_CHOICES = [
        ("youtube_short", "YouTube Short"),
        ("tiktok", "TikTok"),
        ("x_post", "X Post"),
        ("x_thread", "X Thread"),
        ("instagram_reel", "Instagram Reel"),
        ("podcast_episode", "Podcast Episode"),
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="publishes"
    )
    platform = models.CharField(max_length=30)
    content_type = models.CharField(max_length=30, choices=CONTENT_TYPE_CHOICES)

    # Source reference (draft or episode)
    draft = models.ForeignKey(
        Draft,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="publishes"
    )
    source_id = models.UUIDField(null=True, blank=True)  # For non-draft sources

    # Content snapshot
    payload = models.JSONField(default=dict)  # Content at time of publish

    # Scheduling
    scheduled_for = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")
    attempts = models.IntegerField(default=0)

    # Platform response
    platform_post_id = models.CharField(max_length=200, blank=True, default="")
    platform_url = models.TextField(blank=True, default="")
    last_error = models.TextField(blank=True, default="")

    class Meta:
        db_table = "publishes"
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["scheduled_for"]),
            models.Index(fields=["status"]),
            models.Index(fields=["platform"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.platform} - {self.status}"

    def mark_running(self):
        self.status = "running"
        self.attempts += 1
        self.save(update_fields=["status", "attempts", "updated_at"])

    def mark_published(self, platform_post_id: str = "", platform_url: str = ""):
        from django.utils import timezone
        self.status = "published"
        self.platform_post_id = platform_post_id
        self.platform_url = platform_url
        self.published_at = timezone.now()
        self.save(update_fields=[
            "status", "platform_post_id", "platform_url", "published_at", "updated_at"
        ])

    def mark_failed(self, error: str):
        self.status = "failed"
        self.last_error = error[:2000]
        self.save(update_fields=["status", "last_error", "updated_at"])
