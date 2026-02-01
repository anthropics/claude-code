"""
Podcast Models - Shows, Episodes, and Host Connections
"""
from django.db import models
from apps.core.models import BaseModel
from apps.content.models import Brand, PlanItem
from apps.core.crypto import encrypt_str, decrypt_str


class Show(BaseModel):
    """
    A podcast show belonging to a brand.
    """
    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="shows"
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=200, blank=True, default="")
    language = models.CharField(max_length=10, default="en")
    explicit = models.BooleanField(default=False)

    # Artwork
    artwork_url = models.TextField(blank=True, default="")

    class Meta:
        db_table = "shows"
        indexes = [
            models.Index(fields=["brand"]),
        ]

    def __str__(self):
        return self.title


class Episode(BaseModel):
    """
    A podcast episode.
    """
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("ready_for_review", "Ready for Review"),
        ("approved", "Approved"),
        ("scheduled", "Scheduled"),
        ("published", "Published"),
        ("failed", "Failed"),
    ]

    show = models.ForeignKey(
        Show,
        on_delete=models.CASCADE,
        related_name="episodes"
    )

    # Optional link to content plan
    plan_item = models.ForeignKey(
        PlanItem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="podcast_episodes"
    )

    # Content
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")  # Show notes
    script = models.TextField(blank=True, default="")

    # Media
    audio_url = models.TextField(blank=True, default="")
    transcript_text = models.TextField(blank=True, default="")
    duration_seconds = models.IntegerField(null=True, blank=True)

    # Metadata
    episode_number = models.IntegerField(null=True, blank=True)
    season_number = models.IntegerField(null=True, blank=True)
    keywords = models.JSONField(default=list)
    chapters = models.JSONField(default=list)  # [{title, start_time}]

    # Publishing
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="draft")
    scheduled_for = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    # External references
    external_id = models.CharField(max_length=200, blank=True, default="")  # ID on podcast host
    external_url = models.TextField(blank=True, default="")  # URL on podcast host

    class Meta:
        db_table = "episodes"
        indexes = [
            models.Index(fields=["show", "status"]),
            models.Index(fields=["scheduled_for"]),
            models.Index(fields=["status"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.show.title} - {self.title}"


class EpisodeVersion(BaseModel):
    """
    Version history for episode script and show notes.
    """
    CREATED_BY_CHOICES = [
        ("ai", "AI Generated"),
        ("user", "User Edited"),
    ]

    episode = models.ForeignKey(
        Episode,
        on_delete=models.CASCADE,
        related_name="versions"
    )
    version = models.IntegerField()
    script = models.TextField()
    show_notes = models.TextField(blank=True, default="")
    created_by = models.CharField(max_length=10, choices=CREATED_BY_CHOICES)

    class Meta:
        db_table = "episode_versions"
        unique_together = ("episode", "version")
        ordering = ["-version"]

    def __str__(self):
        return f"v{self.version} ({self.created_by})"


class PodcastHostConnection(BaseModel):
    """
    Connection to external podcast hosting service (RSS.com, etc.)
    """
    HOST_CHOICES = [
        ("rss_com", "RSS.com"),
        ("transistor", "Transistor"),
        ("buzzsprout", "Buzzsprout"),
        ("anchor", "Anchor"),
    ]

    show = models.ForeignKey(
        Show,
        on_delete=models.CASCADE,
        related_name="host_connections"
    )
    host = models.CharField(max_length=30, choices=HOST_CHOICES)

    # Encrypted API key
    _api_key_encrypted = models.TextField(blank=True, default="", db_column="api_key_encrypted")

    # External IDs
    external_show_id = models.CharField(max_length=200, blank=True, default="")

    # Settings
    settings = models.JSONField(default=dict)

    class Meta:
        db_table = "podcast_host_connections"
        unique_together = ("show", "host")

    def __str__(self):
        return f"{self.show.title} -> {self.host}"

    @property
    def api_key(self) -> str:
        """Decrypt and return API key."""
        if not self._api_key_encrypted:
            return ""
        return decrypt_str(self._api_key_encrypted)

    @api_key.setter
    def api_key(self, value: str):
        """Encrypt and store API key."""
        if value:
            self._api_key_encrypted = encrypt_str(value)
        else:
            self._api_key_encrypted = ""
