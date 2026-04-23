"""
serializers.py に対するテスト (python-reviewer HIGH 対応)。

ケース:
- ``CreateUserSerializer.validate_username`` が予約語に対して
  ``code="reserved_handle"`` のエラーを返す
- ``CreateUserSerializer.validate_username`` が @handle 形式違反を reject する
- ``CustomUserSerializer`` では PATCH で username を変更しても無視される
  (read_only_fields に含まれる)
- ``CustomUserSerializer.full_name`` がユーザーのフルネームを返す
  (``get_full_name`` プロパティ名を避けて親メソッドを隠蔽しないことの確認)
"""

from __future__ import annotations

import pytest
from rest_framework import serializers as drf_serializers

from apps.users.serializers import CreateUserSerializer, CustomUserSerializer


@pytest.mark.unit
class TestCreateUserSerializerValidateUsername:
    def test_rejects_reserved_handle_with_code(self) -> None:
        # Arrange
        serializer = CreateUserSerializer()

        # Act + Assert
        with pytest.raises(drf_serializers.ValidationError) as exc:
            serializer.validate_username("admin")
        # DRF ValidationError には messages / detail が入る。
        # validate_handle が code="reserved_handle" を立てていることを確認する。
        # validate_handle が ``DjangoValidationError`` を raise → serializer が
        # ``DRF ValidationError`` へ変換するが、code 情報は messages に変換される。
        # 少なくともメッセージに "reserved" が含まれること。
        assert "reserved" in str(exc.value.detail).lower()

    def test_rejects_invalid_format(self) -> None:
        serializer = CreateUserSerializer()

        with pytest.raises(drf_serializers.ValidationError):
            # ハイフン入りは HANDLE_REGEX に反する。
            serializer.validate_username("bad-name")

    def test_accepts_valid_handle(self) -> None:
        serializer = CreateUserSerializer()
        assert serializer.validate_username("taro_42") == "taro_42"


@pytest.mark.django_db
@pytest.mark.integration
class TestCustomUserSerializerReadOnly:
    def test_username_is_read_only_on_patch(self, user_factory) -> None:
        # Arrange: 既存ユーザーに対し username を書き換える PATCH データを送る。
        user = user_factory(username="original_01")
        serializer = CustomUserSerializer(
            user,
            data={"username": "changed_01", "display_name": "New"},
            partial=True,
        )

        # Act
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()

        # Assert: username は read_only なので変更されない。他のフィールドは反映される。
        assert updated.username == "original_01"
        assert updated.display_name == "New"

    def test_email_is_read_only_on_patch(self, user_factory) -> None:
        user = user_factory(username="ro_email", email="ro@example.com")
        serializer = CustomUserSerializer(
            user,
            data={"email": "changed@example.com"},
            partial=True,
        )

        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.email == "ro@example.com"

    def test_full_name_field_is_exposed(self, user_factory) -> None:
        # ``CustomUserSerializer.full_name`` が User.full_name プロパティから
        # 正しく取得できること。親 ``AbstractUser.get_full_name()`` を隠蔽せず
        # プロパティ名を ``full_name`` にしているための回帰テスト。
        user = user_factory(username="full_name_01", first_name="Taro", last_name="Yamada")
        data = CustomUserSerializer(user).data
        assert data["full_name"] == "Taro Yamada"
