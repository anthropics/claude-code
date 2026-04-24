"""S3 presigned URL 発行ユーティリティ (P1-04 / Issue #90 / SPEC §2).

方針:
- avatar / header 画像はクライアント → S3 へ直接 PUT でアップロードする。
  サーバーは presigned URL を発行するだけで、画像本体を経由しない
  (帯域・CPU の節約 / スケーラビリティ向上)。
- 許可フォーマットは WebP / JPEG / PNG の 3 種のみ。サイズ上限 5MB。
- object key は ``users/<user_id>/<kind>/<uuid>.<ext>`` とし、衝突/推測を避ける。
- presigned URL は 15 分間のみ有効 (短命にして流出リスクを最小化)。

この module は view から import されるが、boto3 client の生成はテストで mock
しやすいよう関数内で遅延生成する (module レベル singleton は使わない)。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final

import boto3
from botocore.client import Config as BotoConfig
from django.conf import settings
from django.core.exceptions import ValidationError

# -----------------------------------------------------------------------------
# 定数
# -----------------------------------------------------------------------------

#: 許容する MIME type と対応する拡張子。white list 方式で明示 (enum 代用の dict)。
ALLOWED_CONTENT_TYPES: Final[dict[str, str]] = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
}

#: アップロード許可サイズ上限 (5 MiB)。
MAX_CONTENT_LENGTH: Final[int] = 5 * 1024 * 1024

#: presigned URL の有効期間 (秒)。15 分。
PRESIGN_EXPIRES_SECONDS: Final[int] = 15 * 60

#: 許可する ``kind`` (アバター / ヘッダー画像)。
ALLOWED_KINDS: Final[frozenset[str]] = frozenset({"avatar", "header"})


# -----------------------------------------------------------------------------
# 公開 API
# -----------------------------------------------------------------------------


@dataclass(frozen=True)
class PresignedUpload:
    """presigned URL 発行結果 (immutable DTO)."""

    upload_url: str
    object_key: str
    expires_at: datetime
    public_url: str

    def to_dict(self) -> dict[str, str]:
        return {
            "upload_url": self.upload_url,
            "object_key": self.object_key,
            "expires_at": self.expires_at.isoformat(),
            "public_url": self.public_url,
        }


def validate_upload_request(content_type: str, content_length: int) -> None:
    """アップロード要求の content_type / content_length を検証する.

    serializer 側でも同等の検証を行うが、s3_presign 側でも防御的にチェックして
    view 以外の経路 (例: management command や内部サービス) から呼ばれた場合にも
    整合した挙動にする (fail-fast)。

    Raises:
        ValidationError: content_type が許可リストに無い、または content_length が
            範囲外 (≤0 or > 5MB) の場合。
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            f"Unsupported content_type: {content_type!r}. "
            f"Allowed: {sorted(ALLOWED_CONTENT_TYPES)}"
        )
    if content_length <= 0:
        raise ValidationError("content_length must be positive")
    if content_length > MAX_CONTENT_LENGTH:
        raise ValidationError(
            f"content_length {content_length} exceeds maximum {MAX_CONTENT_LENGTH} bytes"
        )


def generate_presigned_upload_url(
    user_id: int,
    kind: str,
    content_type: str,
    content_length: int,
) -> PresignedUpload:
    """avatar / header 画像向け S3 presigned PUT URL を発行する.

    Args:
        user_id: アップロードするユーザーの PK。object key に埋め込む。
        kind: ``"avatar"`` または ``"header"``。それ以外は ValidationError。
        content_type: アップロード予定の MIME type。許可リストの範囲。
        content_length: アップロード予定サイズ (bytes)。1 以上 5MB 以下。

    Returns:
        :class:`PresignedUpload` DTO。view で ``.to_dict()`` してレスポンスに載せる。

    Raises:
        ValidationError: kind / content_type / content_length が不正の場合。
    """
    if kind not in ALLOWED_KINDS:
        raise ValidationError(f"Unsupported kind: {kind!r}. Allowed: {sorted(ALLOWED_KINDS)}")
    validate_upload_request(content_type, content_length)

    ext = ALLOWED_CONTENT_TYPES[content_type]
    object_key = f"users/{user_id}/{kind}/{uuid.uuid4()}.{ext}"
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    region = settings.AWS_S3_REGION_NAME

    # boto3 client は関数内で生成 (module singleton にしない)。
    # - テストで `patch("apps.users.s3_presign.boto3.client", ...)` しやすい。
    # - リクエストごとに環境 credentials を拾い直すことで rotate 耐性がある。
    s3_client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        config=BotoConfig(
            signature_version=getattr(settings, "AWS_S3_SIGNATURE_VERSION", "s3v4"),
            s3={"addressing_style": getattr(settings, "AWS_S3_ADDRESSING_STYLE", "virtual")},
        ),
    )

    upload_url = s3_client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket,
            "Key": object_key,
            "ContentType": content_type,
            "ContentLength": content_length,
        },
        ExpiresIn=PRESIGN_EXPIRES_SECONDS,
        HttpMethod="PUT",
    )

    expires_at = datetime.now(tz=UTC) + timedelta(seconds=PRESIGN_EXPIRES_SECONDS)
    public_url = _build_public_url(bucket=bucket, object_key=object_key)

    return PresignedUpload(
        upload_url=upload_url,
        object_key=object_key,
        expires_at=expires_at,
        public_url=public_url,
    )


# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------


def _build_public_url(*, bucket: str, object_key: str) -> str:
    """``AWS_S3_CUSTOM_DOMAIN`` (CloudFront 等) があれば優先、無ければ S3 virtual host 形式.

    - ``custom_domain`` 例: ``cdn.example.com``
      → ``https://cdn.example.com/<key>``
    - 無指定の場合:
      → ``https://<bucket>.s3.<region>.amazonaws.com/<key>``
    """
    custom_domain = getattr(settings, "AWS_S3_CUSTOM_DOMAIN", "") or ""
    if custom_domain:
        return f"https://{custom_domain}/{object_key}"
    region = settings.AWS_S3_REGION_NAME
    return f"https://{bucket}.s3.{region}.amazonaws.com/{object_key}"
