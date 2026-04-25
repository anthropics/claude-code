"""Tests for POST /api/v1/users/me/complete_onboarding/ (P1-14 / Issue #115).

The onboarding endpoint is the one sanctioned way to flip ``needs_onboarding``
to False. It accepts the minimal profile fields collected in the wizard
(display_name + bio) and updates them atomically with the flag.

Test matrix:
- 200: valid display_name + bio sets the flag + persists the fields
- 200: bio is optional (empty string allowed)
- 400: display_name missing / too long
- 400: bio too long (> 160 chars)
- 401: unauthenticated
- 405: wrong HTTP method
- idempotent: second call is a no-op when needs_onboarding already False
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def onboarding_url() -> str:
    return reverse("users-me-complete-onboarding")


@pytest.mark.django_db
class TestCompleteOnboardingEndpoint:
    def test_success_sets_display_name_bio_and_flips_flag(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_01")
        assert user.needs_onboarding is True
        api_client.force_authenticate(user=user)

        res = api_client.post(
            onboarding_url,
            data={"display_name": "Alice", "bio": "loves python"},
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.display_name == "Alice"
        assert user.bio == "loves python"
        assert user.needs_onboarding is False
        # Response echoes the new profile so the SPA can refresh local state.
        assert res.data["needs_onboarding"] is False
        assert res.data["display_name"] == "Alice"

    def test_bio_is_optional(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_02")
        api_client.force_authenticate(user=user)

        res = api_client.post(
            onboarding_url,
            data={"display_name": "Bob"},
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.display_name == "Bob"
        assert user.bio == ""
        assert user.needs_onboarding is False

    def test_rejects_missing_display_name(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_03")
        api_client.force_authenticate(user=user)

        res = api_client.post(onboarding_url, data={"bio": "hi"}, format="json")

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        user.refresh_from_db()
        assert user.needs_onboarding is True
        assert "display_name" in res.data

    def test_rejects_blank_display_name(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_04")
        api_client.force_authenticate(user=user)

        res = api_client.post(
            onboarding_url, data={"display_name": "   "}, format="json"
        )

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        user.refresh_from_db()
        assert user.needs_onboarding is True

    def test_rejects_oversized_fields(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_05")
        api_client.force_authenticate(user=user)

        res = api_client.post(
            onboarding_url,
            data={"display_name": "a" * 51, "bio": "b" * 161},
            format="json",
        )

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "display_name" in res.data or "bio" in res.data

    def test_requires_authentication(
        self, api_client: APIClient, onboarding_url: str
    ) -> None:
        res = api_client.post(onboarding_url, data={"display_name": "x"}, format="json")
        assert res.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_rejects_non_post_methods(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_06")
        api_client.force_authenticate(user=user)
        for method in ("get", "put", "patch", "delete"):
            res = getattr(api_client, method)(onboarding_url)
            assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED, method

    def test_idempotent_when_already_onboarded(
        self, api_client: APIClient, user_factory, onboarding_url: str
    ) -> None:
        user = user_factory(username="onboarding_07")
        api_client.force_authenticate(user=user)
        api_client.post(
            onboarding_url,
            data={"display_name": "First", "bio": "original"},
            format="json",
        )
        res = api_client.post(
            onboarding_url,
            data={"display_name": "Second", "bio": "updated"},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        # Endpoint overwrites: we treat it as "finalize onboarding, also allowed
        # post-onboarding to edit those two fields in one call".
        assert user.display_name == "Second"
        assert user.bio == "updated"
        assert user.needs_onboarding is False
