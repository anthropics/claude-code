"""SPEC §14.5: Tweet 投稿レート階層 throttle。

DRF の ``ScopedRateThrottle`` を拡張し、ユーザー属性に応じて scope を
動的に切り替える。

階層定義 (``settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`` 参照):

- ``post_tweet_tier_1`` — 100/day (通常ユーザー)
- ``post_tweet_tier_2`` — 500/day (アクティブユーザー、Phase 2 で自動昇格)
- ``post_tweet_tier_3`` — 1000/day (プレミアム ``User.is_premium``)

Phase 1 (本 Issue #97) のスコープ:
    - tier 判定は ``is_premium`` のみ (True → tier_3、それ以外 → tier_1)。
    - tier_2 (active) は枠だけ確保し、判定ロジックは Phase 2 で追加する。
    - Celery Beat アラート側の骨組みは ``apps.moderation.tasks`` に置く。

Phase 2 (別 Issue) で予定している拡張:
    - 直近 7 日ツイート数 >= 20 等で tier_2 へ自動昇格させる。
    - 閾値の 80% に到達したユーザーを moderation queue に載せる Celery Beat。
    - ``TieredUserRateThrottle`` を Tweet 以外の一般 API にも段階適用する。
"""

from __future__ import annotations

from typing import Any, Final

from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.throttling import (
    ScopedRateThrottle,
    SimpleRateThrottle,
    UserRateThrottle,
)

# -----------------------------------------------------------------------------
# Scope 定数
# -----------------------------------------------------------------------------
# ``settings.DEFAULT_THROTTLE_RATES`` のキーと 1:1 で対応する。
# view 側 (P1-08) で ``throttle_scope = POST_TWEET_TIER_1`` のように参照するか、
# ``PostTweetThrottle`` が動的に決めるため、ハードコードの散在を防ぐ。
POST_TWEET_TIER_1: Final[str] = "post_tweet_tier_1"
POST_TWEET_TIER_2: Final[str] = "post_tweet_tier_2"
POST_TWEET_TIER_3: Final[str] = "post_tweet_tier_3"


def get_user_throttle_tier(user: AbstractBaseUser | AnonymousUser | None) -> str:
    """Tweet 投稿レート階層 scope 名を返す。

    Phase 1 では ``is_premium`` のみで判定する。
    Phase 2 で active ユーザー判定ロジック (直近 7 日 tweet count >= 20 等) を
    追加し、tier_2 昇格を実装する (TODO 参照)。

    Args:
        user: ``request.user``。``AnonymousUser`` や ``None`` も許容する。

    Returns:
        ``post_tweet_tier_1`` / ``post_tweet_tier_2`` / ``post_tweet_tier_3``
        のいずれか。未認証はすべて tier_1 にフォールバック
        (未認証は本来 Tweet POST できないが safety net として)。
    """
    # ``user`` が None / AnonymousUser のケースを同じ分岐で捌く。
    # is_authenticated は AnonymousUser でも False を返す契約なので、
    # getattr で安全に問い合わせる。
    if user is None or not getattr(user, "is_authenticated", False):
        return POST_TWEET_TIER_1

    # User モデル (apps/users/models.py) には is_premium が必ず存在する契約なので
    # 認証済みユーザーに対しては直接属性アクセスする。AnonymousUser/None は上の
    # 分岐で既に弾かれているため、ここに AnonymousUser が到達することはない。
    if user.is_premium:
        return POST_TWEET_TIER_3

    # TODO(Phase2): active ユーザー判定 (直近 7 日 tweet count >= 20 等) で
    # tier_2 昇格。判定は daily Celery Beat で計算しキャッシュに載せる想定。
    return POST_TWEET_TIER_1


class PostTweetThrottle(ScopedRateThrottle):
    """Tweet 投稿専用の階層化 throttle (SPEC §14.5)。

    view 側は次のように指定する::

        class TweetCreateView(CreateAPIView):
            throttle_classes = [PostTweetThrottle]
            # throttle_scope は PostTweetThrottle が動的に決めるので不要。

    ``ScopedRateThrottle.allow_request`` が ``getattr(view, self.scope_attr)``
    で scope を拾うため、``scope_attr`` はそのまま ``throttle_scope`` を使い、
    その代わりに ``allow_request`` で ``request.user`` から tier を算出して
    self.scope を上書きする。

    view 側で明示 ``throttle_scope`` を置きたい場合はそれを尊重するが、
    本 Issue の方針としては「view 側は何も書かなくても階層が効く」状態を既定に
    する (P1-08 で TweetCreateView が採用予定)。
    """

    # scope_attr は親クラスと同じ "throttle_scope" を踏襲する。
    # (テスト: test_post_tweet_throttle_scope_attr で契約を固定)
    scope_attr = "throttle_scope"

    def allow_request(self, request: Request, view: Any) -> bool:
        # 二重防御: Tweet 投稿エンドポイントは認証必須 (view 側で
        # IsAuthenticated を指定する契約)。万一 permission_classes の設定漏れで
        # AnonymousUser が到達した場合、ident が IP fallback になり他ユーザーと
        # bucket が衝突して誤 throttle / 誤通過が起きうるため、ここで明示拒否する。
        if not getattr(request.user, "is_authenticated", False):
            return False

        # view 側で throttle_scope が明示されていればそれを尊重する
        # (将来的な手動オーバーライドを許すため)。指定が無ければ user から算出。
        view_scope = getattr(view, self.scope_attr, None)
        if view_scope:
            self.scope = view_scope
        else:
            self.scope = get_user_throttle_tier(getattr(request, "user", None))

        # 親 ScopedRateThrottle.allow_request は self.scope が truthy なら
        # self.rate / num_requests / duration を再計算する。
        # ここでは self.scope は常に埋まっている前提で親のロジックに乗る。
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)

        # NOTE: ScopedRateThrottle.allow_request は scope=None で素通りする実装なので、
        # 祖先 (SimpleRateThrottle) の allow_request に明示委譲する。
        # DRF 内部実装 (MRO): PostTweetThrottle → ScopedRateThrottle
        #   → SimpleRateThrottle → BaseThrottle
        # 依存バージョン: djangorestframework (requirements/base.txt で pin 済み)
        # super(ScopedRateThrottle, self) だと MRO 上の次のクラス
        # (= SimpleRateThrottle) を参照するが、実体を明示するほうが読解しやすく、
        # MRO が将来変わった際のリグレッションを検知しやすいので直接指定する。
        return SimpleRateThrottle.allow_request(self, request, view)


class TieredUserRateThrottle(UserRateThrottle):
    """Tweet 投稿以外の一般 API 用の階層 throttle (Phase 2 で拡張)。

    本 Issue (#97) では **宣言のみ** で scope は既定の ``user`` のままにする。
    Phase 2 で Tweet と同様に tier 1/2/3 を切る予定。

    Note:
        今は親 ``UserRateThrottle`` の挙動とまったく同じ。利用側が
        ``TieredUserRateThrottle`` に差し替える準備をしておくことで、
        Phase 2 の配線差分を最小化する。
    """

    # 本 Issue ではあえて上書きしない。Phase 2 で tier_* に分割予定。
    scope = "user"
