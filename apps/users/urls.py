from django.urls import path, re_path

from .views import (
    CookieTokenObtainView,
    CookieTokenRefreshView,
    CustomProviderAuthView,
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    GoogleCookieAuthView,
    LogoutAPIView,
    LogoutView,
)

urlpatterns = [
    # P1-12: Google OAuth の Cookie 版 (ADR-0003 準拠).
    # 下の汎用 re_path (``^o/(?P<provider>\S+)/$``) は ``\S+`` が greedy なため
    # ``google-oauth2/cookie`` を provider 名として誤吸収し得る。URLResolver は
    # 登録順に patterns を走査するので、より具体的な re_path を先に置く。
    #
    # code-reviewer (PR #138 CRITICAL) 指摘対応:
    #   djoser の ``ProviderAuthSerializer.validate()`` は
    #   ``self.context["view"].kwargs["provider"]`` を参照する。URL pattern に
    #   ``<provider>`` キャプチャが存在しないと本番で ``KeyError: 'provider'``
    #   → 500 になるため、静的 path ではなく ``<provider>`` キャプチャ付きの
    #   re_path にする。正規表現で ``google-oauth2`` に限定することで、
    #   他プロバイダが誤って本エンドポイントにヒットしないようにする。
    re_path(
        r"^o/(?P<provider>google-oauth2)/cookie/$",
        GoogleCookieAuthView.as_view(),
        name="google-oauth-cookie",
    ),
    re_path(
        r"^o/(?P<provider>\S+)/$",
        CustomProviderAuthView.as_view(),
        name="provider-auth",
    ),
    # 旧 login/refresh/logout は ADR-0003 移行期間の互換目的で残す。
    # 新規 frontend / 自動テストは /cookie/* を使うこと。
    path("login/", CustomTokenObtainPairView.as_view()),
    path("refresh/", CustomTokenRefreshView.as_view()),
    path("logout/", LogoutAPIView.as_view()),
    # P1-12a: 新 Cookie 専用フロー (security-reviewer #83 対応)
    path(
        "cookie/create/",
        CookieTokenObtainView.as_view(),
        name="cookie-token-obtain",
    ),
    path(
        "cookie/refresh/",
        CookieTokenRefreshView.as_view(),
        name="cookie-token-refresh",
    ),
    path(
        "cookie/logout/",
        LogoutView.as_view(),
        name="cookie-logout",
    ),
]
