"""
Content Models - Brand, Transcript, Clip, VoiceFingerprint, Draft
The core content creation pipeline.
"""
import uuid
from django.db import models
from apps.core.models import BaseModel, SoftDeleteModel, Workspace


# =============================================================================
# Brand Model
# =============================================================================

class Brand(SoftDeleteModel):
    """
    A brand represents a creator's identity/voice.
    All content is generated in the context of a brand.
    MVP: Most users have one brand per workspace.
    """
    GOAL_CHOICES = [
        ("growth", "Audience Growth"),
        ("monetize", "Monetization"),
        ("authority", "Authority Building"),
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="brands"
    )
    name = models.CharField(max_length=200)
    niche = models.TextField(blank=True, default="")
    target_audience = models.TextField(blank=True, default="")
    primary_goal = models.CharField(
        max_length=20,
        choices=GOAL_CHOICES,
        default="growth"
    )

    class Meta:
        db_table = "brands"
        indexes = [
            models.Index(fields=["workspace"]),
        ]

    def __str__(self):
        return self.name


# =============================================================================
# Voice Fingerprint Model
# =============================================================================

class VoiceFingerprint(BaseModel):
    """
    Learned voice characteristics from content samples.
    Actually useful fields only - no vanity metrics.
    """
    VOCABULARY_LEVELS = [
        ("simple", "Simple"),
        ("conversational", "Conversational"),
        ("technical", "Technical"),
    ]

    brand = models.OneToOneField(
        Brand,
        on_delete=models.CASCADE,
        related_name="voice"
    )

    # Phrases they actually use
    sample_phrases = models.JSONField(default=list)

    # How they communicate
    vocabulary_level = models.CharField(
        max_length=20,
        choices=VOCABULARY_LEVELS,
        default="conversational"
    )
    humor_style = models.CharField(max_length=100, blank=True, default="")

    # Patterns
    opening_patterns = models.JSONField(default=list)  # How they start content
    closing_patterns = models.JSONField(default=list)  # How they end (CTAs, signoffs)

    # Constraints
    banned_phrases = models.JSONField(default=list)  # Things they'd never say

    # Approved examples
    example_outputs = models.JSONField(default=list)  # 3-5 examples they liked

    # Learning status
    samples_analyzed = models.IntegerField(default=0)
    last_learned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "voice_fingerprints"

    def __str__(self):
        return f"Voice for {self.brand.name}"

    def to_prompt_context(self) -> dict:
        """Export voice data for use in prompts."""
        return {
            "sample_phrases": self.sample_phrases[:10],
            "vocabulary_level": self.vocabulary_level,
            "humor_style": self.humor_style,
            "opening_patterns": self.opening_patterns[:5],
            "closing_patterns": self.closing_patterns[:5],
            "banned_phrases": self.banned_phrases[:10],
            "example_outputs": self.example_outputs[:3],
        }


# =============================================================================
# Source Sample Model
# =============================================================================

class SourceSample(BaseModel):
    """
    Raw content samples used to learn the creator's voice.
    Can be: pasted text, uploaded files, URLs, or transcripts.
    """
    SOURCE_TYPES = [
        ("paste", "Pasted Text"),
        ("file", "Uploaded File"),
        ("url", "URL Import"),
        ("transcript", "From Transcript"),
    ]

    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="samples"
    )
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES)
    title = models.CharField(max_length=300, blank=True, default="")
    raw_text = models.TextField()
    word_count = models.IntegerField(default=0)
    analyzed = models.BooleanField(default=False)

    class Meta:
        db_table = "source_samples"
        indexes = [
            models.Index(fields=["brand"]),
            models.Index(fields=["analyzed"]),
        ]
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.raw_text:
            self.word_count = len(self.raw_text.split())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title or 'Untitled'} ({self.source_type})"


# =============================================================================
# Transcript Model
# =============================================================================

class Transcript(BaseModel):
    """
    The atomic unit - all content derives from transcripts.
    Source can be: audio upload, pasted text, or URL import.
    """
    SOURCE_TYPES = [
        ("upload", "Audio Upload"),
        ("paste", "Pasted Text"),
        ("url", "URL Import"),
    ]

    STATUS_CHOICES = [
        ("processing", "Processing"),
        ("ready", "Ready"),
        ("failed", "Failed"),
    ]

    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="transcripts"
    )
    title = models.CharField(max_length=300, blank=True, default="")
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES)
    source_url = models.TextField(blank=True, default="")  # Original file URL if uploaded

    # Content
    raw_text = models.TextField(blank=True, default="")
    segments_json = models.JSONField(default=list)  # [{start, end, text, speaker}]

    # Metadata
    duration_seconds = models.IntegerField(null=True, blank=True)
    word_count = models.IntegerField(default=0)
    language = models.CharField(max_length=10, default="en")

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="processing"
    )
    error_message = models.TextField(blank=True, default="")

    class Meta:
        db_table = "transcripts"
        indexes = [
            models.Index(fields=["brand", "status"]),
            models.Index(fields=["status"]),
        ]
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.raw_text:
            self.word_count = len(self.raw_text.split())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title or 'Untitled Transcript'} ({self.status})"


# =============================================================================
# Clip Model
# =============================================================================

