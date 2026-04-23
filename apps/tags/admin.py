"""Admin registrations for the tags app (P1-05).

モデレータ向け UI:
    - approved フラグのフィルタ/検索/一括承認アクション
    - usage_count は読み取り専用 (tweets 側の signal で更新)
    - Tag.objects は既定で is_approved=True に絞り込まれるため、
      管理画面では未承認タグも含む ``all_objects`` を明示的に採用する
"""

from __future__ import annotations

from django.contrib import admin, messages
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.tags.models import Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "display_name", "is_approved", "usage_count", "created_at"]
    list_filter = ["is_approved"]
    search_fields = ["name", "display_name"]
    readonly_fields = ["usage_count", "created_at", "updated_at"]
    ordering = ["-usage_count", "name"]
    actions = ["approve_tags"]

    def get_queryset(self, request: HttpRequest) -> QuerySet[Tag]:
        """管理画面では未承認タグも表示する必要があるため all_objects を使う."""
        return Tag.all_objects.get_queryset()

    @admin.action(description=_("Approve selected tags"))
    def approve_tags(self, request: HttpRequest, queryset: QuerySet[Tag]) -> None:
        """選択されたタグを一括で approved=True にする.

        python-reviewer HIGH:
            ``queryset.update(...)`` は ``auto_now=True`` を発火させないため、
            ``updated_at`` を手動で ``timezone.now()`` に更新する。
        """
        updated = queryset.update(is_approved=True, updated_at=timezone.now())
        self.message_user(
            request,
            _("%(count)d tag(s) have been approved.") % {"count": updated},
            level=messages.SUCCESS,
        )
