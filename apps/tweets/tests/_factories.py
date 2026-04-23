"""テスト用のファクトリヘルパ。

pytest-factoryboy を入れる前のフェーズなので、薄いヘルパーだけ用意する。
外部 app (tags, users) の都合を隔離し、テスト本体が簡潔になるようにする。
"""

from __future__ import annotations

import uuid
from typing import Any

from django.contrib.auth import get_user_model

from apps.tags.models import Tag  # type: ignore[attr-defined]
from apps.tweets.models import Tweet

User = get_user_model()


def make_user(**overrides: Any) -> Any:
    """テスト用ユーザーを作る薄いヘルパ。

    email / username は一意でなければいけないため、デフォルトは uuid4 で
    必ずユニークにする (MEDIUM 吸収)。呼び出し側が ``overrides`` で明示的に
    指定した場合はそれを尊重する。
    """

    suffix = uuid.uuid4().hex[:12]
    defaults = {
        "username": f"tester-{suffix}",
        "email": f"tester-{suffix}@example.com",
        "first_name": "Test",
        "last_name": "User",
    }
    defaults.update(overrides)
    return User.objects.create_user(
        password="pw-unused-for-tests",  # pragma: allowlist secret
        **defaults,
    )


def make_tag(
    name: str = "python",
    display_name: str | None = None,
    is_approved: bool = True,
) -> Tag:
    """テスト用タグ。既定で is_approved=True (TweetTag.clean の検証を通すため)。

    未承認タグのケースを試したい場合は `make_tag(is_approved=False)` を指定する。
    `Tag.all_objects.create` は ApprovedTagManager の絞込を迂回するため、
    未承認タグを作ってもテスト内で扱える。
    """

    return Tag.all_objects.create(
        name=name,
        display_name=display_name or name.capitalize(),
        is_approved=is_approved,
    )


def make_tweet(author=None, body: str = "hello world") -> Tweet:
    """テスト用ツイート。

    ``author`` が省略された場合は新しいユーザを作る。
    """

    if author is None:
        author = make_user()
    return Tweet.objects.create(author=author, body=body)
