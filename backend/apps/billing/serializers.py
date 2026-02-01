"""
Billing Serializers
"""
from rest_framework import serializers
from .models import Subscription, UsageEvent


class SubscriptionSerializer(serializers.ModelSerializer):
    generations_remaining = serializers.IntegerField(read_only=True)
    limits = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            "id", "workspace", "plan", "status",
            "current_period_start", "current_period_end",
            "generations_used", "scheduled_posts_used",
            "generations_remaining", "limits",
            "cancel_at_period_end", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "workspace", "stripe_customer_id", "stripe_subscription_id",
            "current_period_start", "current_period_end",
            "generations_used", "scheduled_posts_used",
            "status", "created_at", "updated_at"
        ]

    def get_limits(self, obj):
        return Subscription.LIMITS.get(obj.plan, {})


class UsageEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsageEvent
        fields = ["id", "workspace", "event_type", "units", "metadata", "created_at"]
        read_only_fields = ["id", "created_at"]


class CreateCheckoutSessionSerializer(serializers.Serializer):
    """Serializer for creating Stripe checkout session."""
    plan = serializers.ChoiceField(choices=["creator", "pro", "agency"])
    success_url = serializers.URLField()
    cancel_url = serializers.URLField()


class CreatePortalSessionSerializer(serializers.Serializer):
    """Serializer for creating Stripe customer portal session."""
    return_url = serializers.URLField()
