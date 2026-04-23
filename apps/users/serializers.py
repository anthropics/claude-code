from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from djoser.serializers import UserCreateSerializer, UserSerializer
from rest_framework import serializers

from apps.users.validators import validate_handle

User = get_user_model()


class CreateUserSerializer(UserCreateSerializer):
    class Meta(UserCreateSerializer.Meta):
        model = User
        fields = ["id", "email", "username", "first_name", "last_name", "password"]

    def validate_username(self, value: str) -> str:
        """signup 時に @handle 形式・予約語チェックを行う。"""
        try:
            validate_handle(value)
        except DjangoValidationError as err:
            raise serializers.ValidationError(err.messages[0]) from err
        return value


class CustomUserSerializer(UserSerializer):
    """プロフィール表示/更新用。

    SPEC §2 に従い username は read_only (= 変更不可) として公開する。
    """

    full_name = serializers.ReadOnlyField()

    class Meta(UserSerializer.Meta):
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "display_name",
            "bio",
            "avatar_url",
            "header_url",
            "is_premium",
            "needs_onboarding",
            "github_url",
            "x_url",
            "zenn_url",
            "qiita_url",
            "note_url",
            "linkedin_url",
            "date_joined",
        ]
        # username / email / is_premium は変更不可 (is_premium は Stripe webhook でのみ更新)。
        read_only_fields = [
            "id",
            "email",
            "username",
            "is_premium",
            "date_joined",
        ]
