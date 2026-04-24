"""P1-12: Google OAuth (Cookie 化) の単体テスト.

SPEC §1.2 / ADR-0003 / security-reviewer #84 対応の回帰テスト。

観点:
- ``GoogleCookieAuthView`` は super().post (djoser ProviderAuthView) を mock し、
  成功時に 200 + Cookie set + body に access/refresh を含まないこと。
- 失敗レスポンス (400) はそのままパススルーすること。
- Cookie は HttpOnly / Path=/ / SameSite=Lax で発行されること。
- ``set_needs_onboarding`` pipeline は ``is_new=True`` のときだけ True を立て、
  既存ユーザーに対しては何も変更しないこと。
- ``SOCIAL_AUTH_PIPELINE`` に ``associate_by_email`` が **含まれない** こと
  (security-reviewer #84: アカウント乗っ取り対策)。

djoser / social-auth の完全な OAuth dance を走らせると Google API を呼んで
しまうため、``ProviderAuthView.post`` をモックして Django 側のビジネスロジック
だけを検証する。

この単体テストは ``test_email_auth_flow`` と同じ流儀で URL 解決と Cookie
属性を確認する。
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any
from unittest.mock import patch

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import resolve, reverse
from rest_framework import status as drf_status
from rest_framework.response import Response
from rest_framework.test import APIClient

from apps.users.social_pipeline import set_needs_onboarding

User = get_user_model()

GOOGLE_COOKIE_URL = "/api/v1/auth/o/google-oauth2/cookie/"


@pytest.fixture(autouse=True)
def _reset_throttle_cache() -> None:
    """SimpleRateThrottle の cache 汚染を毎テストで切り離す."""

    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


def _mock_success_response(
    *,
    access: str = "mock-access-token",
    refresh: str = "mock-refresh-token",
    user: dict[str, Any] | None = None,
) -> Response:
    """ProviderAuthView.post の成功レスポンス (201) を偽装する."""

    body = {
        "access": access,
        "refresh": refresh,
        "user": user
        or {
            "id": "00000000-0000-0000-0000-000000000000",
            "email": "googleuser@example.com",
            "username": "googleuser01",
        },
    }
    return Response(body, status=drf_status.HTTP_201_CREATED)


def _mock_failure_response(
    *,
    status_code: int = drf_status.HTTP_400_BAD_REQUEST,
    detail: str = "Invalid code",
) -> Response:
    """ProviderAuthView.post の失敗レスポンス (400 相当) を偽装する."""

    return Response({"detail": detail}, status=status_code)


# -----------------------------------------------------------------------------
# URL 解決 (unit)
# -----------------------------------------------------------------------------


@pytest.mark.unit
class TestGoogleCookieAuthURL:
    def test_url_resolves(self) -> None:
        assert (
            reverse("google-oauth-cookie", kwargs={"provider": "google-oauth2"})
            == GOOGLE_COOKIE_URL
        )

    def test_url_resolves_with_provider_kwarg(self) -> None:
        """code-reviewer (PR #138 CRITICAL) 回帰テスト.

        djoser の ``ProviderAuthSerializer.validate()`` は
        ``self.context["view"].kwargs["provider"]`` を参照するため、URL pattern が
        ``<provider>`` をキャプチャしないと本番で ``KeyError: 'provider'`` → 500 に
        なる。URL 解決時に ``kwargs["provider"]`` が ``"google-oauth2"`` で
        埋まっていることを確認することで、このバグのレグレッションを検出する。
        """

        match = resolve(GOOGLE_COOKIE_URL)
        assert match.kwargs["provider"] == "google-oauth2"


# -----------------------------------------------------------------------------
# GoogleCookieAuthView の挙動 (integration w/ mock)
# -----------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.integration
class TestGoogleCookieAuthView:
    """``ProviderAuthView.post`` を mock して Cookie 化ロジックだけを検証する."""

    def test_successful_oauth_sets_cookies_and_removes_token_from_body(
        self, api_client: APIClient
    ) -> None:
        """成功時 200 + Cookie set + body に access/refresh を含まない."""

        mock_res = _mock_success_response()
        with patch(
            "djoser.social.views.ProviderAuthView.post",
            return_value=mock_res,
        ):
            res = api_client.post(
                GOOGLE_COOKIE_URL,
                {"code": "mock-code", "state": "mock-state"},
                format="json",
            )

        # djoser 201 → 本 view で 200 に格下げ。
        assert res.status_code == HTTPStatus.OK, res.content

        # Cookie set を確認。
        assert "access" in res.cookies
        assert res.cookies["access"].value == "mock-access-token"
        assert "refresh" in res.cookies
        assert res.cookies["refresh"].value == "mock-refresh-token"
        assert "logged_in" in res.cookies

        # body から token を除去し、user と detail のみ返す。
        body: dict[str, Any] = res.json()
        assert "access" not in body
        assert "refresh" not in body
        assert body["detail"] == "Google OAuth login successful"
        assert body["user"]["email"] == "googleuser@example.com"

    def test_oauth_failure_passes_through(self, api_client: APIClient) -> None:
        """ProviderAuthView が 400 を返したらそのままパススルー."""

        mock_res = _mock_failure_response()
        with patch(
            "djoser.social.views.ProviderAuthView.post",
            return_value=mock_res,
        ):
            res = api_client.post(
                GOOGLE_COOKIE_URL,
                {"code": "bad-code"},
                format="json",
            )

        assert res.status_code == HTTPStatus.BAD_REQUEST
        # 失敗時は Cookie を set しない。
        assert "access" not in res.cookies
        assert "refresh" not in res.cookies
        assert "logged_in" not in res.cookies

    def test_cookies_have_correct_attributes(self, api_client: APIClient) -> None:
        """HttpOnly / Path=/ / SameSite=Lax が Cookie に付与される."""

        mock_res = _mock_success_response()
        with patch(
            "djoser.social.views.ProviderAuthView.post",
            return_value=mock_res,
        ):
            res = api_client.post(
                GOOGLE_COOKIE_URL,
                {"code": "mock-code"},
                format="json",
            )
        assert res.status_code == HTTPStatus.OK, res.content

        access_cookie = res.cookies["access"]
        assert access_cookie["httponly"]
        assert access_cookie["path"] == "/"
        assert access_cookie["samesite"].lower() == "lax"

        refresh_cookie = res.cookies["refresh"]
        assert refresh_cookie["httponly"]
        assert refresh_cookie["path"] == "/"
        assert refresh_cookie["samesite"].lower() == "lax"

        # logged_in は JS から読む必要があるので HttpOnly ではない。
        logged_in_cookie = res.cookies["logged_in"]
        assert not logged_in_cookie["httponly"]

    def test_missing_tokens_in_provider_response_is_preserved(self, api_client: APIClient) -> None:
        """ProviderAuthView が 201 だが access/refresh 欠落 → fallback でそのまま返す.

        ここは欠陥データのレグレッション検出。通常運用では発生しない想定だが、
        万一 djoser 側の仕様変更があった場合に無言で壊れないようにする。
        """

        broken = Response({"user": {}}, status=drf_status.HTTP_201_CREATED)
        with patch(
            "djoser.social.views.ProviderAuthView.post",
            return_value=broken,
        ):
            res = api_client.post(
                GOOGLE_COOKIE_URL,
                {"code": "mock-code"},
                format="json",
            )
        # Cookie は set されない。元レスポンスを壊さず返す。
        assert "access" not in res.cookies
        assert "refresh" not in res.cookies
        # 201 が保持される (書き換えはしない)。
        assert res.status_code == HTTPStatus.CREATED


# -----------------------------------------------------------------------------
# set_needs_onboarding pipeline (unit)
# -----------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestSetNeedsOnboardingPipeline:
    """`apps.users.social_pipeline.set_needs_onboarding` 単体検証."""

    def test_new_user_has_needs_onboarding_true(self, user_factory) -> None:
        """``is_new=True`` + 既存で False なら True に昇格."""

        user = user_factory()
        # User モデルの default は True。テストでは一旦 False に落として検証する。
        user.needs_onboarding = False
        user.save(update_fields=["needs_onboarding"])

        set_needs_onboarding(backend=None, user=user, is_new=True)

        user.refresh_from_db()
        assert user.needs_onboarding is True

    def test_existing_user_is_not_mutated(self, user_factory) -> None:
        """``is_new=False`` (既存ユーザー) の場合は needs_onboarding を触らない."""

        user = user_factory()
        user.needs_onboarding = False
        user.save(update_fields=["needs_onboarding"])

        set_needs_onboarding(backend=None, user=user, is_new=False)

        user.refresh_from_db()
        # 既存ユーザーには触らないので False のまま。
        assert user.needs_onboarding is False

    def test_none_user_is_noop(self) -> None:
        """user=None (pipeline 途中で break したケース) でも例外にしない."""

        result = set_needs_onboarding(backend=None, user=None, is_new=True)
        assert result == {"user": None}


# -----------------------------------------------------------------------------
# SOCIAL_AUTH_PIPELINE に associate_by_email が無いこと (security-reviewer #84)
# -----------------------------------------------------------------------------


@pytest.mark.unit
class TestPipelineSecurityPosture:
    """security-reviewer #84: associate_by_email はアカウント乗っ取りリスクがある.

    email 一致だけで既存ローカルアカウントに Google 連携を紐付ける設定は
    config/settings/base.py の ``SOCIAL_AUTH_PIPELINE`` から **意図的に除外**
    されている。本テストはその設定が将来のリファクタで戻されないための
    回帰ガード。
    """

    def test_associate_by_email_is_not_in_pipeline(self) -> None:
        pipeline = settings.SOCIAL_AUTH_PIPELINE
        assert all(
            step != "social_core.pipeline.social_auth.associate_by_email" for step in pipeline
        ), (
            "associate_by_email は SOCIAL_AUTH_PIPELINE に含めてはいけない "
            "(security-reviewer #84)"
        )

    def test_set_needs_onboarding_is_in_pipeline(self) -> None:
        pipeline = settings.SOCIAL_AUTH_PIPELINE
        assert (
            "apps.users.social_pipeline.set_needs_onboarding" in pipeline
        ), "P1-12: set_needs_onboarding が SOCIAL_AUTH_PIPELINE に無い"

    def test_create_user_is_in_pipeline(self) -> None:
        """新規 Google ユーザーを確実に作るため create_user は必須."""

        pipeline = settings.SOCIAL_AUTH_PIPELINE
        assert "social_core.pipeline.user.create_user" in pipeline
