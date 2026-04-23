"""
User モデル拡張フィールドのテスト (SPEC §2)。

ケース:
- display_name の max_length 制約
- bio の max_length 制約 (160 字)
- SNS URL のバリデーション (URLField)
- デフォルト値 (is_premium=False, needs_onboarding=True)
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.integration
class TestUserModelFields:
    def test_display_name_max_length_enforced(self, user_factory) -> None:
        # Arrange: 51 字
        user = user_factory(username="long_name")
        user.display_name = "a" * 51

        # Act + Assert: full_clean で検出される。
        with pytest.raises(ValidationError) as exc:
            user.full_clean()
        assert "display_name" in exc.value.message_dict

    def test_display_name_boundary_50_is_ok(self, user_factory) -> None:
        # 50 字ちょうどは OK。
        user = user_factory(username="ok_name")
        user.display_name = "a" * 50
        user.full_clean()  # 例外が出ないこと

    def test_bio_max_length_is_160(self, user_factory) -> None:
        user = user_factory(username="bio_long")
        user.bio = "b" * 161
        with pytest.raises(ValidationError) as exc:
            user.full_clean()
        assert "bio" in exc.value.message_dict

    def test_bio_boundary_160_is_ok(self, user_factory) -> None:
        user = user_factory(username="bio_ok")
        user.bio = "b" * 160
        user.full_clean()

    def test_sns_url_validation(self, user_factory) -> None:
        # 不正な URL は URLField で reject される。
        user = user_factory(username="url_bad")
        user.github_url = "not-a-url"

        with pytest.raises(ValidationError) as exc:
            user.full_clean()
        assert "github_url" in exc.value.message_dict

    def test_sns_url_accepts_valid_urls(self, user_factory) -> None:
        user = user_factory(username="url_ok")
        user.github_url = "https://github.com/octocat"
        user.x_url = "https://x.com/example"
        user.zenn_url = "https://zenn.dev/example"
        user.qiita_url = "https://qiita.com/example"
        user.note_url = "https://note.com/example"
        user.linkedin_url = "https://linkedin.com/in/example"
        user.full_clean()

    def test_default_flags(self, user_factory) -> None:
        user = user_factory(username="flags_01")
        assert user.is_premium is False
        assert user.needs_onboarding is True

    def test_original_username_snapshot_on_fetch(self, user_factory) -> None:
        # from_db 経由で snapshot が張られていること。
        user = user_factory(username="snap_001")
        fetched = User.objects.get(pk=user.pk)
        assert fetched._original_username == "snap_001"
