"""Serializers for the tags app (P1-06, Issue #92).

SPEC §4 準拠:
    - 一覧 / 検索: ``TagListSerializer`` (name, display_name, usage_count)
    - 詳細: ``TagDetailSerializer`` (+ description, related_tags)
    - 新規提案 (POST): ``TagCreateSerializer``
        * ``name`` は ``validate_tag_name`` で format / length チェック
        * 小文字正規化し、既存の approved タグと編集距離比較は view 側で実施

未承認タグ (``is_approved=False``) は ``Tag.objects`` (= ApprovedTagManager) の時点で
自動的に除外される。related_tags も同じマネージャ経由で取るため、
「未承認タグが関連タグとして露出する」事故は起きない。
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.tags.models import Tag
from apps.tags.validators import validate_tag_name

# 関連タグとして返却する最大件数 (SPEC §4, 初期実装)。
# 将来 usage_count 帯 or co-occurrence を使った推薦に差し替える予定。
RELATED_TAGS_LIMIT = 5


class TagListSerializer(serializers.ModelSerializer):
    """タグ一覧 / インクリメンタルサーチ用の軽量表現.

    P1-16 コンポーザーが ``?q=<prefix>`` で高頻度に叩くため、
    必要最小限のフィールドだけを返す。
    """

    class Meta:
        model = Tag
        fields = ["name", "display_name", "usage_count"]
        read_only_fields = fields


class TagDetailSerializer(serializers.ModelSerializer):
    """タグ詳細.

    ``related_tags`` は初期実装として「自タグ以外を usage_count 降順で最大 5 件」
    を返す。``Tag.objects`` (ApprovedTagManager) に乗っているため
    is_approved=False のタグは混ざらない。
    """

    related_tags = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = [
            "name",
            "display_name",
            "description",
            "usage_count",
            "related_tags",
        ]
        read_only_fields = fields

    def get_related_tags(self, obj: Tag) -> list[dict[str, object]]:
        """同じ approved タグ群から関連候補を最大 5 件返す.

        - ``Tag.objects`` は ApprovedTagManager により is_approved=True のみ。
        - 自タグ自身は除外する。
        - ordering は Meta の ``-usage_count, name`` を使うだけで十分。
        """
        queryset = (
            Tag.objects.exclude(pk=obj.pk)
            .only("name", "display_name", "usage_count")
            .order_by("-usage_count", "name")[:RELATED_TAGS_LIMIT]
        )
        return TagListSerializer(queryset, many=True).data


class TagCreateSerializer(serializers.Serializer):
    """タグ新規提案 (POST /api/v1/tags/propose/).

    - ``name``: 小文字正規化 + ``validate_tag_name`` で format / length チェック
    - ``display_name``: 未指定なら ``name.capitalize()`` を採用

    重複 / 近似候補の検出は view 側で ``find_similar_tags`` により行う。
    Serializer 自体は入力フォーマットの検証だけに責務を絞る。
    """

    name = serializers.CharField(max_length=50)
    display_name = serializers.CharField(max_length=50, required=False, allow_blank=False)

    def validate_name(self, value: str) -> str:
        """小文字化 + フォーマット検証を適用する.

        ``validate_tag_name`` は Django の ``ValidationError`` を上げるため、
        DRF 層での ``serializers.ValidationError`` に詰め替える。
        """
        normalized = (value or "").strip().lower()
        try:
            validate_tag_name(normalized)
        except DjangoValidationError as err:
            raise serializers.ValidationError(err.messages[0]) from err
        return normalized

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        """display_name 未指定時に name.capitalize() をデフォルトとして採用する.

        code-reviewer (PR #135 MEDIUM #4) 指摘: 引数の dict を mutate せず、
        新しい dict を返して不変性を保つ (共通 coding-style.md の方針に沿う)。
        """
        if not attrs.get("display_name"):
            return {**attrs, "display_name": attrs["name"].capitalize()}
        return attrs


class TagCreateResponseSerializer(serializers.ModelSerializer):
    """タグ新規提案 (POST) の 201 応答用 serializer.

    code-reviewer (PR #135 HIGH #3) 指摘:
        view 側で dict をハードコードして返すとフィールド構成が serializer と
        二重管理になり、API Schema との乖離を招く。応答を serializer に寄せて
        フィールド定義の単一情報源を保つ。
    """

    class Meta:
        model = Tag
        fields = ["name", "display_name", "usage_count", "is_approved"]
        read_only_fields = fields
