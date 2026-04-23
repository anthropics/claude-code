"""pytest fixtures for users app tests."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def user_factory(db):
    """ユーザー作成用 factory fixture。

    signal 不変性テストで複数ユーザーを個別に作る必要があるため、
    テストごとに呼び出せる形にしている。
    """

    counter = {"i": 0}

    def make_user(
        username: str | None = None,
        email: str | None = None,
        password: str = "pass12345!",
        first_name: str = "Taro",
        last_name: str = "Yamada",
        **extra,
    ) -> User:
        counter["i"] += 1
        i = counter["i"]
        return User.objects.create_user(
            username=username or f"user_{i:03d}",
            email=email or f"user{i:03d}@example.com",
            password=password,
            first_name=first_name,
            last_name=last_name,
            **extra,
        )

    return make_user
