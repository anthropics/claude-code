"""
Publishing Serializers
"""
from rest_framework import serializers
from .models import PlatformConnection, Publish


class PlatformConnectionSerializer(serializers.ModelSerializer):
    """Platform connection serializer - hides tokens."""
    access_token = serializers.CharField(write_only=True, required=False)
    refresh_token = serializers.CharField(write_only=True, required=False)
    is_connected = serializers.SerializerMethodField()

    class Meta:
        model = PlatformConnection
        fields = [
            "id", "brand", "platform", "account_id", "account_handle",
            "account_name", "expires_at", "scopes", "is_active",
            "last_used_at", "error_message", "access_token", "refresh_token",
            "is_connected", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "expires_at", "last_used_at", "error_message",
            "created_at", "updated_at"
        ]

    def get_is_connected(self, obj):
        return bool(obj._access_token_encrypted) and obj.is_active

    def create(self, validated_data):
        access_token = validated_data.pop("access_token", None)
        refresh_token = validated_data.pop("refresh_token", None)
        instance = super().create(validated_data)
        if access_token:
            instance.access_token = access_token
        if refresh_token:
            instance.refresh_token = refresh_token
        instance.save()
        return instance

    def update(self, instance, validated_data):
        access_token = validated_data.pop("access_token", None)
        refresh_token = validated_data.pop("refresh_token", None)
        instance = super().update(instance, validated_data)
        if access_token:
            instance.access_token = access_token
        if refresh_token:
            instance.refresh_token = refresh_token
        instance.save()
        return instance


class PublishSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publish
        fields = [
            "id", "workspace", "platform", "content_type", "draft",
            "source_id", "payload", "scheduled_for", "published_at",
            "status", "attempts", "platform_post_id", "platform_url",
            "last_error", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "workspace", "published_at", "attempts",
            "platform_post_id", "platform_url", "last_error",
            "created_at", "updated_at"
        ]
