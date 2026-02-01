"""
Media Views
Handles file uploads to S3/R2 via presigned URLs
"""
import uuid
import logging
from datetime import timedelta

import boto3
from botocore.config import Config
from django.conf import settings
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.core.models import Workspace
from apps.core.permissions import IsWorkspaceMember
from .models import Asset
from .serializers import AssetSerializer, PresignedUploadSerializer

logger = logging.getLogger(__name__)

# Allowed file types for uploads
ALLOWED_CONTENT_TYPES = {
    # Audio
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    # Video
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    # Images
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def get_s3_client():
    """Get boto3 S3 client configured for S3 or R2."""
    config = Config(
        signature_version='s3v4',
        s3={'addressing_style': 'path'}
    )

    client_kwargs = {
        'aws_access_key_id': getattr(settings, 'AWS_ACCESS_KEY_ID', None),
        'aws_secret_access_key': getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
        'region_name': getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1'),
        'config': config,
    }

    # Support for R2 or custom S3-compatible endpoints
    endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
    if endpoint_url:
        client_kwargs['endpoint_url'] = endpoint_url

    return boto3.client('s3', **client_kwargs)


def generate_presigned_url(filename: str, content_type: str, user_id: str) -> dict:
    """
    Generate a presigned URL for direct upload to S3/R2.

    Returns:
        dict with upload_url, file_url, and optional fields for POST uploads
    """
    bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
    if not bucket:
        raise ValueError("AWS_STORAGE_BUCKET_NAME not configured")

    # Generate unique key with user prefix for organization
    ext = ALLOWED_CONTENT_TYPES.get(content_type, '')
    unique_id = uuid.uuid4().hex[:16]
    key = f"uploads/{user_id}/{unique_id}{ext}"

    client = get_s3_client()

    # Generate presigned PUT URL (simpler for frontend)
    presigned_url = client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': bucket,
            'Key': key,
            'ContentType': content_type,
        },
        ExpiresIn=3600,  # 1 hour
    )

    # Construct the public file URL
    endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
    if endpoint_url:
        # R2 or custom endpoint - construct URL
        file_url = f"{endpoint_url}/{bucket}/{key}"
    else:
        # Standard S3
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
        if region == 'us-east-1':
            file_url = f"https://{bucket}.s3.amazonaws.com/{key}"
        else:
            file_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"

    return {
        'upload_url': presigned_url,
        'file_url': file_url,
        'key': key,
    }


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def presigned_upload(request):
    """
    Generate a presigned URL for direct S3/R2 upload.

    Request body:
    {
        "filename": "episode.mp3",
        "content_type": "audio/mpeg"
    }

    Response:
    {
        "upload_url": "https://...",  // PUT this URL with file
        "file_url": "https://...",    // Final URL after upload
    }
    """
    serializer = PresignedUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    filename = serializer.validated_data['filename']
    content_type = serializer.validated_data['content_type']

    # Validate content type
    if content_type not in ALLOWED_CONTENT_TYPES:
        return Response(
            {'error': f'Content type {content_type} not allowed. Allowed types: {list(ALLOWED_CONTENT_TYPES.keys())}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if S3 is configured
    if not getattr(settings, 'USE_S3', False):
        return Response(
            {'error': 'File uploads not configured. Please contact support.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    try:
        result = generate_presigned_url(
            filename=filename,
            content_type=content_type,
            user_id=str(request.user.id),
        )

        logger.info(f"Generated presigned URL for user {request.user.id}: {filename}")

        return Response({
            'upload_url': result['upload_url'],
            'file_url': result['file_url'],
        })

    except ValueError as e:
        logger.error(f"Presigned URL config error: {e}")
        return Response(
            {'error': 'File storage not configured properly.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.exception(f"Presigned URL generation failed: {e}")
        return Response(
            {'error': 'Failed to generate upload URL. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class AssetViewSet(viewsets.ModelViewSet):
    """Asset management."""
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        user_workspaces = Workspace.objects.filter(
            memberships__user=self.request.user
        )
        return Asset.objects.filter(workspace__in=user_workspaces)

    def perform_create(self, serializer):
        workspace = Workspace.objects.filter(
            memberships__user=self.request.user
        ).first()
        serializer.save(workspace=workspace)
