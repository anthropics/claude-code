"""
Content Serializers
"""
from rest_framework import serializers
from .models import (
    Brand, VoiceFingerprint, SourceSample, Transcript, Clip,
    ContentPlan, PlanItem, Draft, DraftVersion
)


class VoiceFingerprintSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceFingerprint
        fields = [
            "id", "brand", "sample_phrases", "vocabulary_level", "humor_style",
            "opening_patterns", "closing_patterns", "banned_phrases",
            "samples_analyzed", "last_learned_at", "updated_at"
        ]
        read_only_fields = ["id", "samples_analyzed", "last_learned_at", "updated_at"]


class BrandSerializer(serializers.ModelSerializer):
    voice = VoiceFingerprintSerializer(read_only=True)

    class Meta:
        model = Brand
        fields = [
            "id", "workspace", "name", "niche", "target_audience",
            "primary_goal", "voice", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BrandCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["name", "niche", "target_audience", "primary_goal"]


class SourceSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceSample
        fields = [
            "id", "brand", "source_type", "title", "raw_text",
            "word_count", "analyzed", "created_at"
        ]
        read_only_fields = ["id", "word_count", "analyzed", "created_at"]


class SourceSampleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceSample
        fields = ["brand", "source_type", "title", "raw_text"]


class TranscriptSerializer(serializers.ModelSerializer):
    clips_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Transcript
        fields = [
            "id", "brand", "title", "source_type", "source_url",
            "raw_text", "segments_json", "duration_seconds", "word_count",
            "language", "status", "error_message", "clips_count", "created_at"
        ]
        read_only_fields = [
            "id", "segments_json", "duration_seconds", "word_count",
            "language", "status", "error_message", "created_at"
        ]


class TranscriptCreateSerializer(serializers.Serializer):
    """Serializer for creating transcripts."""
    brand_id = serializers.UUIDField()
    title = serializers.CharField(max_length=300, required=False, default="")
    source_type = serializers.ChoiceField(choices=Transcript.SOURCE_TYPES)

    # For paste source
    raw_text = serializers.CharField(required=False, allow_blank=True)

    # For upload source
    audio_url = serializers.URLField(required=False, allow_blank=True)

    def validate(self, attrs):
        source_type = attrs.get("source_type")
        if source_type == "paste" and not attrs.get("raw_text"):
            raise serializers.ValidationError({"raw_text": "Required for paste source type"})
        if source_type == "upload" and not attrs.get("audio_url"):
            raise serializers.ValidationError({"audio_url": "Required for upload source type"})
        return attrs


class ClipSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.FloatField(read_only=True)

    class Meta:
        model = Clip
        fields = [
            "id", "transcript", "start_time", "end_time", "text",
            "word_count", "hook_score", "viral_score", "topic_tags",
            "suggested_caption", "status", "duration_seconds", "created_at"
        ]
        read_only_fields = [
            "id", "start_time", "end_time", "text", "word_count",
            "hook_score", "viral_score", "topic_tags", "suggested_caption",
            "duration_seconds", "created_at"
        ]


class ContentPlanSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ContentPlan
        fields = [
            "id", "brand", "week_start", "status", "plan_metadata",
            "items_count", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "plan_metadata", "created_at", "updated_at"]


class PlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItem
        fields = [
            "id", "content_plan", "day_of_week", "slot", "scheduled_time",
            "platform", "topic", "angle", "intent", "source_clip",
            "source_transcript", "status", "created_at"
        ]
        read_only_fields = ["id", "created_at"]


class DraftVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DraftVersion
        fields = [
            "id", "draft", "version", "content", "metadata",
            "created_by", "regen_feedback", "created_at"
        ]
        read_only_fields = ["id", "version", "metadata", "created_by", "created_at"]


class DraftSerializer(serializers.ModelSerializer):
    current_content = serializers.SerializerMethodField()
    versions = DraftVersionSerializer(many=True, read_only=True)

    class Meta:
        model = Draft
        fields = [
            "id", "plan_item", "platform", "current_version",
            "quality_score", "quality_flags", "status",
            "current_content", "versions", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "current_version", "quality_score", "quality_flags",
            "created_at", "updated_at"
        ]

    def get_current_content(self, obj):
        """Get the content of the current version."""
        version = obj.versions.filter(version=obj.current_version).first()
        return version.content if version else None


class DraftEditSerializer(serializers.Serializer):
    """Serializer for editing a draft (creating new version)."""
    content = serializers.CharField()


class DraftRegenSerializer(serializers.Serializer):
    """Serializer for regenerating a draft with feedback."""
    feedback = serializers.CharField(max_length=1000)


class GeneratePlanSerializer(serializers.Serializer):
    """Serializer for generating a content plan."""
    week_start = serializers.DateField()
    platforms = serializers.ListField(
        child=serializers.ChoiceField(choices=[c[0] for c in PlanItem.PLATFORM_CHOICES]),
        min_length=1,
    )
    posts_per_day = serializers.IntegerField(min_value=1, max_value=10, default=2)


class GenerateDraftSerializer(serializers.Serializer):
    """Serializer for generating a draft."""
    platform = serializers.ChoiceField(
        choices=[c[0] for c in PlanItem.PLATFORM_CHOICES],
        required=False
    )
