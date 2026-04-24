"""Views for the tags app (P1-06, Issue #92).

SPEC §4 に沿って 3 つのエンドポイントを提供する:

    GET  /api/v1/tags/               -- タグ一覧 + インクリメンタルサーチ (AllowAny)
    GET  /api/v1/tags/<name>/        -- タグ詳細 (AllowAny)
    POST /api/v1/tags/propose/       -- タグ新規提案 (IsAuthenticated + CSRF)

未承認タグ (is_approved=False) は ``Tag.objects`` (= ApprovedTagManager) で
自動的に除外される。POST で新規作成されるタグも ``is_approved=False`` 起点のため、
モデレータが承認するまで search / detail には現れない。
"""

from __future__ import annotations

from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.common.cookie_auth import CookieAuthentication, CSRFEnforcingAuthentication
from apps.tags.models import Tag
from apps.tags.serializers import (
    TagCreateResponseSerializer,
    TagCreateSerializer,
    TagDetailSerializer,
    TagListSerializer,
)
from apps.tags.validators import MAX_TAG_LENGTH, find_similar_tags


class TagProposeThrottle(UserRateThrottle):
    """``POST /api/v1/tags/propose/`` 専用のレート制限.

    code-reviewer (PR #135 HIGH #2) 指摘:
        ``find_similar_tags`` は全 approved タグに対して Levenshtein 距離を
        Python 側で計算するため、認証済みユーザーの既定 throttle (500/day) だけでは
        攻撃者が短時間に大量 POST して DB / CPU を消費させる余地が残る。
        `tag_propose` scope を切って 20/hour に絞り、提案 API 単独で
        ブルートフォース的な近似検索を抑止する。
    """

    scope = "tag_propose"


class TagListView(ListAPIView):
    """タグ一覧 + インクリメンタルサーチ.

    SPEC §4:
        - ``?q=<prefix>`` で name の前方一致 + display_name の部分一致を検索
        - 結果は Meta の ``-usage_count, name`` (人気順 → name 昇順) に従う
        - 未承認タグは ``Tag.objects`` (ApprovedTagManager) の時点で除外
        - ページネーションは DRF 既定 (PageNumberPagination, PAGE_SIZE=10)

    権限: AllowAny (未ログインでも閲覧可能)
    """

    serializer_class = TagListSerializer
    permission_classes = [AllowAny]
    # DEFAULT_AUTHENTICATION_CLASSES が Cookie/JWT を拾う挙動になっているが、
    # AllowAny なので expired cookie 等で 401 を返さないよう明示的に空にする。
    authentication_classes: list = []

    def get_queryset(self) -> QuerySet[Tag]:
        """``?q=<prefix>`` で絞り込む. 空なら全件 (Manager が approved のみに絞り込む)."""
        queryset = Tag.objects.all()
        q = self.request.query_params.get("q", "").strip()
        if q:
            # code-reviewer (PR #135 MEDIUM #7) 指摘:
            #   validators.find_similar_tags 側は呼ばれないが、ORM 側の LIKE も
            #   ``q`` が極端に長いと遅くなるため、タグ名の最大長で切り詰めて
            #   DoS 的な入力を無害化する。タグ名は MAX_TAG_LENGTH を超えては
            #   ヒットし得ないのでセマンティクスも変わらない。
            q = q[:MAX_TAG_LENGTH]
            # name は小文字保存なので istartswith と startswith は等価だが、
            # 大文字入力でも引けるよう istartswith を使う。
            # display_name は大小混在なので icontains で部分一致にする。
            queryset = queryset.filter(Q(name__istartswith=q) | Q(display_name__icontains=q))
        return queryset


