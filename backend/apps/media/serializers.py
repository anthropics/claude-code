"""
Media Serializers
"""
from rest_framework import serializers
from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id", "workspace", "kind", "filename", "storage_url",
            "content_type", "file_size_bytes", "duration_seconds",
            "width", "height", "metadata", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PresignedUploadSerializer(serializers.Serializer):
    """Serializer for presigned upload request."""
    filename = serializers.CharField(max_length=500)
    content_type = serializers.CharField(max_length=100)
