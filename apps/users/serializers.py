from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from djoser.serializers import UserCreateSerializer, UserSerializer
from rest_framework import serializers

from apps.users.s3_presign import ALLOWED_CONTENT_TYPES, MAX_CONTENT_LENGTH
from apps.users.validators import validate_handle, validate_media_url

# Serializer レベルで URL のスキームを https に限定する validator。
# djoser UserSerializer を継承している都合で model validators が拾われないため、
# extra_kwargs で再注入する (apps/users/models.py の _HTTPS_URL_VALIDATOR と同等)。
_HTTPS_URL_VALIDATOR = URLValidator(schemes=["https"])

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
    """プロフィール表示/更新用 (self view)。

    SPEC §2 に従い username は read_only (= 変更不可) として公開する。
    ``GET /api/v1/users/me/`` および ``PATCH /api/v1/users/me/`` で使用する。
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
        # needs_onboarding もクライアント側からは変更不可 — オンボーディング完了判定は
        # サーバー側 (signal / dedicated endpoint) でのみ更新する (P1-03 review MEDIUM 対応)。
        read_only_fields = [
            "id",
            "email",
            "username",
            "is_premium",
            "needs_onboarding",
            "date_joined",
        ]
        # djoser UserSerializer 継承時 model field の URLValidator(schemes=["https"]) が
        # 自動取り込みされないため、extra_kwargs で各 SNS URL に明示的に再注入する
        # (security-reviewer #131 既知問題の類似パターン対応)。
        # avatar_url / header_url は追加で validate_media_url で許可ドメインに制限する
        # (code-reviewer PR #139 HIGH #2)。
        extra_kwargs = {
            "github_url": {"validators": [_HTTPS_URL_VALIDATOR]},
            "x_url": {"validators": [_HTTPS_URL_VALIDATOR]},
            "zenn_url": {"validators": [_HTTPS_URL_VALIDATOR]},
            "qiita_url": {"validators": [_HTTPS_URL_VALIDATOR]},
            "note_url": {"validators": [_HTTPS_URL_VALIDATOR]},
            "linkedin_url": {"validators": [_HTTPS_URL_VALIDATOR]},
            "avatar_url": {"validators": [_HTTPS_URL_VALIDATOR, validate_media_url]},
            "header_url": {"validators": [_HTTPS_URL_VALIDATOR, validate_media_url]},
        }


class UploadUrlRequestSerializer(serializers.Serializer):
    """avatar / header アップロード URL 発行リクエストの検証用 serializer (P1-04).

    ``POST /api/v1/users/me/avatar-upload-url/`` などで使用。
    - ``content_type`` は WebP / JPEG / PNG のみ許可 (white list)。
    - ``content_length`` は 1 以上 5 MiB 以下。
    choices / min_value / max_value は s3_presign 側の定数から生成し、
    真実の source を 1 箇所に保つ (定数再定義によるドリフトを防止)。
    """

    content_type = serializers.ChoiceField(choices=sorted(ALLOWED_CONTENT_TYPES))
    content_length = serializers.IntegerField(min_value=1, max_value=MAX_CONTENT_LENGTH)


class PublicProfileSerializer(serializers.ModelSerializer):
    """公開プロフィール用 serializer (SPEC §2.2)。

    ``GET /api/v1/users/<handle>/`` で使用。未ログインでも閲覧可能。

    公開する: display_name, bio, avatar_url, header_url, SNS URL 6 種,
              @handle (username), full_name, date_joined
    公開しない: id, email, is_premium, needs_onboarding, first_name, last_name
    (= 内部 flag / PII を漏らさない)
    """

    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            "username",
            "display_name",
            "bio",
            "avatar_url",
            "header_url",
            "github_url",
            "x_url",
            "zenn_url",
            "qiita_url",
            "note_url",
            "linkedin_url",
            "full_name",
            "date_joined",
        ]
        # 公開 API はすべて read_only (PATCH は /me/ 経由のみ)。
        # ``fields`` と同じ list を参照させると、DRF 内部で片方に mutate が走った
        # ときに他方まで壊れる可能性がある。独立コピーを持たせる
        # (P1-03 review HIGH 対応)。
        read_only_fields = list(fields)
