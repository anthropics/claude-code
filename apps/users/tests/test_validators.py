"""validate_handle のユニットテスト。

P1-02a 要件のカバレッジ:
- 有効な handle が通ること
- 予約語が reject されること
- 短すぎる handle が reject されること
- 長すぎる handle が reject されること
- 記号を含む handle が reject されること
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.users.validators import RESERVED_HANDLES, validate_handle


@pytest.mark.unit
class TestValidateHandle:
    def test_accepts_valid_handle(self) -> None:
        # Arrange
        value = "taro_123"

        # Act + Assert: 例外なく通ること
        validate_handle(value)

    # "me" は 2 文字で format check (≥3 字) に先に弾かれるため除外し、3 字以上の予約語を使う。
    @pytest.mark.parametrize("reserved", ["admin", "API", "api", "support", "users"])
    def test_rejects_reserved_handles(self, reserved: str) -> None:
        # 大文字小文字を問わず拒否されること。
        with pytest.raises(ValidationError) as exc:
            validate_handle(reserved)
        assert exc.value.code == "reserved_handle"

    def test_rejects_too_short(self) -> None:
        # Arrange: 2 文字 (最小 3 に満たない)
        with pytest.raises(ValidationError) as exc:
            validate_handle("ab")
        assert exc.value.code == "invalid_handle_format"

    def test_rejects_too_long(self) -> None:
        # Arrange: 31 文字 (最大 30 を超える)
        with pytest.raises(ValidationError) as exc:
            validate_handle("a" * 31)
        assert exc.value.code == "invalid_handle_format"

    @pytest.mark.parametrize("bad", ["taro-yamada", "taro.yamada", "taro yamada", "taro!"])
    def test_rejects_symbols(self, bad: str) -> None:
        # ハイフン・ドット・空白・記号は許可されていない。
        with pytest.raises(ValidationError) as exc:
            validate_handle(bad)
        assert exc.value.code == "invalid_handle_format"

    def test_reserved_handles_is_frozenset(self) -> None:
        # 予約語リストは immutable として公開されていること。
        assert isinstance(RESERVED_HANDLES, frozenset)
        assert "admin" in RESERVED_HANDLES
