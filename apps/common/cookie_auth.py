import logging

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import AuthUser, JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import Token

logger = logging.getLogger(__name__)


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):  # type: ignore[override]
        # デフォルト実装は HttpResponseForbidden を返すが、DRF 上では例外で上げる。
        return reason


def _enforce_csrf_for_request(request: Request) -> None:
    """DRF の `@csrf_exempt` をバイパスして CSRF enforcement を走らせる共通関数."""

    def _dummy_get_response(_request):  # pragma: no cover
        return None

    check = _CSRFCheck(_dummy_get_response)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


class CSRFEnforcingAuthentication(BaseAuthentication):
    """Pre-auth エンドポイント (login / refresh) 向けの CSRF 強制用 Authentication class.

    code-reviewer (PR #131 HIGH #1) 指摘対応:
      `/cookie/create/` や `/cookie/refresh/` のように、認証前なのに state を変更する
      エンドポイントは `SessionAuthentication` の CSRF enforcement に乗せられない
      (SessionAuthentication は user を session から解決できない限り enforce_csrf を
      呼ばないため)。DRF の `APIView.as_view()` 由来の `@csrf_exempt` も併発するため、
      認証クラス側で CSRF を強制する以外に経路が無い。

      この Authentication は user を返さず (常に `None`)、unsafe method 時にだけ
      CSRF token を検証する。permission_classes や後段の認証をブロックしない副作用
      の小さい実装。
    """

    def authenticate(self, request: Request) -> None:
        if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
            return None
        _enforce_csrf_for_request(request)
        return None


class CookieAuthentication(JWTAuthentication):
    """HttpOnly Cookie から JWT を読んで認証するための DRF Authentication class.

    code-reviewer (PR #131 HIGH #1) 指摘対応:
      DRF の `APIView.as_view()` は内部で `@csrf_exempt` を付与するため、Django の
      CSRF middleware は view に届かない。`JWTAuthentication` 系は `enforce_csrf()` を
      呼ばないので、Cookie 経由の認証 (SameSite=Lax で cross-site の副作用を制限
      しているとは言え) で CSRF 保護が実質機能しなくなる。

      「Cookie からトークンを読めた場合に限り CSRF enforcement を走らせる」挙動を
      ここで強制する。Authorization header 経由のアクセスは CSRF 対象外 (cross-site
      では Cookie と違って勝手に送られないため)。
    """

    def authenticate(self, request: Request) -> tuple[AuthUser, Token] | None:
        header = self.get_header(request)
        raw_token = None
        from_cookie = False

        if header is not None:
            raw_token = self.get_raw_token(header)
        elif settings.COOKIE_NAME in request.COOKIES:
            raw_token = request.COOKIES.get(settings.COOKIE_NAME)
            from_cookie = True

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
        except TokenError as e:
            logger.error(f"Token validation error: {e!s}")
            return None

        if from_cookie:
            # Cookie 経由でしか JWT が届かないケースに限り CSRF を enforcement する。
            # 不要な二重チェックを避けるため header 経由は素通し。
            _enforce_csrf_for_request(request)

        return user, validated_token
