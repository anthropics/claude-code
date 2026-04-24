from django.urls import path, re_path

from .views import (
    CookieTokenObtainView,
    CookieTokenRefreshView,
    CustomProviderAuthView,
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    LogoutAPIView,
    LogoutView,
)

urlpatterns = [
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
