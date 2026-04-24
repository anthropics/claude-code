import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from djoser.social.views import ProviderAuthView
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.common.cookie_auth import CookieAuthentication, CSRFEnforcingAuthentication
from apps.users.s3_presign import generate_presigned_upload_url
from apps.users.serializers import (
    CustomUserSerializer,
    PublicProfileSerializer,
    UploadUrlRequestSerializer,
)

logger = logging.getLogger(__name__)

User = get_user_model()


class LoginRateThrottle(AnonRateThrottle):
    """login ブルートフォース対策 scope.

    code-reviewer (PR #131 HIGH #2) 指摘: /cookie/create/ は throttle が効いていない
    (DEFAULT_THROTTLE_RATES に相当 scope が無く、`throttle_classes` 未指定)。
    settings.base の DEFAULT_THROTTLE_RATES に `login: "5/minute"` を入れてここで参照する。
    """

    scope = "login"


class AvatarUploadRateThrottle(UserRateThrottle):
    """avatar / header presigned URL 発行用の dedicated throttle.

    code-reviewer (PR #139 HIGH #1) 指摘: /users/me/{avatar,header}-upload-url/ は
    既定の "user" scope (500/day) に乗っていたが、画像 upload URL 発行は少なくとも
    分単位の高頻度抑制が必要 (短時間の大量発行で S3 上に孤立オブジェクトが量産される
    / credentials rotation 前の大量署名リスク)。settings.base の
    DEFAULT_THROTTLE_RATES に ``avatar_upload: "10/minute"`` を入れてここで参照する。
    """

    scope = "avatar_upload"


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
    response.set_cookie(settings.COOKIE_NAME, access_token, **cookie_settings)

    if refresh_token:
        refresh_token_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()
        refresh_cookie_settings = cookie_settings.copy()
        refresh_cookie_settings["max_age"] = refresh_token_lifetime
        response.set_cookie(
            settings.REFRESH_COOKIE_NAME,
            refresh_token,
            **refresh_cookie_settings,
        )

    logged_in_cookie_settings = cookie_settings.copy()
    logged_in_cookie_settings["httponly"] = False
    response.set_cookie("logged_in", "true", **logged_in_cookie_settings)


def _delete_auth_cookie(response: Response, name: str) -> None:
    """Cookie を `samesite` / `secure` 属性込みで期限切れに設定する.

    code-reviewer (PR #131 MEDIUM #3) 指摘: Django の `HttpResponse.delete_cookie` は
    Django 4.2 で `samesite` を受けるが、`secure` 属性は Cookie 設定時の属性と
    揃っていないと一部ブラウザ (特に Safari) で削除が反映されない。
    `set_cookie` に max_age=0 + expires 過去 を使い、設定と一致した属性で明示的に
    delete 指示する。
    """

    response.set_cookie(
        name,
        "",
        max_age=0,
        path=settings.COOKIE_PATH,
        secure=settings.COOKIE_SECURE,
        httponly=settings.COOKIE_HTTPONLY,
        samesite=settings.COOKIE_SAMESITE,
    )


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


