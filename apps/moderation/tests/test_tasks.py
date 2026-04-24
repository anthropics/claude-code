"""P1-11 (#97) + SPEC §14.5: moderation Celery タスクのテスト。

``scan_tweet_rate_outliers`` は Phase 1 では skeleton (無害な no-op) であり、
本 Issue で必要なのは "呼び出し可能であること" と "Celery に登録される名前が
固定されていること" の 2 点。Phase 2 で検知ロジック本体を追加した際は、
検知ロジックに対する単体テストをこのファイルに追記していく。
"""

from __future__ import annotations

import pytest

from apps.moderation.tasks import scan_tweet_rate_outliers


@pytest.mark.unit
def test_scan_tweet_rate_outliers_returns_zero_flagged() -> None:
    """Phase 1 の skeleton 実装は常に ``{"flagged": 0}`` を返す契約。"""
    # Act: ``.run()`` ではなく直接関数呼び出しすることで、eager/worker 構成に
    # 依存せず純粋関数として結果だけを検証する。
    result = scan_tweet_rate_outliers()

    # Assert
    assert result == {"flagged": 0}


@pytest.mark.unit
def test_task_has_registered_name() -> None:
    """Celery Beat から呼び出すときに参照するタスク名を固定する。

    ``@shared_task(name=...)`` で明示した名前が ``.name`` 属性として露出する。
    Phase 2 で Beat スケジュールに登録した際に名前がズレないよう、ここで契約を
    固定しておく。
    """
    assert scan_tweet_rate_outliers.name == "apps.moderation.scan_tweet_rate_outliers"
