"""Views test for the tags app (P1-06, Issue #92, SPEC §4).

対象エンドポイント:
    GET  /api/v1/tags/               -- 一覧 + インクリメンタルサーチ
    POST /api/v1/tags/propose/       -- 新規タグ提案 (認証必須)
    GET  /api/v1/tags/<name>/        -- 詳細

方針:
    - 未承認タグ (is_approved=False) を含む seed を用意して、ApprovedTagManager が
      公開 API から情報漏洩させないことを回帰テストできるようにする。
    - ``force_authenticate`` で CSRF / JWT を経由せず直接 user を注入し、
      ビジネスロジックに集中する。CSRF の実装はテストクライアント側で
      ``enforce_csrf_checks=True`` のときのみ検証する。
    - AAA (Arrange-Act-Assert) パターン。
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.tags.models import Tag

User = get_user_model()


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def tag_factory(db):
    """Tag 作成用 factory fixture.

    ``is_approved`` のデフォルトは True (P1-06 の検索 API は承認済タグだけが対象)。
    未承認タグを作るテストでは明示的に False を渡す。
    """

    counter = {"i": 0}

    def make_tag(
        name: str | None = None,
        display_name: str | None = None,
        *,
        usage_count: int = 0,
        is_approved: bool = True,
        description: str = "",
        created_by: User | None = None,
    ) -> Tag:
        counter["i"] += 1
        i = counter["i"]
        tag_name = name or f"tag-{i:03d}"
        return Tag.all_objects.create(
            name=tag_name,
            display_name=display_name or tag_name.capitalize(),
            usage_count=usage_count,
            is_approved=is_approved,
            description=description,
            created_by=created_by,
        )

    return make_tag


@pytest.fixture
def user_factory(db):
    """ユーザー作成用 factory fixture (タグ提案テスト用)."""

    counter = {"i": 0}

    def make_user(**extra) -> User:
        counter["i"] += 1
        i = counter["i"]
        return User.objects.create_user(
            username=extra.pop("username", f"proposer_{i:03d}"),
            email=extra.pop("email", f"proposer{i:03d}@example.com"),
            password=extra.pop("password", "pass12345!"),
            first_name=extra.pop("first_name", "Taro"),
            last_name=extra.pop("last_name", "Yamada"),
            **extra,
        )

    return make_user


@pytest.fixture
def list_url() -> str:
    return reverse("tags-list")


@pytest.fixture
def propose_url() -> str:
    return reverse("tags-propose")


def detail_url(name: str) -> str:
    return reverse("tags-detail", kwargs={"name": name})


# =============================================================================
# GET /api/v1/tags/
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestTagListView:
    def test_anonymous_can_list(self, api_client: APIClient, tag_factory, list_url: str) -> None:
        """未ログインでも 200 で一覧を取得できる."""
        # Arrange
        tag_factory(name="python", display_name="Python")

        # Act
        res = api_client.get(list_url)

        # Assert
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert "results" in data
        assert len(data["results"]) == 1
        assert data["results"][0]["name"] == "python"
        assert data["results"][0]["display_name"] == "Python"
        assert "usage_count" in data["results"][0]

    def test_unapproved_tags_are_hidden(
        self, api_client: APIClient, tag_factory, list_url: str
    ) -> None:
        """is_approved=False のタグは検索結果に出ない (SPEC §4)."""
        # Arrange
        tag_factory(name="python", is_approved=True)
        tag_factory(name="hidden-tag", is_approved=False)

        # Act
        res = api_client.get(list_url)

        # Assert
        assert res.status_code == status.HTTP_200_OK
        names = [r["name"] for r in res.json()["results"]]
        assert "python" in names
        assert "hidden-tag" not in names

    def test_ordering_by_usage_count_desc(
        self, api_client: APIClient, tag_factory, list_url: str
    ) -> None:
        """人気順 (usage_count DESC, name ASC) で並ぶ."""
        # Arrange
        tag_factory(name="python", usage_count=100)
        tag_factory(name="rust", usage_count=5)
        tag_factory(name="typescript", usage_count=50)

        # Act
        res = api_client.get(list_url)

        # Assert
        names = [r["name"] for r in res.json()["results"]]
        assert names == ["python", "typescript", "rust"]

    def test_search_by_prefix(self, api_client: APIClient, tag_factory, list_url: str) -> None:
        """``?q=py`` で name prefix ヒットする."""
        # Arrange
        tag_factory(name="python", display_name="Python")
        tag_factory(name="pytorch", display_name="PyTorch")
        tag_factory(name="rust", display_name="Rust")

        # Act: 大文字でも動く (istartswith)
        res = api_client.get(list_url, {"q": "Py"})

        # Assert
        assert res.status_code == status.HTTP_200_OK
        names = sorted(r["name"] for r in res.json()["results"])
        assert names == ["python", "pytorch"]

    def test_search_matches_display_name_contains(
        self, api_client: APIClient, tag_factory, list_url: str
    ) -> None:
        """display_name の部分一致でもヒットする (icontains)."""
        # Arrange
        tag_factory(name="nextjs", display_name="Next.js")
        tag_factory(name="rust", display_name="Rust")

        # Act: "next" は name だけでなく display_name 側でも検索される
        res = api_client.get(list_url, {"q": "next"})

        # Assert
        names = [r["name"] for r in res.json()["results"]]
        assert names == ["nextjs"]

    def test_pagination_default_page_size(
        self, api_client: APIClient, tag_factory, list_url: str
    ) -> None:
        """DRF 既定の PageNumberPagination (PAGE_SIZE=10) が効く."""
        # Arrange: 12 件作成 (> page_size=10)
        for i in range(12):
            tag_factory(name=f"tag-{i:02d}", usage_count=100 - i)

        # Act
        res = api_client.get(list_url)

        # Assert
        data = res.json()
        assert data["count"] == 12
        assert len(data["results"]) == 10
        assert data["next"] is not None
        assert data["previous"] is None

    def test_empty_result(self, api_client: APIClient, list_url: str) -> None:
        """Tag が 0 件でも 200 + results=[] を返す."""
        # Act
        res = api_client.get(list_url)

        # Assert
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["count"] == 0
        assert data["results"] == []

    def test_empty_q_returns_all_approved(
        self, api_client: APIClient, tag_factory, list_url: str
    ) -> None:
        """``?q=`` (空文字) は絞り込みせず approved 全件を返す.

        code-reviewer (PR #135 MEDIUM #6) 指摘: 空文字 q の挙動を回帰テスト化。
        """
        # Arrange: approved 2 件 + unapproved 1 件
        tag_factory(name="python", is_approved=True)
        tag_factory(name="rust", is_approved=True)
        tag_factory(name="hidden", is_approved=False)

        # Act
        res = api_client.get(list_url, {"q": ""})

        # Assert
        assert res.status_code == status.HTTP_200_OK
        names = sorted(r["name"] for r in res.json()["results"])
        # approved 全件が返り、unapproved は混ざらない
        assert names == ["python", "rust"]


# =============================================================================
# GET /api/v1/tags/<name>/
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestTagDetailView:
    def test_anonymous_can_retrieve(self, api_client: APIClient, tag_factory) -> None:
        """未ログインでも 200 で詳細取得できる."""
        # Arrange
        tag_factory(
            name="python",
            display_name="Python",
            description="General-purpose language.",
            usage_count=42,
        )

        # Act: 大文字 URL も iexact で引ける
        res = api_client.get(detail_url("Python"))

        # Assert
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["name"] == "python"
        assert data["display_name"] == "Python"
        assert data["description"] == "General-purpose language."
        assert data["usage_count"] == 42
        assert "related_tags" in data

    def test_not_found_for_unknown(self, api_client: APIClient) -> None:
        """存在しない name で 404."""
        # Act
        res = api_client.get(detail_url("nonexistent"))

        # Assert
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_unapproved_returns_404(self, api_client: APIClient, tag_factory) -> None:
        """is_approved=False は存在隠蔽で 404."""
        # Arrange
        tag_factory(name="hidden", is_approved=False)

        # Act
        res = api_client.get(detail_url("hidden"))

        # Assert
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_related_tags_returned(self, api_client: APIClient, tag_factory) -> None:
        """related_tags は自タグ以外の approved タグから最大 5 件返す."""
        # Arrange: 本体 + 6 件の関連候補 + 1 件の未承認タグ
        tag_factory(name="python", usage_count=100)
        for i in range(6):
            tag_factory(name=f"related-{i:02d}", usage_count=50 - i, is_approved=True)
        tag_factory(name="unapproved", is_approved=False)

        # Act
        res = api_client.get(detail_url("python"))

        # Assert: 関連タグ 5 件で cap、自タグと未承認タグは含まれない
        data = res.json()
        related_names = [t["name"] for t in data["related_tags"]]
        assert len(related_names) == 5
        assert "python" not in related_names
        assert "unapproved" not in related_names
        # usage_count 降順
        usage_counts = [t["usage_count"] for t in data["related_tags"]]
        assert usage_counts == sorted(usage_counts, reverse=True)


# =============================================================================
# POST /api/v1/tags/propose/
# =============================================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestTagProposeView:
    def test_unauthenticated_returns_401(self, api_client: APIClient, propose_url: str) -> None:
        """未ログインは 401 を返す."""
        # Act
        res = api_client.post(
            propose_url,
            data={"name": "newtag", "display_name": "NewTag"},
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_similar_existing_returns_409(
        self,
        api_client: APIClient,
        user_factory,
        tag_factory,
        propose_url: str,
    ) -> None:
        """既存 approved タグに編集距離 2 以下で近いと 409 + similar_tags."""
        # Arrange: 既存 "python" に対し "pythn" を提案 (距離 1)
        tag_factory(name="python", display_name="Python")
        user = user_factory()
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(
            propose_url,
            data={"name": "pythn", "display_name": "Pythn"},
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_409_CONFLICT
        data = res.json()
        assert "similar_tags" in data
        assert any(s["name"] == "python" for s in data["similar_tags"])
        # DB にも作成されていない
        assert not Tag.all_objects.filter(name="pythn").exists()

    def test_create_success_is_unapproved(
        self,
        api_client: APIClient,
        user_factory,
        propose_url: str,
    ) -> None:
        """近似なしなら 201 + is_approved=False で作成される (search には載らない)."""
        # Arrange
        user = user_factory()
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(
            propose_url,
            data={"name": "brand-new-tag", "display_name": "Brand New"},
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["name"] == "brand-new-tag"
        assert data["display_name"] == "Brand New"
        assert data["is_approved"] is False

        tag = Tag.all_objects.get(name="brand-new-tag")
        assert tag.is_approved is False
        assert tag.created_by == user
        # ApprovedTagManager からは除外される
        assert not Tag.objects.filter(name="brand-new-tag").exists()

    def test_invalid_name_returns_400(
        self,
        api_client: APIClient,
        user_factory,
        propose_url: str,
    ) -> None:
        """SPEC §4 の許容文字以外 (例: 空白 / マルチバイト) は 400."""
        # Arrange
        user = user_factory()
        api_client.force_authenticate(user=user)

        # Act: スペース含みは validate_tag_name が拒否する
        res = api_client.post(
            propose_url,
            data={"name": "invalid name", "display_name": "Invalid"},
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        data = res.json()
        assert "name" in data

    def test_display_name_defaults_to_capitalized_name(
        self,
        api_client: APIClient,
        user_factory,
        propose_url: str,
    ) -> None:
        """display_name 省略時は name.capitalize() が入る."""
        # Arrange
        user = user_factory()
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.post(
            propose_url,
            data={"name": "kotlin"},
            format="json",
        )

        # Assert
        assert res.status_code == status.HTTP_201_CREATED
        assert res.json()["display_name"] == "Kotlin"
        tag = Tag.all_objects.get(name="kotlin")
        assert tag.display_name == "Kotlin"

    def test_get_propose_returns_405(
        self,
        api_client: APIClient,
        user_factory,
        propose_url: str,
    ) -> None:
        """``GET /api/v1/tags/propose/`` は副作用のある POST 専用なので 405.

        code-reviewer (PR #135 MEDIUM #6) 指摘: ``http_method_names`` で弾いている
        挙動を回帰テスト化する。
        """
        # Arrange: 認証済みでも動作が変わらないことを確認したいので force_authenticate
        user = user_factory()
        api_client.force_authenticate(user=user)

        # Act
        res = api_client.get(propose_url)

        # Assert
        assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_csrf_enforced_without_token(
        self,
        user_factory,
        propose_url: str,
    ) -> None:
        """CSRF を有効にしたクライアントで、Cookie 経由の JWT のみで POST すると 403.

        ``force_authenticate`` は DRF の authentication_classes を全スキップしてしまい
        ``CSRFEnforcingAuthentication`` / ``CookieAuthentication`` の CSRF 強制を
        観測できないため、ここでは rest_framework_simplejwt の ``RefreshToken`` で
        実 JWT を発行し、HttpOnly Cookie にセットして ``CookieAuthentication`` を
        本来の経路で走らせる (apps/users/tests/test_email_auth_flow.py と同方針)。
        """
        from django.conf import settings
        from rest_framework_simplejwt.tokens import RefreshToken

        # Arrange: 本物の access token を cookie にセットする
        csrf_client = APIClient(enforce_csrf_checks=True)
        user = user_factory()
        refresh = RefreshToken.for_user(user)
        csrf_client.cookies[settings.COOKIE_NAME] = str(refresh.access_token)

        # Act: CSRF token を付けずに Cookie 経由で POST
        res = csrf_client.post(
            propose_url,
            data={"name": "some-tag", "display_name": "Some"},
            format="json",
        )

        # Assert: CookieAuthentication が from_cookie=True と判定し CSRF を強制 → 403
        assert res.status_code == status.HTTP_403_FORBIDDEN
