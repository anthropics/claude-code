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
