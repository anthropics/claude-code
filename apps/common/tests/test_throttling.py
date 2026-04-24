"""P1-11 (#97) throttle 階層 (SPEC §14.5) のテスト。

テスト方針:
    - ``get_user_throttle_tier`` を純粋関数として単体テスト (DB 接続なし)
    - ``PostTweetThrottle`` を RequestFactory で view / user を作り込む
    - ``settings.DEFAULT_THROTTLE_RATES`` に tier_1..3 が定義されている契約を確認
    - 超過時に ``allow_request`` が False を返す (= DRF が 429 を返す) 挙動を確認
    - tier_3 (premium) は tier_1 上限を超えてリクエストできることを確認

Note:
    DRF の throttle cache は ``django.core.cache`` のデフォルトを使う。
    LocMemCache は process ごとに分離するので test 間の汚染リスクは低いが、
    念のため各テストで cache.clear() する。
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.test import RequestFactory
from rest_framework.throttling import ScopedRateThrottle

from apps.common.throttling import (
    POST_TWEET_TIER_1,
    POST_TWEET_TIER_2,
    POST_TWEET_TIER_3,
    PostTweetThrottle,
    TieredUserRateThrottle,
    get_user_throttle_tier,
)

# -----------------------------------------------------------------------------
# 純粋関数 get_user_throttle_tier
# -----------------------------------------------------------------------------


@pytest.mark.unit
class TestGetUserThrottleTier:
    def test_anonymous_user_gets_tier_1_scope(self) -> None:
        # Arrange
        user = AnonymousUser()

        # Act
        tier = get_user_throttle_tier(user)

        # Assert: 未認証は safety net として tier_1。
        assert tier == POST_TWEET_TIER_1

    def test_none_user_gets_tier_1_scope(self) -> None:
        # Arrange: request.user が None のケース (middleware 差し込み漏れの safety net)。
        # Act / Assert
        assert get_user_throttle_tier(None) == POST_TWEET_TIER_1

    def test_regular_user_gets_tier_1_scope(self) -> None:
        # Arrange: is_authenticated=True, is_premium=False の MagicMock。
        # DB を触らずに user の属性だけをシミュレートする。
        user = MagicMock()
        user.is_authenticated = True
        user.is_premium = False

        # Act
        tier = get_user_throttle_tier(user)

        # Assert
        assert tier == POST_TWEET_TIER_1

    def test_premium_user_gets_tier_3_scope(self) -> None:
        # Arrange
        user = MagicMock()
        user.is_authenticated = True
        user.is_premium = True

        # Act
        tier = get_user_throttle_tier(user)

        # Assert
        assert tier == POST_TWEET_TIER_3


# -----------------------------------------------------------------------------
# PostTweetThrottle クラスの契約
# -----------------------------------------------------------------------------


@pytest.mark.unit
class TestPostTweetThrottleContract:
    def test_post_tweet_throttle_scope_attr(self) -> None:
        # 親 ScopedRateThrottle の contract を踏襲していること。
        # view 側で throttle_scope を明示したいケース (手動オーバーライド) でも
        # 期待通りに拾えるため。
        assert PostTweetThrottle.scope_attr == "throttle_scope"

    def test_is_subclass_of_scoped_rate_throttle(self) -> None:
        # DRF の契約 (allow_request / get_cache_key) を継承していること。
        assert issubclass(PostTweetThrottle, ScopedRateThrottle)

    def test_rates_are_loaded_from_settings(self) -> None:
        # Arrange
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]

        # Assert: tier 1..3 のキーがすべて定義され、SPEC §14.5 の数値と一致する。
        assert rates[POST_TWEET_TIER_1] == "100/day"
        assert rates[POST_TWEET_TIER_2] == "500/day"
        assert rates[POST_TWEET_TIER_3] == "1000/day"


# -----------------------------------------------------------------------------
# PostTweetThrottle の allow_request (rate limiting) の挙動
# -----------------------------------------------------------------------------


def _make_view() -> MagicMock:
    """throttle_scope 未指定の view mock (PostTweetThrottle に自動判定させる)。"""
    view = MagicMock()
    # spec をゆるめに: getattr(view, "throttle_scope", None) が None になるよう
    # 属性を削除。
    del view.throttle_scope
    return view


@pytest.mark.unit
class TestPostTweetThrottleAllowRequest:
    def setup_method(self) -> None:
        # 他テストとの cache 汚染を避ける。
        cache.clear()
        self.factory = RequestFactory()

    def teardown_method(self) -> None:
        cache.clear()

    def _make_request(self, user) -> object:
        request = self.factory.post("/api/tweets/")
        request.user = user
        return request

    def test_regular_user_is_throttled_after_tier_1_limit(self) -> None:
        """通常ユーザーは tier_1 (100/day) 上限に達した直後のリクエストで拒否されること。

        実装的には "cache に 100 件の履歴を積んだ状態 = ちょうど上限に達した状態"
        を人為的に作り、その次に来る 101 件目相当のリクエストで
        ``allow_request`` が False を返すことを確認する。100 回本物のループを
        回すのは slow なので、DRF の内部 key (``throttle.key``) を直接 seed する。
        """
        # Arrange: is_premium=False → tier_1 = 100/day。
        user = MagicMock()
        user.is_authenticated = True
        user.is_premium = False
        user.pk = 42

        request = self._make_request(user)
        view = _make_view()

        throttle = PostTweetThrottle()
        # 1 回目: 素通り。ここで self.key / self.duration が確定する。
        assert throttle.allow_request(request, view) is True

        # Arrange: cache 上で 100 件すでに積まれている状態 = 上限到達を再現。
        # allow_request が最後に計算した self.key を再利用できる。
        full_history = [throttle.now] * 100
        cache.set(throttle.key, full_history, throttle.duration)

        # Act: 上限到達後の次の (= 101 件目相当) request。
        throttle2 = PostTweetThrottle()
        allowed = throttle2.allow_request(self._make_request(user), view)

        # Assert: 拒否される (= DRF が 429 + Retry-After を返すフック)。
        assert allowed is False
        # wait() が None 以外 (= Retry-After 計算可能) を返すこと。
        assert throttle2.wait() is not None

    def test_anonymous_request_is_denied_immediately(self) -> None:
        """AnonymousUser が到達したら scope 解決前に拒否すること (二重防御)。

        view 側で IsAuthenticated が正しく設定されていれば本来ここには到達しない
        が、設定漏れなどで AnonymousUser が流れ込んだ場合、IP bucket が別ユーザー
        と衝突して誤 throttle / 誤通過が起きるため、allow_request の冒頭で
        明示的に False を返す契約を固定する。
        """
        # Arrange: 未認証ユーザー。
        request = self._make_request(AnonymousUser())
        view = _make_view()

        # Act
        throttle = PostTweetThrottle()
        allowed = throttle.allow_request(request, view)

        # Assert: 冒頭の認証チェックで即拒否され、cache / scope に副作用が
        # 残らないこと。
        assert allowed is False

    def test_premium_user_can_exceed_tier_1_limit(self) -> None:
        """premium ユーザーは tier_1 (100) を超えても tier_3 (1000) 上限まで通ること。"""
        # Arrange
        user = MagicMock()
        user.is_authenticated = True
        user.is_premium = True
        user.pk = 7

        # tier_1 相当の 100 件分を premium ユーザーの tier_3 bucket に積んで "超えても通る" を確認。
        # 先に 1 回 allow_request して self.key を決定させる。
        throttle = PostTweetThrottle()
        assert throttle.allow_request(self._make_request(user), _make_view()) is True
        # tier_3 のスコープで request が記録されていることを scope 経由で確認。
        assert throttle.scope == POST_TWEET_TIER_3

        # Arrange: tier_1 上限 (100) と同じ件数を積んでも、tier_3 (1000) では
        # まだ余裕があるので通るはず。
        cache.set(throttle.key, [throttle.now] * 100, throttle.duration)

        throttle2 = PostTweetThrottle()
        allowed = throttle2.allow_request(self._make_request(user), _make_view())

        assert allowed is True
        # tier_3 bucket で計算されたこと。
        assert throttle2.scope == POST_TWEET_TIER_3
        # tier_3 の rate が設定どおりに読まれていること。
        assert throttle2.rate == "1000/day"

    def test_view_scope_override_is_respected(self) -> None:
        """view 側に throttle_scope が明示されている場合はそれを尊重する。"""
        # Arrange
        user = MagicMock()
        user.is_authenticated = True
        user.is_premium = False  # 通常なら tier_1
        user.pk = 99

        view = MagicMock()
        view.throttle_scope = POST_TWEET_TIER_2  # 手動で tier_2 に上げる。

        # Act
        throttle = PostTweetThrottle()
        assert throttle.allow_request(self._make_request(user), view) is True

        # Assert: view のオーバーライドが勝つ。
        assert throttle.scope == POST_TWEET_TIER_2
        assert throttle.rate == "500/day"


# -----------------------------------------------------------------------------
# TieredUserRateThrottle (本 Issue では宣言のみ)
# -----------------------------------------------------------------------------


@pytest.mark.unit
class TestTieredUserRateThrottleDeclaration:
    def test_scope_is_still_user_for_phase_1(self) -> None:
        # Phase 1 では親 UserRateThrottle と同じ scope を維持する。
        # Phase 2 で tier_* に分割する予定。
        assert TieredUserRateThrottle.scope == "user"
