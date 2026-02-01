"""
Core Serializers - User, Workspace, Authentication
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Workspace, WorkspaceMember, GenerationJob

User = get_user_model()


# =============================================================================
# User Serializers
# =============================================================================

class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer."""

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "onboarding_completed", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "password", "password_confirm", "full_name"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords don't match"})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data.get("full_name", ""),
        )

        # Create default workspace
        workspace = Workspace.objects.create(
            name=f"{user.email.split('@')[0]}'s Workspace",
            owner=user,
        )

        # Add owner as member
        WorkspaceMember.objects.create(
            workspace=workspace,
            user=user,
            role="owner",
        )

        return user


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value


# =============================================================================
# Workspace Serializers
# =============================================================================

class WorkspaceSerializer(serializers.ModelSerializer):
    """Workspace serializer."""
    owner_email = serializers.EmailField(source="owner.email", read_only=True)

    class Meta:
        model = Workspace
        fields = ["id", "name", "owner", "owner_email", "created_at", "updated_at"]
        read_only_fields = ["id", "owner", "created_at", "updated_at"]


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Workspace member serializer."""
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ["id", "workspace", "user", "user_email", "user_name", "role", "created_at"]
        read_only_fields = ["id", "created_at"]


# =============================================================================
# Generation Job Serializers
# =============================================================================

class GenerationJobSerializer(serializers.ModelSerializer):
    """Generation job serializer."""

    class Meta:
        model = GenerationJob
        fields = [
            "id", "workspace", "job_type", "status", "progress",
            "result", "error_message", "created_at", "completed_at"
        ]
        read_only_fields = [
            "id", "workspace", "status", "progress", "result",
            "error_message", "created_at", "completed_at"
        ]


class GenerationJobCreateSerializer(serializers.Serializer):
    """Serializer for creating generation jobs."""
    job_type = serializers.ChoiceField(choices=GenerationJob.JOB_TYPES)
    input_data = serializers.JSONField(default=dict)
