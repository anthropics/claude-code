"""Views for the tweets CRUD API (P1-08).

SPEC §3 を満たす Tweet の CRUD エンドポイントを ``ModelViewSet`` で提供する。

エンドポイント一覧 (ベース: ``/api/v1/tweets/``):
    - ``POST   /``         — 作成 (IsAuthenticated + CSRF + PostTweetThrottle)
    - ``GET    /``         — 一覧 (AllowAny, author / tag / pagination)
    - ``GET    /<id>/``    — 取得 (AllowAny, tombstone 対応)
    - ``PATCH  /<id>/``    — 編集 (IsAuthenticated + 本人のみ + CSRF)
    - ``DELETE /<id>/``    — 削除 (IsAuthenticated + 本人のみ + CSRF, soft-delete)

設計方針:
    - **論理削除**: 一覧/作成/更新/削除は ``Tweet.objects`` (alive) に限定。
      retrieve だけは ``Tweet.all_objects`` から引いて ``is_deleted=True`` の時に
      410 Gone (tombstone) を返す (§3.9 論理削除の仕様)。
    - **認証と CSRF**: Cookie で JWT を受けた場合に限り CSRF enforcement を
      走らせるため、state 変更系 (create/update/destroy) には
      ``CSRFEnforcingAuthentication`` と ``CookieAuthentication`` を明示指定する。
      read 系 (list/retrieve) は ``authentication_classes`` を最小化 (非 cookie
      な Authorization ヘッダでの閲覧を許容) する。
    - **throttle**: create のみ ``PostTweetThrottle`` (階層 100/500/1000/day)。
      update/destroy は DRF デフォルト (UserRateThrottle) が自動適用される。
"""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.common.cookie_auth import CookieAuthentication
from apps.common.throttling import PostTweetThrottle
from apps.tweets.managers import TweetQuerySet
from apps.tweets.models import Tweet
from apps.tweets.serializers import (
    TweetCreateSerializer,
    TweetDetailSerializer,
    TweetListSerializer,
    TweetUpdateSerializer,
)

# Action 定数 (マジックストリング排除)
ACTION_LIST = "list"
ACTION_RETRIEVE = "retrieve"
ACTION_CREATE = "create"
ACTION_UPDATE = "update"
ACTION_PARTIAL_UPDATE = "partial_update"
ACTION_DESTROY = "destroy"

_READ_ACTIONS = frozenset({ACTION_LIST, ACTION_RETRIEVE})


