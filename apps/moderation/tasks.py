"""P1-11 (#97) + SPEC §14.5: moderation 用 Celery タスクの skeleton。

本 Issue のスコープは "準備のみ" であり、検知ロジック本体は Phase 2 で実装する。
ここでは関数シグネチャと Celery Beat から呼び出せる体裁だけ用意し、
無害な no-op として動かせるようにしておく (本番 Beat スケジューラは未登録)。

Phase 2 で拡張予定:
    - 直近 24h の Tweet 投稿数を集計し、
      ``post_tweet_tier_N`` の上限の 80% 以上に達したユーザーを抽出。
    - 結果を moderation queue (DB テーブル or Redis list) に push。
    - 既存通知基盤 (apps.notifications) に管理者向け通知を発砲。
"""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="apps.moderation.scan_tweet_rate_outliers")
def scan_tweet_rate_outliers() -> dict[str, int]:
    """レート上限の 80% 以上に達したユーザーを検知する (Phase 2 本実装予定)。

    Phase 1 (本 Issue #97) は skeleton であり、呼び出されても副作用を起こさない。
    Celery Beat スケジュール登録も Phase 2 で行う
    (``settings.CELERY_BEAT_SCHEDULE`` に entry を追加予定)。

    Returns:
        ``{"flagged": 0}`` 固定。Phase 2 で実数に置き換える。
    """
    logger.info(
        "scan_tweet_rate_outliers skeleton called",
        extra={"event": "moderation.scan_tweet_rate_outliers.skeleton"},
    )
    # TODO(Phase2):
    #   1. cache から ``throttle_post_tweet_tier_*_<user_id>`` の history を走査
    #   2. 上限 80% 以上のユーザーを抽出
    #   3. moderation queue に push、管理者通知を発砲
    return {"flagged": 0}
