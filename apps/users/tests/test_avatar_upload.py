"""
avatar / header 画像 S3 presigned URL 発行 API (P1-04 / Issue #90) のテスト.

対象エンドポイント:
- POST /api/v1/users/me/avatar-upload-url/
- POST /api/v1/users/me/header-upload-url/

方針:
- boto3 は ``unittest.mock.patch`` で置き換える (追加依存なし)。
- ``force_authenticate`` で JWT/Cookie を経由せず直接 request.user を注入する
  (認証/CSRF 自体は P1-12a 側で別テスト済み)。
- AAA (Arrange-Act-Assert) パターン。
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.s3_presign import (
    ALLOWED_CONTENT_TYPES,
    MAX_CONTENT_LENGTH,
    PRESIGN_EXPIRES_SECONDS,
)

# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------


@pytest.fixture
def avatar_url() -> str:
    return reverse("users-me-avatar-upload-url")


@pytest.fixture
def header_url() -> str:
    return reverse("users-me-header-upload-url")


@pytest.fixture
def mock_boto3_client():
    """boto3.client を mock 化し、返却される presigned URL を固定する.

    s3_presign.py は ``boto3.client("s3", ...)`` を呼んで
    ``generate_presigned_url(...)`` を叩く。その両方を MagicMock で差し替える。
    """
    fake_client = MagicMock()
    fake_client.generate_presigned_url.return_value = (
        "https://s3.example.com/test-bucket/users/1/avatar/abc.webp?X-Amz-Signature=dummy"
    )
    with patch("apps.users.s3_presign.boto3.client", return_value=fake_client) as m:
        yield m, fake_client


def _valid_body(content_type: str = "image/webp", content_length: int = 1024) -> dict:
    """テスト用の正常 body を生成するヘルパー."""
    return {"content_type": content_type, "content_length": content_length}


# =============================================================================
# 認証
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestAuth:
    def test_requires_auth(
        self,
        api_client: APIClient,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange: 匿名クライアント。
        # Act
        res = api_client.post(avatar_url, data=_valid_body(), format="json")

        # Assert: 認証必須なので 401 / 403。DRF は authenticators に
        # ``authenticate_header()`` を持つクラスが含まれていれば 401、そうでなければ
        # 403 を返す。本 view は CSRFEnforcingAuthentication (header 無し) が
        # 先頭にあるため 403 になる。LogoutView と同じ運用。
        # いずれにせよ未認証は確実に拒否され、boto3 は呼ばれない。
        assert res.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
        _, fake_client = mock_boto3_client
        fake_client.generate_presigned_url.assert_not_called()

    def test_header_requires_auth(
        self,
        api_client: APIClient,
        header_url: str,
        mock_boto3_client,
    ) -> None:
        # Act
        res = api_client.post(header_url, data=_valid_body(), format="json")
        # Assert: 401 / 403 どちらも未認証拒否として許容 (test_requires_auth と同じ理由)。
        assert res.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


# =============================================================================
# 正常系 (avatar)
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestAvatarUploadUrl:
    def test_valid_request_returns_presigned_url(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange
        user = user_factory(username="uploader_01")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(avatar_url, data=_valid_body(), format="json")

        # Assert: 200 + 必要なキーが全部返る。
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert set(data.keys()) == {"upload_url", "object_key", "expires_at", "public_url"}
        assert data["upload_url"].startswith("https://")
        assert data["public_url"].startswith("https://")
        assert "expires_at" in data

    def test_object_key_contains_user_id_and_kind(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange
        user = user_factory(username="keyuser_01")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(avatar_url, data=_valid_body(), format="json")

        # Assert: object_key は ``users/<user_id>/avatar/<uuid>.<ext>`` 形式。
        assert res.status_code == status.HTTP_200_OK
        object_key = res.json()["object_key"]
        assert object_key.startswith(f"users/{user.pk}/avatar/")
        assert object_key.endswith(".webp")

    def test_webp_uses_webp_extension(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        user = user_factory(username="ext_webp")
        api_client.force_authenticate(user=user)
        res = api_client.post(
            avatar_url, data=_valid_body(content_type="image/webp"), format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["object_key"].endswith(".webp")

    def test_jpeg_uses_jpg_extension(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        user = user_factory(username="ext_jpeg")
        api_client.force_authenticate(user=user)
        res = api_client.post(
            avatar_url, data=_valid_body(content_type="image/jpeg"), format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["object_key"].endswith(".jpg")

    def test_png_uses_png_extension(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        user = user_factory(username="ext_png")
        api_client.force_authenticate(user=user)
        res = api_client.post(avatar_url, data=_valid_body(content_type="image/png"), format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["object_key"].endswith(".png")


# =============================================================================
# バリデーション
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestValidation:
    def test_invalid_content_type_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange: GIF は非対応。
        user = user_factory(username="bad_ct")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(
            avatar_url,
            data=_valid_body(content_type="image/gif"),
            format="json",
        )

        # Assert: 400 with content_type error。
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "content_type" in res.json()

    def test_too_large_content_length_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange: 5MB + 1 バイト。
        user = user_factory(username="too_big")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(
            avatar_url,
            data=_valid_body(content_length=MAX_CONTENT_LENGTH + 1),
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "content_length" in res.json()

    def test_zero_content_length_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange
        user = user_factory(username="zero_len")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(
            avatar_url,
            data=_valid_body(content_length=0),
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "content_length" in res.json()

    def test_negative_content_length_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        user = user_factory(username="neg_len")
        api_client.force_authenticate(user=user)
        res = api_client.post(
            avatar_url,
            data=_valid_body(content_length=-1),
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "content_length" in res.json()

    def test_missing_content_type_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        user = user_factory(username="miss_ct")
        api_client.force_authenticate(user=user)
        res = api_client.post(
            avatar_url,
            data={"content_length": 1024},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "content_type" in res.json()

    def test_missing_content_length_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
    ) -> None:
        user = user_factory(username="miss_len")
        api_client.force_authenticate(user=user)
        res = api_client.post(
            avatar_url,
            data={"content_type": "image/webp"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "content_length" in res.json()


# =============================================================================
# header エンドポイント
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestHeaderUploadUrl:
    def test_header_endpoint_uses_header_kind(
        self,
        api_client: APIClient,
        user_factory,
        header_url: str,
        mock_boto3_client,
    ) -> None:
        # Arrange
        user = user_factory(username="header_user")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(header_url, data=_valid_body(), format="json")

        # Assert: object_key に `/header/` が含まれる。
        assert res.status_code == status.HTTP_200_OK
        object_key = res.json()["object_key"]
        assert f"users/{user.pk}/header/" in object_key
        assert "/avatar/" not in object_key


# =============================================================================
# boto3 呼び出し内容の検証
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestBoto3Integration:
    def test_boto3_s3_client_called_with_correct_params(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
        settings,
    ) -> None:
        # Arrange: test でも bucket が埋まっているように上書き。
        settings.AWS_STORAGE_BUCKET_NAME = "test-bucket"
        settings.AWS_S3_REGION_NAME = "ap-northeast-1"
        user = user_factory(username="boto_params")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(avatar_url, data=_valid_body(content_length=2048), format="json")

        # Assert
        assert res.status_code == status.HTTP_200_OK
        _, fake_client = mock_boto3_client
        fake_client.generate_presigned_url.assert_called_once()
        call_kwargs = fake_client.generate_presigned_url.call_args.kwargs
        assert call_kwargs["ClientMethod"] == "put_object"
        assert call_kwargs["HttpMethod"] == "PUT"
        assert call_kwargs["ExpiresIn"] == PRESIGN_EXPIRES_SECONDS
        params = call_kwargs["Params"]
        assert params["Bucket"] == "test-bucket"
        assert params["ContentType"] == "image/webp"
        assert params["ContentLength"] == 2048
        assert params["Key"].startswith(f"users/{user.pk}/avatar/")

    def test_public_url_uses_custom_domain_when_set(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
        settings,
    ) -> None:
        # Arrange: CloudFront 想定で custom domain を設定。
        settings.AWS_S3_CUSTOM_DOMAIN = "cdn.example.com"
        settings.AWS_STORAGE_BUCKET_NAME = "test-bucket"
        user = user_factory(username="cdn_user")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(avatar_url, data=_valid_body(), format="json")

        # Assert
        assert res.status_code == status.HTTP_200_OK
        public_url = res.json()["public_url"]
        assert public_url.startswith("https://cdn.example.com/")
        assert f"users/{user.pk}/avatar/" in public_url

    def test_public_url_falls_back_to_virtual_host_when_no_custom_domain(
        self,
        api_client: APIClient,
        user_factory,
        avatar_url: str,
        mock_boto3_client,
        settings,
    ) -> None:
        # Arrange: CloudFront 無しの直叩き想定。
        settings.AWS_S3_CUSTOM_DOMAIN = ""
        settings.AWS_STORAGE_BUCKET_NAME = "raw-bucket"
        settings.AWS_S3_REGION_NAME = "ap-northeast-1"
        user = user_factory(username="raw_user")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(avatar_url, data=_valid_body(), format="json")

        # Assert: https://<bucket>.s3.<region>.amazonaws.com/<key>
        assert res.status_code == status.HTTP_200_OK
        public_url = res.json()["public_url"]
        assert public_url.startswith("https://raw-bucket.s3.ap-northeast-1.amazonaws.com/")


# =============================================================================
# ユニットテスト (s3_presign 関数直接)
# =============================================================================


@pytest.mark.unit
class TestValidateUploadRequest:
    """``validate_upload_request`` の単体テスト (import せずに Django ORM を触らない)."""

    def test_accepts_all_allowed_content_types(self) -> None:
        from apps.users.s3_presign import validate_upload_request

        for ct in ALLOWED_CONTENT_TYPES:
            validate_upload_request(ct, 1024)  # should not raise

    def test_rejects_gif(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.users.s3_presign import validate_upload_request

        with pytest.raises(ValidationError):
            validate_upload_request("image/gif", 1024)

    def test_rejects_svg(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.users.s3_presign import validate_upload_request

        with pytest.raises(ValidationError):
            validate_upload_request("image/svg+xml", 1024)

    def test_rejects_oversized(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.users.s3_presign import validate_upload_request

        with pytest.raises(ValidationError):
            validate_upload_request("image/png", MAX_CONTENT_LENGTH + 1)

    def test_accepts_boundary_max_size(self) -> None:
        from apps.users.s3_presign import validate_upload_request

        validate_upload_request("image/png", MAX_CONTENT_LENGTH)  # should not raise

    def test_rejects_zero(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.users.s3_presign import validate_upload_request

        with pytest.raises(ValidationError):
            validate_upload_request("image/png", 0)


@pytest.mark.unit
class TestGeneratePresignedUploadUrl:
    """``generate_presigned_upload_url`` の unit test (boto3 は patch)."""

    def test_rejects_unknown_kind(self, mock_boto3_client) -> None:
        from django.core.exceptions import ValidationError

        from apps.users.s3_presign import generate_presigned_upload_url

        with pytest.raises(ValidationError):
            generate_presigned_upload_url(
                user_id=1,
                kind="background",  # 未対応
                content_type="image/png",
                content_length=1024,
            )
