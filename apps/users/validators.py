"""
@handle (= Django username) 用のバリデーター。

SPEC §2 の要件:
- 英数 + アンダースコア (`_`) のみ
- 3〜30 字
- ユニーク (DB 層で enforce)
- 予約語を排除

本モジュールは validate_handle 関数と予約語リスト RESERVED_HANDLES を公開する。
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# @handle の正規表現: 英数と "_" のみ、3〜30 字。
HANDLE_REGEX = re.compile(r"^[a-zA-Z0-9_]{3,30}$")

# 予約語ブラックリスト。
# システム上の予約 URL や利用者に誤解を招く恐れのある名前を拒否する。
# 大文字小文字は区別せず比較する。
RESERVED_HANDLES: frozenset[str] = frozenset(
    {
        # --- 基本的な予約語 ---
        "admin",
        "api",
        "me",
        "null",
        "undefined",
        "root",
        "system",
        "official",
        "support",
        "help",
        "about",
        "terms",
        "privacy",
        "settings",
        "login",
        "logout",
        "register",
        "signup",
        "signin",
        "user",
        "users",
        "tweet",
        "tweets",
        "tag",
        "tags",
        "home",
        "explore",
        "search",
        # --- security-reviewer HIGH: インフラ/認証 系の誤配線を防ぐため追加 ---
        # Webhook / 決済 / 認証コールバックの URL と衝突する handle を予約。
        "webhook",
        "webhooks",
        "stripe",
        "auth",
        "callback",
        "oauth",
        # --- SNS 標準パスと衝突しがちなもの ---
        "profile",
        "following",
        "followers",
        "notification",
        "notifications",
        "feed",
        "timeline",
        "status",
        # --- 運用系 ---
        "health",
    }
)


def validate_handle(value: str) -> None:
    """@handle (username) の形式と予約語をチェックする。

    Args:
        value: 検証対象の handle 文字列。

    Raises:
        ValidationError: 形式違反 or 予約語のとき。
    """
    if not isinstance(value, str):
        raise ValidationError(
            _("Handle must be a string."),
            code="invalid_handle_type",
        )

    if not HANDLE_REGEX.match(value):
        raise ValidationError(
            _(
                "Handle must be 3-30 characters and contain only letters, "
                "numbers and underscores."
            ),
            code="invalid_handle_format",
        )

    if value.lower() in RESERVED_HANDLES:
        raise ValidationError(
            _("This handle is reserved and cannot be used."),
            code="reserved_handle",
        )


def validate_media_url(value: str) -> None:
    """avatar_url / header_url を許可ドメインの https URL のみに制限する.

    code-reviewer (PR #139 HIGH #2) 指摘:
      ``PATCH /api/v1/users/me/`` で ``avatar_url`` / ``header_url`` を任意の
      外部ドメインに書き換えられると、他サイトの tracking pixel をアバターに
      設定して閲覧者の IP を収集したり、phishing 用に偽サイト画像を埋め込んだり
      できてしまう。許可ドメイン (CloudFront カスタムドメイン / S3 virtual host)
      以外を reject することで、メディア URL は必ず自分たちが管理する bucket
      配下に落ちることを enforce する。

    Args:
        value: 検証対象の URL 文字列。空文字は許容する (アバター未設定状態)。

    Raises:
        ValidationError: scheme が https でない、またはホストが
            ``settings.ALLOWED_MEDIA_DOMAINS`` に含まれない場合。
    """
    if not value:
        # 空文字はアバター未設定を表すので許容する (blank=True と整合)。
        return

    parsed = urlparse(value)
    if parsed.scheme != "https":
        raise ValidationError(
            _("Media URL must use https scheme."),
            code="invalid_media_scheme",
        )

    allowed = getattr(settings, "ALLOWED_MEDIA_DOMAINS", None) or []
    if allowed and parsed.netloc not in allowed:
        raise ValidationError(
            _("Media URL host '%(host)s' is not allowed.") % {"host": parsed.netloc},
            code="invalid_media_host",
        )