class Clip(BaseModel):
    """
    Extracted viral moment from a transcript.
    These become the basis for short-form content.
    """
    STATUS_CHOICES = [
        ("detected", "Detected"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("published", "Published"),
    ]

    transcript = models.ForeignKey(
        Transcript,
        on_delete=models.CASCADE,
        related_name="clips"
    )

    # Timing (seconds from start of transcript)
    start_time = models.FloatField()
    end_time = models.FloatField()

    # Content
    text = models.TextField()
    word_count = models.IntegerField(default=0)

    # AI Scoring
    hook_score = models.IntegerField(default=0)  # 0-100, how strong is the opening
    viral_score = models.IntegerField(default=0)  # 0-100, overall clip potential

    # Metadata
    topic_tags = models.JSONField(default=list)
    suggested_caption = models.TextField(blank=True, default="")

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="detected"
    )

    class Meta:
        db_table = "clips"
        indexes = [
            models.Index(fields=["transcript"]),
            models.Index(fields=["status"]),
            models.Index(fields=["viral_score"]),
        ]
        ordering = ["-viral_score", "-created_at"]

    def save(self, *args, **kwargs):
        if self.text:
            self.word_count = len(self.text.split())
        super().save(*args, **kwargs)

    @property
    def duration_seconds(self) -> float:
        return self.end_time - self.start_time

    def __str__(self):
        return f"Clip ({self.viral_score}/100) - {self.text[:50]}..."


# =============================================================================
# Content Plan Model
# =============================================================================

class ContentPlan(BaseModel):
    """
    Weekly content plan - the scheduling backbone.
    """
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("archived", "Archived"),
    ]

    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="plans"
    )
    week_start = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft"
    )
    plan_metadata = models.JSONField(default=dict)  # Generation params, notes

    class Meta:
        db_table = "content_plans"
        unique_together = ("brand", "week_start")
        indexes = [
            models.Index(fields=["brand", "week_start"]),
            models.Index(fields=["status"]),
        ]
        ordering = ["-week_start"]

    def __str__(self):
        return f"Plan for {self.brand.name} - Week of {self.week_start}"


# =============================================================================
# Plan Item Model
# =============================================================================

class PlanItem(BaseModel):
    """
    Individual scheduled content slot in a plan.
    """
    PLATFORM_CHOICES = [
        ("youtube_short", "YouTube Short"),
        ("tiktok", "TikTok"),
        ("x", "X/Twitter"),
        ("instagram_reel", "Instagram Reel"),
        ("newsletter", "Newsletter"),
        ("youtube_video", "YouTube Video"),
        ("podcast_episode", "Podcast Episode"),
    ]

    STATUS_CHOICES = [
        ("planned", "Planned"),
        ("drafting", "Drafting"),
        ("ready", "Ready for Review"),
        ("approved", "Approved"),
        ("scheduled", "Scheduled"),
        ("published", "Published"),
        ("failed", "Failed"),
    ]

    content_plan = models.ForeignKey(
        ContentPlan,
        on_delete=models.CASCADE,
        related_name="items"
    )

    # Scheduling
    day_of_week = models.IntegerField()  # 0=Monday, 6=Sunday
    slot = models.CharField(max_length=50, default="morning")  # morning/afternoon/evening
    scheduled_time = models.DateTimeField(null=True, blank=True)

    # Content
    platform = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    topic = models.CharField(max_length=500)
    angle = models.CharField(max_length=500, blank=True, default="")
    intent = models.CharField(max_length=100, blank=True, default="educate")

    # Source (optional - link to clip or transcript)
    source_clip = models.ForeignKey(
        Clip,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="plan_items"
    )
    source_transcript = models.ForeignKey(
        Transcript,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="plan_items"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="planned"
    )

    class Meta:
        db_table = "plan_items"
        indexes = [
            models.Index(fields=["content_plan", "day_of_week"]),
            models.Index(fields=["status"]),
            models.Index(fields=["platform"]),
            models.Index(fields=["scheduled_time"]),
        ]
        ordering = ["day_of_week", "slot"]

    def __str__(self):
        return f"{self.platform} - {self.topic[:50]}"


# =============================================================================
# Draft Model
# =============================================================================

class Draft(BaseModel):
    """
    Generated content draft awaiting review.
    """
    PLATFORM_CHOICES = PlanItem.PLATFORM_CHOICES

    STATUS_CHOICES = [
        ("generating", "Generating"),
        ("ready_for_review", "Ready for Review"),
        ("approved", "Approved"),
        ("needs_regen", "Needs Regeneration"),
        ("scheduled", "Scheduled"),
        ("published", "Published"),
        ("failed", "Failed"),
    ]

    plan_item = models.ForeignKey(
        PlanItem,
        on_delete=models.CASCADE,
        related_name="drafts"
    )
    platform = models.CharField(max_length=30, choices=PLATFORM_CHOICES)

    # Version tracking
    current_version = models.IntegerField(default=1)

    # Quality metrics
    quality_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    quality_flags = models.JSONField(default=dict)  # Warnings, suggestions

    # Status
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="generating"
    )

    class Meta:
        db_table = "drafts"
        indexes = [
            models.Index(fields=["plan_item"]),
            models.Index(fields=["status"]),
            models.Index(fields=["platform"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Draft v{self.current_version} - {self.platform}"


# =============================================================================
# Draft Version Model
# =============================================================================

class DraftVersion(BaseModel):
    """
    Individual version of a draft (for edit history).
    """
    CREATED_BY_CHOICES = [
        ("ai", "AI Generated"),
        ("user", "User Edited"),
    ]

    draft = models.ForeignKey(
        Draft,
        on_delete=models.CASCADE,
        related_name="versions"
    )
    version = models.IntegerField()
    content = models.TextField()
    metadata = models.JSONField(default=dict)  # Generation params, etc.
    created_by = models.CharField(max_length=10, choices=CREATED_BY_CHOICES)

    # Regeneration context
    regen_feedback = models.TextField(blank=True, default="")  # User feedback for regen

    class Meta:
        db_table = "draft_versions"
        unique_together = ("draft", "version")
        indexes = [
            models.Index(fields=["draft", "version"]),
        ]
        ordering = ["-version"]

    def __str__(self):
        return f"v{self.version} ({self.created_by})"
