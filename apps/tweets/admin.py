"""Admin registrations for the tweets app (P1-07).

`Tweet` / `TweetImage` / `TweetTag` / `TweetEdit` の管理画面を提供する。
デフォルトの `objects` は削除済みを除外するため、管理画面では
`all_objects` を使って削除済みも含めて閲覧可能にする (is_deleted でフィルタ可)。
"""

from __future__ import annotations

from django.contrib import admin

from apps.tweets.models import Tweet, TweetEdit, TweetImage, TweetTag


class TweetImageInline(admin.TabularInline):
    """TweetAdmin の画像インライン。"""

    model = TweetImage
    extra = 0
    fields = ("order", "image_url", "width", "height")


class TweetTagInline(admin.TabularInline):
    """TweetAdmin のタグインライン (through モデル)。"""

    model = TweetTag
    extra = 0
    fields = ("tag", "created_at")
    readonly_fields = ("created_at",)
    # autocomplete_fields は Django の system check で `tags.Tag` の lazy FK 解決が
    # 間に合わず AttributeError になるため、raw_id_fields に切替。
    # 運用で tag 検索が必要になったら TagAdmin に search_fields 追加 + ここを autocomplete_fields に戻す。
    raw_id_fields = ("tag",)


@admin.register(Tweet)
class TweetAdmin(admin.ModelAdmin):
    """Tweet 管理画面。

    削除済みも含めて閲覧できるよう :pyattr:`Tweet.all_objects` を使う。
    """

    list_display = (
        "id",
        "author",
        "body_preview",
        "created_at",
        "edit_count",
        "is_deleted",
    )
    list_filter = ("is_deleted", "created_at")
    search_fields = ("body", "author__username")
    readonly_fields = ("created_at", "updated_at", "last_edited_at", "deleted_at")
    inlines = (TweetImageInline, TweetTagInline)

    def get_queryset(self, request):  # type: ignore[override]
        """管理画面では削除済みも表示する。

        python-reviewer HIGH: ``super().get_queryset()`` を呼ばないと、
        ModelAdmin が期待する属性 (list_select_related 等) が初期化されず
        副作用が出る。super を呼んで ``all_objects`` の queryset に差し替え、
        admin 側の ordering も尊重する。
        """

        # まず super を経由して admin の周辺設定 (order / select_related) を適用
        qs = super().get_queryset(request)
        # 削除済みも含めるため model の all_objects に差し替え
        ordering = self.get_ordering(request) or qs.query.order_by
        return Tweet.all_objects.all().order_by(*ordering)

    @admin.display(description="body")
    def body_preview(self, obj: Tweet) -> str:
        """一覧で本文の先頭 40 字を表示する。"""

        body = obj.body or ""
        return body if len(body) <= 40 else body[:40] + "…"


@admin.register(TweetImage)
class TweetImageAdmin(admin.ModelAdmin):
    list_display = ("id", "tweet", "order", "image_url", "width", "height")
    list_filter = ("order",)
    search_fields = ("tweet__id", "image_url")


@admin.register(TweetTag)
class TweetTagAdmin(admin.ModelAdmin):
    list_display = ("id", "tweet", "tag", "created_at")
    search_fields = ("tweet__id", "tag__name")
    # autocomplete_fields は system check と衝突するため raw_id_fields を使用 (TweetTagInline と同様)
    raw_id_fields = ("tag",)


@admin.register(TweetEdit)
class TweetEditAdmin(admin.ModelAdmin):
    list_display = ("id", "tweet", "editor", "edited_at")
    list_filter = ("edited_at",)
    search_fields = ("tweet__id", "editor__username")
    readonly_fields = ("edited_at",)
