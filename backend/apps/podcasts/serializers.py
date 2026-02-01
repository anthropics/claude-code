"""
Podcast Serializers
"""
from rest_framework import serializers
from .models import Show, Episode, EpisodeVersion, PodcastHostConnection


class ShowSerializer(serializers.ModelSerializer):
    episodes_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Show
        fields = [
            "id", "brand", "title", "description", "category",
            "language", "explicit", "artwork_url", "episodes_count",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EpisodeVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EpisodeVersion
        fields = ["id", "episode", "version", "script", "show_notes", "created_by", "created_at"]
        read_only_fields = ["id", "version", "created_by", "created_at"]


class EpisodeSerializer(serializers.ModelSerializer):
    versions = EpisodeVersionSerializer(many=True, read_only=True)

    class Meta:
        model = Episode
        fields = [
            "id", "show", "plan_item", "title", "description", "script",
            "audio_url", "transcript_text", "duration_seconds",
            "episode_number", "season_number", "keywords", "chapters",
            "status", "scheduled_for", "published_at",
            "external_id", "external_url", "versions", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "external_id", "external_url", "published_at",
            "created_at", "updated_at"
        ]


class PodcastHostConnectionSerializer(serializers.ModelSerializer):
    """Serializer that hides API key."""
    api_key = serializers.CharField(write_only=True, required=False)
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = PodcastHostConnection
        fields = [
            "id", "show", "host", "external_show_id", "settings",
            "api_key", "has_api_key", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_has_api_key(self, obj):
        return bool(obj._api_key_encrypted)

    def create(self, validated_data):
        api_key = validated_data.pop("api_key", None)
        instance = super().create(validated_data)
        if api_key:
            instance.api_key = api_key
            instance.save()
        return instance

    def update(self, instance, validated_data):
        api_key = validated_data.pop("api_key", None)
        instance = super().update(instance, validated_data)
        if api_key:
            instance.api_key = api_key
            instance.save()
        return instance


class EpisodeGenerateSerializer(serializers.Serializer):
    """Serializer for episode generation."""
    topic = serializers.CharField(max_length=500)
    angle = serializers.CharField(max_length=500, required=False, default="")
    length_minutes = serializers.IntegerField(min_value=1, max_value=180, default=10)
    title = serializers.CharField(max_length=300, required=False)


class EpisodePublishSerializer(serializers.Serializer):
    """Serializer for episode publishing."""
    host = serializers.ChoiceField(
        choices=[c[0] for c in PodcastHostConnection.HOST_CHOICES],
        default="rss_com"
    )
    publish_at = serializers.DateTimeField(required=False, allow_null=True)
