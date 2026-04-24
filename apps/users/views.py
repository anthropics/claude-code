import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from djoser.social.views import ProviderAuthView
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.users.serializers import CustomUserSerializer, PublicProfileSerializer

logger = logging.getLogger(__name__)

User = get_user_model()


def set_auth_cookies(
    response: Response, access_token: str, refresh_token: str | None = None
) -> None:
    access_token_lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()
    cookie_settings = {
        "path": settings.COOKIE_PATH,
        "secure": settings.COOKIE_SECURE,
        "httponly": settings.COOKIE_HTTPONLY,
        "samesite": settings.COOKIE_SAMESITE,
        "max_age": access_token_lifetime,
    }
    response.set_cookie("access", access_token, **cookie_settings)

    if refresh_token:
        refresh_token_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()
        refresh_cookie_settings = cookie_settings.copy()
        refresh_cookie_settings["max_age"] = refresh_token_lifetime
        response.set_cookie("refresh", refresh_token, **refresh_cookie_settings)

    logged_in_cookie_settings = cookie_settings.copy()
    logged_in_cookie_settings["httponly"] = False
    response.set_cookie("logged_in", "true", **logged_in_cookie_settings)


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request: Request, *args, **kwargs) -> Response:
        token_res = super().post(request, *args, **kwargs)

        if token_res.status_code == status.HTTP_200_OK:
            access_token = token_res.data.get("access")
            refresh_token = token_res.data.get("refresh")

            if access_token and refresh_token:
                set_auth_cookies(
                    token_res,
                    access_token=access_token,
                    refresh_token=refresh_token,
                )

                token_res.data.pop("access", None)
                token_res.data.pop("refresh", None)

                token_res.data["message"] = "Login Successful."
            else:
                token_res.data["message"] = "Login Failed"
                logger.error("Access or refresh token not found in login response data")

        return token_res


class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request: Request, *args, **kwargs) -> Response:
        refresh_token = request.COOKIES.get("refresh")

        if refresh_token:
            request.data["refresh"] = refresh_token

        refresh_res = super().post(request, *args, **kwargs)

        if refresh_res.status_code == status.HTTP_200_OK:
            access_token = refresh_res.data.get("access")
            refresh_token = refresh_res.data.get("refresh")

            if access_token and refresh_token:
                set_auth_cookies(
                    refresh_res,
                    access_token=access_token,
                    refresh_token=refresh_token,
                )

                refresh_res.data.pop("access", None)
                refresh_res.data.pop("refresh", None)

                refresh_res.data["message"] = "Access tokens refreshed successfully"
            else:
                refresh_res.data["message"] = (
                    "Access or refresh tokens not found in refresh response data"
                )
                logger.error("Access or refresh token not found in refresh response data")

        return refresh_res


class CustomProviderAuthView(ProviderAuthView):
    def post(self, request: Request, *args, **kwargs) -> Response:
        provider_res = super().post(request, *args, **kwargs)

        if provider_res.status_code == status.HTTP_201_CREATED:
            access_token = provider_res.data.get("access")
            refresh_token = provider_res.data.get("refresh")

            if access_token and refresh_token:
                set_auth_cookies(
                    provider_res,
                    access_token=access_token,
                    refresh_token=refresh_token,
                )

                provider_res.data.pop("access", None)
                provider_res.data.pop("refresh", None)

                provider_res.data["message"] = "You are logged in Successful."
            else:
                provider_res.data["message"] = (
                    "Access or refresh token not found in provider response"
                )
                logger.error("Access or refresh token not found in provider response data")

        return provider_res


class LogoutAPIView(APIView):
    def post(self, request: Request, *args, **kwargs):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie("access")
        response.delete_cookie("refresh")
        response.delete_cookie("logged_in")
        return response


class MeView(APIView):
    """現在ログイン中ユーザーの完全プロフィール (SPEC §2)。

    - ``GET /api/v1/users/me/``: 完全プロフィール返却 (認証必須)
    - ``PATCH /api/v1/users/me/``: 可変フィールドを部分更新

    CustomUserSerializer の read_only_fields により
    username / email / is_premium / id / date_joined は PATCH しても
    silently drop される (DRF 標準挙動)。

    ``http_method_names`` を明示することで PUT / POST / DELETE を 405 で弾き、
    意図しない HTTP メソッドでの副作用を防ぐ (P1-03 review HIGH 対応)。
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get(self, request: Request, *args, **kwargs) -> Response:
        serializer = CustomUserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request: Request, *args, **kwargs) -> Response:
        serializer = CustomUserSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicProfileView(RetrieveAPIView):
    """公開プロフィール (SPEC §2.2)。

    ``GET /api/v1/users/<handle>/``: 未ログインでも閲覧可能。

    - ``is_active=False`` のユーザーは 404 として扱う (存在隠蔽)。
    - lookup は URL の ``username`` (= @handle) で大文字小文字を無視 (``iexact``) する。
      P1-02 の ``validate_handle`` は大文字小文字を区別しない予約語判定のみで、
      username 自体は小文字正規化されずに保存されるケースがあるため、
      URL から参照する際も case-insensitive で解決する (P1-03 review MEDIUM 対応)。
    - PublicProfileSerializer で email / is_premium 等の内部 flag を除外する。
    - ``queryset`` をクラス属性で持つと Django 起動時に評価された同一 QuerySet が
      全リクエストで再利用されてしまい、テスト DB のリセットと相性が悪い。
      ``get_queryset()`` に移してリクエストごとに評価する (P1-03 review HIGH 対応)。
    """

    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny]
    lookup_field = "username"
    lookup_url_kwarg = "username"
    # Django ORM の ``__iexact`` lookup を使うため、DRF の ``lookup_field`` では
    # 表現できない。代わりに ``get_object()`` を override する。

    def get_queryset(self):
        return User.objects.filter(is_active=True)

    def get_object(self):
        """username の大文字小文字を無視して解決する。

        DRF 標準の ``get_object()`` は ``filter(**{lookup_field: value})`` と
        完全一致で引くため、``username__iexact`` を使うにはここで override する。
        """
        queryset = self.filter_queryset(self.get_queryset())
        username = self.kwargs[self.lookup_url_kwarg]
        obj = get_object_or_404(queryset, username__iexact=username)
        self.check_object_permissions(self.request, obj)
        return obj
