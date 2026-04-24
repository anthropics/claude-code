# Throttle 階層運用ガイド (SPEC §14.5 / Issue #97)

> このドキュメントは P1-11 (#97) で DRF throttle を階層化した際に書かれた。
> Phase 2 で active ユーザー判定と Celery Beat アラートを実装するとき、
> ここを更新すること。

## 概要

Tweet 投稿 API は**ユーザー属性に応じて 3 段階**のレート上限を切る。
一般 API 全体には既定の `AnonRateThrottle` / `UserRateThrottle` が効いている
(P1-01 で配線済み) ので、Tweet 以外はこのドキュメントの対象外。

| Tier | scope 名            |     上限 | 対象ユーザー       | 判定方法                                                         |
| ---- | ------------------- | -------: | ------------------ | ---------------------------------------------------------------- |
| 1    | `post_tweet_tier_1` |  100/day | 通常ユーザー       | 既定 (他に当てはまらない場合)                                    |
| 2    | `post_tweet_tier_2` |  500/day | アクティブユーザー | **Phase 2 で実装**。直近 7 日 tweet count >= 20 等で自動昇格予定 |
| 3    | `post_tweet_tier_3` | 1000/day | プレミアム         | `User.is_premium == True`                                        |

未認証 (`AnonymousUser`) は safety net として tier_1 にフォールバックする。
実際には Tweet POST 自体が 401 で弾かれるので到達しないが、middleware 差し込み
漏れなどの二重防御として残している。

## 実装ポイント

### `apps.common.throttling.PostTweetThrottle`

DRF の `ScopedRateThrottle` を継承し、`allow_request` の先頭で
`request.user` を見て self.scope を動的に切り替える。

```python
from apps.common.throttling import PostTweetThrottle

class TweetCreateView(CreateAPIView):
    throttle_classes = [PostTweetThrottle]
    # throttle_scope は PostTweetThrottle が動的に決めるので指定不要。
    # view 側で明示した場合はそちらが優先される (手動オーバーライド許可)。
```

違反時は DRF 既定の挙動で `429 Too Many Requests` + `Retry-After` ヘッダ
が返る。レスポンスボディは DRF `throttled` エラーレンダラに従う。

### `apps.common.throttling.get_user_throttle_tier(user)`

tier 判定ロジックを純粋関数として切り出してある。テスト容易性と
Phase 2 での拡張(ログや通知との共有) を意識した設計。

### settings

`config/settings/base.py` の `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`:

```python
"DEFAULT_THROTTLE_RATES": {
    "anon": "200/day",
    "user": "500/day",
    "post_tweet": "500/day",           # legacy (Phase 2 で削除予定)
    "post_tweet_tier_1": "100/day",
    "post_tweet_tier_2": "500/day",
    "post_tweet_tier_3": "1000/day",
},
```

`post_tweet` は P1-08 以前の互換用に残している。全面移行後に削除する。

## 運用

### rate の調整

本番で "通常ユーザーが 100/day では足りない" といったフィードバックが
来た場合、`config/settings/base.py` の DEFAULT_THROTTLE_RATES を書き換えて
デプロイすれば即反映される。キャッシュキーは scope 名ベースなので、
scope 名を変えずに数値だけ変更すれば既存の counter を壊さない。

### 違反発生時の確認

Throttle の counter は Redis cache に乗っている (P0.5 で配線済み)。
キーフォーマット (DRF 既定):

```
throttle_post_tweet_tier_1_<user_pk>
throttle_post_tweet_tier_3_<user_pk>
```

Redis から直接 `GET throttle_post_tweet_tier_1_42` すれば 1 ユーザーの
直近 24h 履歴 (timestamp の list) を確認できる。

### Phase 2 で追加予定

- **active ユーザー判定**
  `get_user_throttle_tier` 内で tier_2 に昇格するロジックを追加する。
  判定は daily Celery Beat で直近 7 日の tweet count を集計し、閾値を
  超えたユーザーを Redis set にキャッシュしておき、throttle 判定時に
  O(1) で参照する想定。

- **Celery Beat アラート**
  `apps.moderation.tasks.scan_tweet_rate_outliers` (現在は skeleton)
  を本実装し、上限の 80% 以上に達したユーザーを moderation queue に
  載せる。`CELERY_BEAT_SCHEDULE` への登録もこのタイミングで行う。

- **一般 API の階層化**
  `TieredUserRateThrottle` (現状は親 `UserRateThrottle` と同挙動) を
  `user_tier_1/2/3` に分割し、Tweet 以外の POST API にも段階を導入する。

## 関連

- SPEC §14.5 — throttle 階層の仕様
- `apps/common/throttling.py` — 実装
- `apps/common/tests/test_throttling.py` — テスト
- `apps/moderation/tasks.py` — Phase 2 Beat タスクの skeleton
- P1-08 (Tweet API) — `PostTweetThrottle` を実際に view に付ける Issue