class TagDetailView(RetrieveAPIView):
    """タグ詳細 (``GET /api/v1/tags/<name>/``).

    - lookup は ``name__iexact`` で大文字小文字を無視。
    - 未承認タグは ``Tag.objects`` が除外するので 404 になる。
    - 権限: AllowAny。
    """

    serializer_class = TagDetailSerializer
    permission_classes = [AllowAny]
    authentication_classes: list = []
    # URL kwarg 名は ``name``。``get_object`` を override しているので
    # ``lookup_field`` は実際には使われないが、code-reviewer (PR #135 MEDIUM #5)
    # 指摘どおり「どの column で引いているか」を一目で分かるよう明示する。
    lookup_field = "name"
    lookup_url_kwarg = "name"

    def get_queryset(self) -> QuerySet[Tag]:
        return Tag.objects.all()

    def get_object(self) -> Tag:
        """name の大文字小文字を無視して解決する.

        DRF 標準の ``get_object()`` は ``filter(**{lookup_field: value})`` と
        完全一致で引くため、``name__iexact`` を使うにはここで override する。
        """
        queryset = self.filter_queryset(self.get_queryset())
        name = self.kwargs[self.lookup_url_kwarg]
        obj = get_object_or_404(queryset, name__iexact=name)
        self.check_object_permissions(self.request, obj)
        return obj


class TagProposeView(APIView):
    """タグ新規提案 (``POST /api/v1/tags/propose/``).

    SPEC §4:
        1. ``validate_tag_name`` で format / length チェック (serializer 内)
        2. ``find_similar_tags`` で編集距離 2 以下の既存 approved タグを検索
        3. 近似タグが 1 件以上あれば 409 Conflict + ``similar_tags`` を返す
           (ユーザーが既存タグの選択に誘導されるようにする)
        4. 近似なしなら ``is_approved=False`` で Tag を作成し、201 を返す

    権限: IsAuthenticated + CSRF (Cookie 経由認証時).
    """

    # Cookie 経由の認証と、Cookie が無くても CSRF トークンを強制するための pre-auth
    # を組み合わせる (apps/users/views.py の LogoutView と同方針)。
    #
    # 注意: DRF の ``get_authenticate_header()`` は先頭 authenticator から
    # ``authenticate_header()`` を引いて 401 の WWW-Authenticate を組み立てる。
    # CSRFEnforcingAuthentication を先頭に置くと header が空になり、未認証時に
    # 403 が返ってしまう (LogoutView とは異なり、ここは未ログインユーザーも
    # 叩きうるエンドポイントなので 401 をきちんと返したい)。
    # そのため CookieAuthentication を先頭に置き、CSRFEnforcingAuthentication は
    # 2 番目に置くことで「Cookie 無し POST でも CSRF を強制しつつ、401 を返す」挙動にする。
    authentication_classes = [CookieAuthentication, CSRFEnforcingAuthentication]
    permission_classes = [IsAuthenticated]
    # code-reviewer (PR #135 HIGH #2) 指摘: find_similar_tags を Python 側で
    # 全 approved タグに対し回すため、既定 throttle (user: 500/day) だけでは
    # 短時間の大量 POST に弱い。専用 scope (20/hour) で抑止する。
    throttle_classes = [TagProposeThrottle]
    parser_classes = [JSONParser]
    # 他メソッドは 405 で弾く (副作用のある POST だけを受け付ける意図を明示する)。
    http_method_names = ["post", "head", "options"]

    def post(self, request: Request, *args, **kwargs) -> Response:
        serializer = TagCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data["name"]
        display_name = serializer.validated_data["display_name"]

        # 既存 approved タグとの編集距離チェック. 完全一致 (distance=0) も含めて
        # 返却することで、クライアントが「同名既存タグ」のケースと「似ているタグ」の
        # ケースを区別せずに選択候補として提示できる。
        similar = find_similar_tags(name)
        if similar:
            return Response(
                {
                    "detail": "A similar tag already exists.",
                    "similar_tags": [
                        {
                            "name": s.name,
                            "display_name": s.display_name,
                            "distance": s.distance,
                        }
                        for s in similar
                    ],
                },
                status=status.HTTP_409_CONFLICT,
            )

        # 承認済み群と被らないのでここで新規作成する. is_approved=False を起点とし、
        # モデレータ承認まで search / detail からは見えない。
        # all_objects を使って ApprovedTagManager の filter を回避する
        # (そうしないと直後の refresh_from_db で自分が見えなくなる)。
        tag = Tag.all_objects.create(
            name=name,
            display_name=display_name,
            created_by=request.user,
            is_approved=False,
        )

        # code-reviewer (PR #135 HIGH #3) 指摘: 201 応答も serializer 経由にして
        # フィールドの単一情報源を保つ (API Schema との乖離を防止)。
        return Response(
            TagCreateResponseSerializer(tag).data,
            status=status.HTTP_201_CREATED,
        )
