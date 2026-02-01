"""
Billing Models - Subscriptions and Usage Tracking
"""
from django.db import models
from apps.core.models import BaseModel, Workspace


class Subscription(BaseModel):
    """
    Workspace subscription with Stripe integration.
    """
    PLANS = [
        ("free", "Free"),
        ("creator", "Creator"),
        ("pro", "Pro"),
        ("agency", "Agency"),
    ]

    # Plan limits: -1 means unlimited
    LIMITS = {
        "free": {
            "generations_per_month": 3,
            "brands": 1,
            "scheduled_posts": 0,
            "team_seats": 1,
            "price_monthly": 0,
        },
        "creator": {
            "generations_per_month": -1,
            "brands": 1,
            "scheduled_posts": 30,
            "team_seats": 1,
            "price_monthly": 29,
        },
        "pro": {
            "generations_per_month": -1,
            "brands": 3,
            "scheduled_posts": -1,
            "team_seats": 3,
            "price_monthly": 79,
        },
        "agency": {
            "generations_per_month": -1,
            "brands": 10,
            "scheduled_posts": -1,
            "team_seats": 10,
            "price_monthly": 199,
        },
    }

    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="subscription"
    )
    plan = models.CharField(max_length=20, choices=PLANS, default="free")

    # Stripe
    stripe_customer_id = models.CharField(max_length=200, blank=True, default="")
    stripe_subscription_id = models.CharField(max_length=200, blank=True, default="")
    stripe_price_id = models.CharField(max_length=200, blank=True, default="")

    # Billing period
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    # Usage tracking for current period
    generations_used = models.IntegerField(default=0)
    scheduled_posts_used = models.IntegerField(default=0)

    # Status
    status = models.CharField(max_length=50, default="active")  # active, past_due, canceled
    cancel_at_period_end = models.BooleanField(default=False)

    class Meta:
        db_table = "subscriptions"

    def __str__(self):
        return f"{self.workspace.name} - {self.plan}"

    def get_limit(self, limit_type: str) -> int:
        """Get a specific limit for the current plan."""
        return self.LIMITS.get(self.plan, {}).get(limit_type, 0)

    def can_generate(self) -> bool:
        """Check if workspace can generate more content."""
        limit = self.get_limit("generations_per_month")
        if limit == -1:
            return True
        return self.generations_used < limit

    def can_schedule(self) -> bool:
        """Check if workspace can schedule more posts."""
        limit = self.get_limit("scheduled_posts")
        if limit == -1:
            return True
        return self.scheduled_posts_used < limit

    def can_add_brand(self, current_count: int) -> bool:
        """Check if workspace can add another brand."""
        limit = self.get_limit("brands")
        return current_count < limit

    def record_generation(self):
        """Record a generation usage."""
        self.generations_used += 1
        self.save(update_fields=["generations_used", "updated_at"])

    def record_scheduled_post(self):
        """Record a scheduled post."""
        self.scheduled_posts_used += 1
        self.save(update_fields=["scheduled_posts_used", "updated_at"])

    def reset_usage(self):
        """Reset usage counters (called at billing period start)."""
        self.generations_used = 0
        self.scheduled_posts_used = 0
        self.save(update_fields=["generations_used", "scheduled_posts_used", "updated_at"])

    @property
    def generations_remaining(self) -> int:
        """Get remaining generations, -1 if unlimited."""
        limit = self.get_limit("generations_per_month")
        if limit == -1:
            return -1
        return max(0, limit - self.generations_used)


class UsageEvent(BaseModel):
    """
    Individual usage event for analytics and auditing.
    """
    EVENT_TYPES = [
        ("generation", "Content Generation"),
        ("transcription", "Audio Transcription"),
        ("clip_detection", "Clip Detection"),
        ("voice_learning", "Voice Learning"),
        ("publish", "Content Published"),
        ("schedule", "Content Scheduled"),
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="usage_events"
    )
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    units = models.IntegerField(default=1)
    metadata = models.JSONField(default=dict)  # Additional context

    class Meta:
        db_table = "usage_events"
        indexes = [
            models.Index(fields=["workspace", "created_at"]),
            models.Index(fields=["event_type"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} - {self.units} units"
