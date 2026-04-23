"""
forms.py の clean_* メソッドに対するユニット/インテグレーションテスト。

python-reviewer HIGH で指摘された Forms 層のテスト欠如をカバーする。

ケース:
- ``UserCreationForm.clean_username`` が予約語 (RESERVED_HANDLES) を reject する
- ``UserCreationForm.clean_username`` が @handle 形式違反を reject する
- ``UserCreationForm.clean_username`` が duplicate username を reject する
- ``UserCreationForm.clean_email`` が duplicate email を reject する
- ``UserChangeForm.Meta.fields`` に username が含まれず編集不可なこと
"""

from __future__ import annotations

import pytest

from apps.users.forms import UserChangeForm, UserCreationForm


@pytest.mark.django_db
@pytest.mark.integration
class TestUserCreationFormCleanUsername:
    def test_rejects_reserved_handle(self) -> None:
        # Arrange: "admin" は RESERVED_HANDLES に含まれる。
        form = UserCreationForm(
            data={
                "first_name": "Taro",
                "last_name": "Yamada",
                "username": "admin",
                "email": "taro@example.com",
                "password1": "VeryStrongPass9!",  # pragma: allowlist secret
                "password2": "VeryStrongPass9!",  # pragma: allowlist secret
            }
        )

        # Act + Assert: 予約語なので form invalid。
        assert not form.is_valid()
        assert "username" in form.errors

    def test_rejects_invalid_handle_format(self) -> None:
        # ハイフン入り handle は HANDLE_REGEX で拒否される。
        form = UserCreationForm(
            data={
                "first_name": "Taro",
                "last_name": "Yamada",
                "username": "taro-yamada",
                "email": "taro2@example.com",
                "password1": "VeryStrongPass9!",  # pragma: allowlist secret
                "password2": "VeryStrongPass9!",  # pragma: allowlist secret
            }
        )

        assert not form.is_valid()
        assert "username" in form.errors

    def test_rejects_duplicate_username(self, user_factory) -> None:
        # Arrange: 既存ユーザーを 1 件作り、同じ username で form を作る。
        user_factory(username="tarohan")
        form = UserCreationForm(
            data={
                "first_name": "Hanako",
                "last_name": "Suzuki",
                "username": "tarohan",
                "email": "hanako@example.com",
                "password1": "VeryStrongPass9!",  # pragma: allowlist secret
                "password2": "VeryStrongPass9!",  # pragma: allowlist secret
            }
        )

        # Act + Assert
        assert not form.is_valid()
        assert "username" in form.errors

    def test_valid_handle_passes(self) -> None:
        # 正常系: 有効な handle は is_valid() が通ること。
        form = UserCreationForm(
            data={
                "first_name": "Taro",
                "last_name": "Yamada",
                "username": "taro_42",
                "email": "valid@example.com",
                "password1": "VeryStrongPass9!",  # pragma: allowlist secret
                "password2": "VeryStrongPass9!",  # pragma: allowlist secret
            }
        )
        assert form.is_valid(), form.errors


@pytest.mark.django_db
@pytest.mark.integration
class TestUserCreationFormCleanEmail:
    def test_rejects_duplicate_email(self, user_factory) -> None:
        # Arrange
        user_factory(username="dup_email", email="dup@example.com")
        form = UserCreationForm(
            data={
                "first_name": "Taro",
                "last_name": "Yamada",
                "username": "another_handle",
                "email": "dup@example.com",
                "password1": "VeryStrongPass9!",  # pragma: allowlist secret
                "password2": "VeryStrongPass9!",  # pragma: allowlist secret
            }
        )

        # Act + Assert
        assert not form.is_valid()
        assert "email" in form.errors


@pytest.mark.unit
class TestUserChangeFormMeta:
    def test_username_not_editable(self) -> None:
        # python-reviewer HIGH / database-reviewer LOW:
        # username は作成後変更不可なので UserChangeForm.Meta.fields に含まれないこと。
        assert "username" not in UserChangeForm.Meta.fields
        # その他の基本フィールドは編集可能として残っていること。
        assert "email" in UserChangeForm.Meta.fields
        assert "first_name" in UserChangeForm.Meta.fields
        assert "last_name" in UserChangeForm.Meta.fields
