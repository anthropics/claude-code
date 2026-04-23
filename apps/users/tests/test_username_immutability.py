"""
pre_save signal による username 不変性のテスト。

ケース:
1. 既存 user の username を save() で変更 -> ValidationError
2. update_fields=["username"] で save() -> ValidationError
3. QuerySet.update(username=...) は signal をバイパスして成功する
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.integration
class TestUsernameImmutability:
    def test_save_rejects_username_change(self, user_factory) -> None:
        # Arrange
        user = user_factory(username="alice_01")

        # Act: username を書き換えて save
        user.username = "alice_02"

        # Assert
        with pytest.raises(ValidationError) as exc:
            user.save()
        # エラーメッセージが username フィールド由来であること。
        assert "username" in exc.value.message_dict

    def test_save_with_update_fields_username_rejected(self, user_factory) -> None:
        # Arrange
        user = user_factory(username="bob_001")
        # _original_username が snapshot されていることを前提に、
        # update_fields に "username" を明示した場合も拒否されることを確認。
        user.username = "bob_002"

        # Act + Assert
        with pytest.raises(ValidationError):
            user.save(update_fields=["username"])

    def test_queryset_update_bypasses_signal(self, user_factory) -> None:
        # Arrange
        user = user_factory(username="carol_01")

        # Act: queryset.update は pre_save を発火しないのでバイパス可能。
        User.objects.filter(pk=user.pk).update(username="carol_renamed")

        # Assert
        user.refresh_from_db()
        assert user.username == "carol_renamed"

    def test_save_without_username_change_succeeds(self, user_factory) -> None:
        # Arrange: username を変えずに他のフィールドを変更しての save は成功すること。
        user = user_factory(username="dave_001", first_name="Dave")
        user.first_name = "David"

        # Act + Assert: 例外なく save が通ること。
        user.save()
        user.refresh_from_db()
        assert user.first_name == "David"
        assert user.username == "dave_001"
