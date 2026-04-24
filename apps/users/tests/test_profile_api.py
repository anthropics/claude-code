"""
プロフィール API (P1-03 / Issue #89) のテスト (SPEC §2)。

対象エンドポイント:
- GET    /api/v1/users/me/       : 自分の完全プロフィール (認証必須)
- PATCH  /api/v1/users/me/       : 自分のプロフィール部分更新 (認証必須)
- GET    /api/v1/users/<handle>/ : 他人の公開プロフィール (認証不要)

方針:
- ``force_authenticate`` で JWT/Cookie を経由せず直接 request.user を注入する。
  Cookie ベースのフローは P1-01/P1-12 側で別途テスト済みなので、本テストでは
  ビジネスロジック (serializer の出し分け / read_only / 404 挙動) に集中する。
- AAA (Arrange-Act-Assert) パターン。
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def me_url() -> str:
    return reverse("users-me")


def public_profile_url(handle: str) -> str:
    return reverse("users-public-profile", kwargs={"username": handle})


# 公開プロフィール API が返すべきキーの完全集合。PublicProfileSerializer.Meta.fields と
# 1:1 で揃えることで「新フィールド追加時に公開テストを通したままうっかり PII を
# 露出する」ケースを exhaustive に検知する (P1-03 review HIGH 対応)。
EXPECTED_PUBLIC_KEYS = {
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
}


# =============================================================================
# GET/PATCH /api/v1/users/me/
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestMeEndpoint:
    def test_get_requires_auth(self, api_client: APIClient, me_url: str) -> None:
        # Arrange: 匿名クライアント。
        # Act
        res = api_client.get(me_url)

        # Assert: 認証必須なので 401。
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_returns_full_profile(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange: ログイン済みユーザーに全フィールド値を設定。
        user = user_factory(
            username="me_user",
            email="me@example.com",
            first_name="Taro",
            last_name="Yamada",
        )
        user.display_name = "Taro T."
        user.bio = "engineer"
        user.avatar_url = "https://cdn.example.com/a.png"
        user.github_url = "https://github.com/taro"
        user.save()
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.get(me_url)

        # Assert: 200 で必須フィールドがすべて含まれる。
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        expected_fields = {
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
        }
        assert expected_fields <= set(data.keys())
        assert data["username"] == "me_user"
        assert data["email"] == "me@example.com"
        assert data["display_name"] == "Taro T."
        assert data["bio"] == "engineer"
        assert data["full_name"] == "Taro Yamada"
        assert data["github_url"] == "https://github.com/taro"

    def test_patch_updates_bio_and_display_name(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange
        user = user_factory(username="patcher")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.patch(
            me_url,
            data={"bio": "updated", "display_name": "New Name"},
            format="json",
        )

        # Assert: 200 + DB 反映。
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.bio == "updated"
        assert user.display_name == "New Name"

    def test_patch_username_change_is_ignored(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange: username は read_only。送っても silent drop される (ADR-0003 仕様)。
        user = user_factory(username="immutable_01")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.patch(
            me_url,
            data={"username": "new_handle_01", "bio": "ok"},
            format="json",
        )

        # Assert: 200 だが username は変更されない。bio は反映される。
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.username == "immutable_01"
        assert user.bio == "ok"
        # レスポンスも元の username を返す。
        assert res.json()["username"] == "immutable_01"

    def test_patch_email_change_is_ignored(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange: email も read_only。
        user = user_factory(username="email_ro", email="orig@example.com")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.patch(me_url, data={"email": "new@example.com"}, format="json")

        # Assert
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.email == "orig@example.com"

    def test_patch_is_premium_change_is_ignored(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange: is_premium はユーザー経由では変更不可 (Stripe webhook 経由のみ)。
        user = user_factory(username="premium_hack")
        assert user.is_premium is False
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.patch(me_url, data={"is_premium": True}, format="json")

        # Assert: 200 だが DB は False のまま。
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_premium is False

    def test_patch_needs_onboarding_change_is_ignored(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange: needs_onboarding はクライアント側からは変更不可。オンボーディング完了
        # 判定はサーバー側 (signal / 専用 endpoint) でのみ更新される
        # (P1-03 review MEDIUM 対応)。
        user = user_factory(username="ob_hack")
        # signup 直後なので True のはず。前提が崩れたら即 detect できるよう assert しておく。
        assert user.needs_onboarding is True
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.patch(me_url, data={"needs_onboarding": False}, format="json")

        # Assert: 200 で silently drop (DRF 標準挙動) + DB は True のまま。
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.needs_onboarding is True

    def test_patch_rejects_invalid_url(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange: SNS URL は https のみ。ftp:// は _HTTPS_URL_VALIDATOR で弾かれる。
        user = user_factory(username="bad_url")
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.patch(me_url, data={"github_url": "ftp://evil.example.com"}, format="json")

        # Assert: 400 + errors に github_url が含まれる。
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "github_url" in res.json()

    def test_patch_updates_all_sns_urls(
        self, api_client: APIClient, user_factory, me_url: str
    ) -> None:
        # Arrange
        user = user_factory(username="sns_all")
        api_client.force_authenticate(user=user)
        payload = {
            "github_url": "https://github.com/u",
            "x_url": "https://x.com/u",
            "zenn_url": "https://zenn.dev/u",
            "qiita_url": "https://qiita.com/u",
            "note_url": "https://note.com/u",
            "linkedin_url": "https://linkedin.com/in/u",
        }

        # Act
        res = api_client.patch(me_url, data=payload, format="json")

        # Assert: 全 URL が DB に反映される。
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        for field, expected in payload.items():
            assert getattr(user, field) == expected

    def test_patch_requires_auth(self, api_client: APIClient, me_url: str) -> None:
        # Arrange: 匿名。
        # Act
        res = api_client.patch(me_url, data={"bio": "x"}, format="json")

        # Assert: 認証必須。
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# GET /api/v1/users/<handle>/
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestPublicProfileEndpoint:
    def test_anonymous_can_view_public_profile(self, api_client: APIClient, user_factory) -> None:
        # Arrange: 匿名クライアント + 既存ユーザー。
        user = user_factory(username="public_01")
        user.display_name = "Public One"
        user.bio = "hello"
        user.save()

        # Act
        res = api_client.get(public_profile_url("public_01"))

        # Assert: 認証なしでも 200。
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["username"] == "public_01"
        assert data["display_name"] == "Public One"
        assert data["bio"] == "hello"

    def test_public_profile_hides_email(self, api_client: APIClient, user_factory) -> None:
        # Arrange
        user_factory(username="hide_email", email="secret@example.com")

        # Act
        res = api_client.get(public_profile_url("hide_email"))

        # Assert: email はレスポンスに含まれない (PII 漏洩防止)。さらにキー集合そのものが
        # EXPECTED_PUBLIC_KEYS と完全一致することを exhaustive に検証する
        # (P1-03 review HIGH 対応)。
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert "email" not in data
        assert set(data.keys()) == EXPECTED_PUBLIC_KEYS

    def test_public_profile_hides_is_premium(self, api_client: APIClient, user_factory) -> None:
        # Arrange: プレミアム状態も公開しない (課金情報は内部 flag)。
        user = user_factory(username="hide_premium")
        user.is_premium = True
        user.save()

        # Act
        res = api_client.get(public_profile_url("hide_premium"))

        # Assert
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert "is_premium" not in data
        assert "needs_onboarding" not in data

    def test_public_profile_exposes_sns_urls(self, api_client: APIClient, user_factory) -> None:
        # Arrange
        user = user_factory(username="sns_public")
        user.github_url = "https://github.com/x"
        user.x_url = "https://x.com/x"
        user.save()

        # Act
        res = api_client.get(public_profile_url("sns_public"))

        # Assert: SNS URL は公開される。
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["github_url"] == "https://github.com/x"
        assert data["x_url"] == "https://x.com/x"

    def test_nonexistent_handle_returns_404(self, api_client: APIClient) -> None:
        # Arrange: 何もユーザーを作らない。
        # Act
        res = api_client.get(public_profile_url("nobody_here"))

        # Assert: 404。
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_inactive_user_returns_404(self, api_client: APIClient, user_factory) -> None:
        # Arrange: 非 active ユーザー (退会扱い)。
        user = user_factory(username="inactive_01")
        user.is_active = False
        user.save()

        # Act
        res = api_client.get(public_profile_url("inactive_01"))

        # Assert: 存在隠蔽のため 404。
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_authenticated_user_can_view_public_profile(
        self, api_client: APIClient, user_factory
    ) -> None:
        # Arrange: ログイン中でも公開プロフィールは普通に見える。
        viewer = user_factory(username="viewer_01")
        target = user_factory(username="target_01")
        target.display_name = "Target"
        target.save()
        api_client.force_authenticate(user=viewer)

        # Act
        res = api_client.get(public_profile_url("target_01"))

        # Assert
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["username"] == "target_01"
        assert res.json()["display_name"] == "Target"

    def test_public_profile_handle_lookup_is_case_insensitive(
        self, api_client: APIClient, user_factory
    ) -> None:
        # Arrange: validator 側は大文字小文字を保存するが、URL からの参照は
        # case-insensitive で解決する (P1-03 review MEDIUM 対応)。
        user_factory(username="CamelCase_User")

        # Act: 全て小文字で URL を叩く。
        res = api_client.get(public_profile_url("camelcase_user"))

        # Assert: 200 + 保存時の大文字小文字を維持した username を返す。
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["username"] == "CamelCase_User"
