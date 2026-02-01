"""
AI Models - Prompt templates and generation tracking
"""
from django.db import models
from apps.core.models import BaseModel


class PromptTemplate(BaseModel):
    """
    Stored prompt templates for different generation types.
    Allows A/B testing and iteration without code deploys.
    """
    TEMPLATE_TYPES = [
        ("youtube_short", "YouTube Short Script"),
        ("tiktok", "TikTok Script"),
        ("x_thread", "X/Twitter Thread"),
        ("x_single", "X/Twitter Single Post"),
        ("newsletter_section", "Newsletter Section"),
        ("show_notes", "Podcast Show Notes"),
        ("clip_detection", "Clip Detection"),
        ("voice_analysis", "Voice Analysis"),
    ]

    name = models.CharField(max_length=200)
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPES)
    prompt_text = models.TextField()
    is_active = models.BooleanField(default=True)
    version = models.IntegerField(default=1)

    # Performance tracking
    uses_count = models.IntegerField(default=0)
    avg_quality_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    class Meta:
        db_table = "prompt_templates"
        indexes = [
            models.Index(fields=["template_type", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} (v{self.version})"