class GoogleCookieAuthView(ProviderAuthView):
    """Google OAuth2 callback 処理の Cookie 版 (P1-12 / ADR-0003 / SPEC §1.2).

    djoser 標準の ``ProviderAuthView`` は ``POST /api/v1/auth/o/google-oauth2/?
    code=...&state=...`` の成功時に ``{access, refresh, user}`` を JSON body
    で返す。本プロジェクトは ADR-0003 で「JWT は JS から読めない HttpOnly
    Cookie のみで運搬する」方針のため、本 view は super() の結果から token
    を取り出し ``set_auth_cookies`` で Cookie に載せ換え、レスポンス body
    からは ``access`` / ``refresh`` を除去する。

    security-reviewer #84 (SOCIAL_AUTH_PIPELINE) 対応:
        ``associate_by_email`` はパイプラインから除外済みのため、Google OAuth
        で初来訪したメールアドレスは常に ``create_user`` で新規ユーザーとして
        作成される。既存 djoser ユーザーへの Google 連携は別途 settings 画面
        経由で実装する (本 Issue では実装しない)。

    互換:
        旧 ``CustomProviderAuthView`` (``/o/<provider>/``) は message 付き body
        も残す既存挙動のため、移行期間中は両立させる。新規 frontend は
        ``/o/google-oauth2/cookie/`` を使う。

    code-reviewer (PR #138) 指摘対応:
        - ``provider_name`` クラス属性は djoser / social-auth から参照されない
          (``ProviderAuthSerializer.validate()`` が URL kwargs["provider"] を
          使うため)。混乱を避けるため削除し、URL 側で ``<provider>`` を
          キャプチャする。
        - CSRF 保護: 他の Cookie 系 view と揃えて ``CSRFEnforcingAuthentication``
          を前段に置く (未認証 POST でも CSRF token を必須化)。
        - Brute-force 対策: ``LoginRateThrottle`` (5/minute) を適用する。
    """

    authentication_classes = [CSRFEnforcingAuthentication]
    throttle_classes = [LoginRateThrottle]

    def post(self, request: Request, *args, **kwargs) -> Response:
        provider_res = super().post(request, *args, **kwargs)

        # ProviderAuthView は成功時 201 CREATED を返す仕様。それ以外 (400/401)
        # はエラーのままパススルーする。
        if provider_res.status_code != status.HTTP_201_CREATED:
            return provider_res

        access_token = provider_res.data.get("access")
        refresh_token = provider_res.data.get("refresh")
        user_payload = provider_res.data.get("user")

        if not (access_token and refresh_token):
            logger.error("Access or refresh token not found in Google OAuth response")
            return provider_res

        response = Response(
            {
                "user": user_payload,
                "detail": "Google OAuth login successful",
            },
            status=status.HTTP_200_OK,
        )
        set_auth_cookies(
            response,
            access_token=access_token,
            refresh_token=refresh_token,
        )
        return response