class TweetViewSet(viewsets.ModelViewSet):
    """Tweet CRUD の ModelViewSet (SPEC §3)。

    action ごとに serializer / permission / authentication / throttle を切り替える。
    """

    # 既定 queryset: alive のみ。retrieve だけは all_objects を使うので override する。
    queryset = Tweet.objects.all()

    # PK は ID (int)。Django 既定の ``pk`` を明示指定することで lookup_url_kwarg
    # の整合を取る。
    lookup_field = "pk"

    # ------------------------------------------------------------------
    # 1. Serializer / Permission / Authentication / Throttle の切替
    # ------------------------------------------------------------------

    def get_serializer_class(self) -> type[drf_serializers.Serializer]:
        if self.action == ACTION_LIST:
            return TweetListSerializer
        if self.action == ACTION_RETRIEVE:
            return TweetDetailSerializer
        if self.action == ACTION_CREATE:
            return TweetCreateSerializer
        if self.action in (ACTION_UPDATE, ACTION_PARTIAL_UPDATE):
            return TweetUpdateSerializer
        # destroy は serializer 不要だが DRF が呼ぶので何か返す
        return TweetListSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in _READ_ACTIONS:
            return [AllowAny()]
        # create / update / partial_update / destroy
        return [IsAuthenticated()]

    # 認証は CookieAuthentication に一本化する。
    # - Cookie で届いた JWT を復号しつつ、**Cookie 経由の時だけ** CSRF enforcement を走らせる
    #   (``apps.common.cookie_auth.CookieAuthentication.authenticate`` 参照)。
    # - Authorization ヘッダ経由 (SPA 外のツールや Swagger) は CSRF 対象外
    #   (cross-site からは ``Authorization`` ヘッダが自動付与されないため)。
    # - 未認証で state 変更系を叩いた場合は ``IsAuthenticated`` → 401 を返す。
    #   (CSRFEnforcingAuthentication を前段に置くと未認証でも 403 になってしまい、
    #    "認証されていない" 情報が "CSRF 失敗" に紛れてしまうので避ける。)
    authentication_classes = [CookieAuthentication]

    def get_throttles(self) -> list[Any]:
        """create のみ PostTweetThrottle を適用する。

        update/destroy は DRF デフォルトの UserRateThrottle (500/day) を
        settings 側で自動適用する。list/retrieve は AnonRateThrottle が
        settings から自動適用される。
        """
        if self.action == ACTION_CREATE:
            return [PostTweetThrottle()]
        return super().get_throttles()

    # ------------------------------------------------------------------
    # 2. Queryset filter (list)
    # ------------------------------------------------------------------

    def get_queryset(self) -> TweetQuerySet:
        """``?author=<username>`` と ``?tag=<name>`` のクエリフィルタを適用する。

        ``created_at desc`` は Tweet.Meta.ordering で既定。
        N+1 を避けるため author / images / tags を prefetch する。
        """
        qs = Tweet.objects.all().select_related("author").prefetch_related("images", "tags")

        request = getattr(self, "request", None)
        if request is None:
            return qs

        author = request.query_params.get("author")
        if author:
            # username は大文字小文字を区別しない (users 側と揃える)
            qs = qs.filter(author__username__iexact=author)

        tag = request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__name=tag.lower())

        return qs.distinct()

    # ------------------------------------------------------------------
    # 3. Retrieve (tombstone 対応)
    # ------------------------------------------------------------------

    def retrieve(self, request: Request, *args, **kwargs) -> Response:
        """retrieve は all_objects から引き、is_deleted=True なら 410 Gone を返す。

        SPEC §3.9: tombstone レスポンス ``{id, is_deleted, deleted_at}``。
        """
        pk = kwargs.get(self.lookup_field)
        tweet = (
            Tweet.all_objects.select_related("author")
            .prefetch_related("images", "tags")
            .filter(pk=pk)
            .first()
        )
        if tweet is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if tweet.is_deleted:
            return Response(
                {
                    "id": tweet.pk,
                    "is_deleted": True,
                    "deleted_at": tweet.deleted_at,
                },
                status=status.HTTP_410_GONE,
            )

        serializer = self.get_serializer(tweet)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # 4. Create
    # ------------------------------------------------------------------

    def create(self, request: Request, *args, **kwargs) -> Response:
        """ツイートを作成する。成功時は detail serializer で 201 を返す。"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tweet = serializer.save(author=request.user)

        out = TweetDetailSerializer(tweet, context=self.get_serializer_context()).data
        return Response(out, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # 5. Update (PATCH only — record_edit 経由)
    # ------------------------------------------------------------------

    def update(self, request: Request, *args, **kwargs) -> Response:
        """PUT は非サポート。PATCH のみ許可する。"""
        if not kwargs.get("partial", False):
            return Response(
                {"detail": 'Method "PUT" not allowed. Use PATCH.'},
                status=status.HTTP_405_METHOD_NOT_ALLOWED,
            )
        return self._do_partial_update(request, *args, **kwargs)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        return self._do_partial_update(request, *args, **kwargs)

    def _do_partial_update(self, request: Request, *args, **kwargs) -> Response:
        """partial_update の実体。

        author チェックは serializer に instance をセットする前に先に行い、
        他人の body validation を無駄に走らせない (情報漏洩防止にもなる)。
        """
        instance = self.get_object()
        # User モデルは primary_key を ``pkid`` (BigAutoField) にしている (apps/users/models.py)。
        # ``Tweet.author`` の FK は pk=pkid に張られるため ``author_id`` と比較するのは
        # ``request.user.pk`` (= pkid)。``request.user.id`` は UUIDField なので一致しない。
        if instance.author_id != request.user.pk:
            raise PermissionDenied("他のユーザーのツイートは編集できません。")

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_update(serializer)
        except DjangoValidationError as exc:
            # record_edit が投げる ValidationError を DRF の 400 に変換する
            raise ValidationError({"detail": exc.messages}) from exc

        instance.refresh_from_db()
        out = TweetDetailSerializer(instance, context=self.get_serializer_context()).data
        return Response(out, status=status.HTTP_200_OK)

    def perform_update(self, serializer: drf_serializers.Serializer) -> None:
        serializer.save()

    # ------------------------------------------------------------------
    # 6. Destroy (soft delete)
    # ------------------------------------------------------------------

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        instance = self.get_object()
        # User の primary key は ``pkid``。詳細は _do_partial_update のコメント参照。
        if instance.author_id != request.user.pk:
            raise PermissionDenied("他のユーザーのツイートは削除できません。")
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance: Tweet) -> None:
        """論理削除 (§3.9)。物理削除はしない。"""
        instance.soft_delete()
