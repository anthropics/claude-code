"""Custom managers for the tweets app.

`Tweet` はソフト削除 (§3.9) を採用しているため、
デフォルトの `objects` は削除済みを除外する。削除済みも含めて
参照したい場合は `all_objects` か `all_with_deleted()` を使う。
"""

from __future__ import annotations

from django.db import models


class TweetQuerySet(models.QuerySet):
    """Tweet 用 QuerySet。

    チェーン可能な `alive()` / `dead()` を提供する。
    """

    def alive(self) -> TweetQuerySet:
        """論理削除されていない Tweet のみを返す。"""

        return self.filter(is_deleted=False)

    def dead(self) -> TweetQuerySet:
        """論理削除された Tweet のみを返す。"""

        return self.filter(is_deleted=True)


class TweetManager(models.Manager.from_queryset(TweetQuerySet)):
    """既定で `is_deleted=False` の Tweet のみを返す Manager。

    - `Tweet.objects.all()` は削除済みを含まない
    - 削除済みを含めたい場合は `Tweet.all_objects` か `all_with_deleted()`
    """

    def get_queryset(self) -> TweetQuerySet:  # type: ignore[override]
        return super().get_queryset().filter(is_deleted=False)

    def all_with_deleted(self) -> TweetQuerySet:
        """削除済みを含むすべての Tweet を返す。"""

        return super().get_queryset()