class LogoutAPIView(APIView):
    """旧 logout view (ADR-0003 移行期間中の互換目的).

    code-reviewer (PR #131 LOW) 指摘: 旧 view も新 `LogoutView` と同じく refresh を
    blacklist に登録しておく。これで旧クライアントが混在する移行期間中に blacklist が
    揃わず rotation 済みトークンが検知できない、というずれを防ぐ。
    新規 frontend / 自動テストは `/cookie/logout/` (LogoutView) を使うこと。
    """

    # code-reviewer (PR #131 HIGH #1) 指摘対応: CookieAuthentication が Cookie 経由で
    # 認証されたときに自ら enforce_csrf を呼ぶため、ここで追加のクラスは不要だが、
    # 未認証 state 変更 POST でも CSRF token を必須にするため CSRFEnforcingAuthentication
    # を前段に置いておく。
    authentication_classes = [CSRFEnforcingAuthentication, CookieAuthentication]

    def post(self, request: Request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError as exc:
                logger.warning("Legacy logout called with invalid refresh token: %s", exc)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        _delete_auth_cookie(response, settings.COOKIE_NAME)
        _delete_auth_cookie(response, settings.REFRESH_COOKIE_NAME)
        _delete_auth_cookie(response, "logged_in")
        return response


# ---------------------------------------------------------------------------
# P1-12a: HttpOnly Cookie 専用の login / refresh / logout (ADR-0003 準拠)
#
# security-reviewer (PR #83 HIGH) 指摘:
#   djoser の /users/activation/ は email 経由のリンクから叩かれる可能性があり、
#   activation endpoint 自体で JWT を発行すると CSRF / メール転送でログイン状態を
#   奪取できるリスクがある。よって activation と login は明示的に分け、login は
#   必ず email + password (+ CSRF token) の POST で行うフローとする。
#
# 既存の CustomTokenObtainPairView / CustomTokenRefreshView / LogoutAPIView は
# ADR-0003 移行期間中の互換目的で残すが、新しい frontend / 試験はこちらを使う。
#
# code-reviewer (PR #131 HIGH #1) 指摘:
#   DRF の `APIView.as_view()` は内部で `@csrf_exempt` を付与しており、
#   `JWTAuthentication` / `CookieAuthentication` は `enforce_csrf()` を呼ばない。
#   そのため、Cookie ベース認証のエンドポイントに対して CSRF 保護が実質機能しない。
#   対策:
#     1. 認証済みリクエストは `CookieAuthentication` 自身が Cookie 経由で JWT を
#        読めた場合に `enforce_csrf()` を呼ぶように修正 (apps/common/cookie_auth.py)。
#     2. 未認証のまま状態変更する /cookie/create/ /cookie/refresh/ には
#        `CSRFEnforcingAuthentication` を前段に置き、unsafe method 時にのみ
#        CSRF token を検証する。
# ---------------------------------------------------------------------------


class CookieTokenObtainView(TokenObtainPairView):
    """email + password で Cookie に JWT を載せる login view.

    レスポンス body に access/refresh を含めない (JS から JWT を読めないようにする)。
    """

    # CSRF enforcement のために CSRFEnforcingAuthentication を追加 (code-reviewer HIGH #1)。
    # SessionAuthentication は「認証済み session user」があるときしか enforce_csrf を
    # 走らせないため、未ログイン state 変更 POST に CSRF token を強制できない。
    authentication_classes = [CSRFEnforcingAuthentication]
    # ブルートフォース対策 (code-reviewer HIGH #2): 5/minute。
    throttle_classes = [LoginRateThrottle]

    def post(self, request: Request, *args, **kwargs) -> Response:
        token_res = super().post(request, *args, **kwargs)

        if token_res.status_code != status.HTTP_200_OK:
            return token_res

        access_token = token_res.data.get("access")
        refresh_token = token_res.data.get("refresh")

        if not (access_token and refresh_token):
            logger.error("Access or refresh token not found in login response data")
            return token_res

        response = Response(
            {"detail": "Login successful"},
            status=status.HTTP_200_OK,
        )
        set_auth_cookies(
            response,
            access_token=access_token,
            refresh_token=refresh_token,
        )
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """Cookie から refresh token を読み、ローテ後の新 access/refresh を Cookie に再 set する.

    `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True` なので、旧 refresh は
    blacklist に追加され再利用不可。

    code-reviewer (PR #131 MEDIUM #7) 指摘:
      元実装は `request.data["refresh"] = ...` で引数を上書きしていたが、
      multipart/form-data リクエストでは `request.data` が immutable な `QueryDict`
      で `TypeError` が発生し得る。Cookie 経由の JWT フローは常に JSON のみを使う
      仕様 (frontend も fetch で `Content-Type: application/json` を送る) なので、
      parser を JSON のみに限定し、さらに超えて dict を新規生成して serializer に
      渡すことで immutable/mutable 問題自体を回避する。
    """

    # CSRF enforcement のために CSRFEnforcingAuthentication を追加 (code-reviewer HIGH #1)。
    authentication_classes = [CSRFEnforcingAuthentication]
    # Cookie 経由の JWT refresh は JSON ボディ専用にする (MEDIUM #7)。
    parser_classes = [JSONParser]

    def post(self, request: Request, *args, **kwargs) -> Response:
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)

        if refresh_token is None:
            # Cookie が無い場合のみ parent に委譲 (parent が 400 を返す)。
            return super().post(request, *args, **kwargs)

        # simplejwt の serializer を直接叩いて `request.data` を汚染しない。
        # blacklist 済 / 期限切れ / 不正 token は `TokenError` で上がってくるので、
        # 親 view と同じ挙動 (401 InvalidToken) に揃える。
        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        access_token = serializer.validated_data.get("access")
        new_refresh_token = serializer.validated_data.get("refresh")

        if not access_token:
            logger.error("Access token not found in refresh response data")
            return Response(
                {"detail": "Access token not issued"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response = Response(
            {"detail": "Token refreshed"},
            status=status.HTTP_200_OK,
        )
        set_auth_cookies(
            response,
            access_token=access_token,
            refresh_token=new_refresh_token,
        )
        return response


class LogoutView(APIView):
    """認証済みユーザーのみ logout を許可し、refresh を blacklist に登録する.

    - permission_classes = [IsAuthenticated]: 未ログイン状態でログアウトを叩くのは
      操作として無意味、かつ refresh cookie が偽物だった場合は blacklist 処理が
      不要 (むしろ攻撃ベクタになり得る) ため。
    - Cookie は max_age=0 で削除。
    - refresh は blacklist に追加 (rotation 以降の再利用も防ぐ)。
    """

    # code-reviewer (PR #131 HIGH #1): CookieAuthentication 自身が Cookie 経由認証時に
    # CSRF enforcement を走らせる。追加で前段に CSRFEnforcingAuthentication を置くことで、
    # Cookie が無い (既に失効した) 状態の POST にも CSRF 保護を行き届かせる。
    authentication_classes = [CSRFEnforcingAuthentication, CookieAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, *args, **kwargs) -> Response:
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError as exc:
                # 期限切れ / 不正 token は既にログアウト相当なので握り潰さず warn に留める。
                logger.warning("Logout called with invalid refresh token: %s", exc)

        response = Response(
            {"detail": "Logged out"},
            status=status.HTTP_200_OK,
        )
        _delete_auth_cookie(response, settings.COOKIE_NAME)
        _delete_auth_cookie(response, settings.REFRESH_COOKIE_NAME)
        _delete_auth_cookie(response, "logged_in")
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


# ---------------------------------------------------------------------------
# P1-04: avatar / header 画像 S3 アップロード URL 発行 (SPEC §2)
# ---------------------------------------------------------------------------


class _BaseUploadUrlView(APIView):
    """avatar / header で共通する presigned URL 発行ロジック.

    サブクラスは ``kind`` を上書きするだけ。重複したコードを避けるため
    本体の ``post()`` をここに置き、サブクラスは `kind` 属性のみ持つ。

    認証 / CSRF / Throttle:
      - ``CSRFEnforcingAuthentication``: 未認証でも unsafe method に CSRF を強制。
      - ``CookieAuthentication``: Cookie 経由で JWT を読み、user を解決 + enforce CSRF。
      - ``IsAuthenticated``: 自分のアップロード先 URL を発行するため認証必須。
      - ``AvatarUploadRateThrottle``: 既定の "user" scope から分離した dedicated
        throttle (10/minute)。孤立オブジェクト量産や署名濫用を抑制する
        (code-reviewer PR #139 HIGH #1)。
    """

    # サブクラスで "avatar" or "header" に上書きする。
    kind: str = ""

    authentication_classes = [CSRFEnforcingAuthentication, CookieAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [AvatarUploadRateThrottle]
    http_method_names = ["post", "head", "options"]

    def post(self, request: Request, *args, **kwargs) -> Response:
        # 1. body validation (content_type / content_length)。
        request_serializer = UploadUrlRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        # 2. presigned URL 発行。s3_presign 側で ValidationError が上がった場合は
        #    DRF の標準 exception handler で 400 になる。
        result = generate_presigned_upload_url(
            user_id=request.user.pk,
            kind=self.kind,
            content_type=request_serializer.validated_data["content_type"],
            content_length=request_serializer.validated_data["content_length"],
        )

        # 3. 監査ログ (code-reviewer PR #139 MEDIUM #3)。署名された upload_url 本体は
        #    機密扱い (クエリに credential が含まれる) なので object_key のみ残す。
        #    孤立オブジェクト調査や濫用検知に使える最小情報。
        logger.info(
            "Presigned upload URL issued: user_id=%s kind=%s object_key=%s",
            request.user.pk,
            self.kind,
            result.object_key,
        )

        # 4. object_key / upload_url / expires_at / public_url を返す。
        return Response(result.to_dict(), status=status.HTTP_200_OK)


class AvatarUploadUrlView(_BaseUploadUrlView):
    """``POST /api/v1/users/me/avatar-upload-url/``: avatar 用 presigned URL 発行."""

    kind = "avatar"


class HeaderUploadUrlView(_BaseUploadUrlView):
    """``POST /api/v1/users/me/header-upload-url/``: header 用 presigned URL 発行."""

    kind = "header"
