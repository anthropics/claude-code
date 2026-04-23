"""Models for the tags app (P1-05).

SPEC §4 準拠:
    - name は小文字正規化の一意 slug (URL / ハッシュタグ検索のキー)
    - display_name は表示用 (大小混在: `TypeScript`, `Next.js` など)
    - is_approved はモデレータ承認フラグ。未承認タグの公開は既定マネージャで遮断
    - usage_count は tweets 側 (P1-07) の post_save シグナルからキャッシュ更新予定

ここでは他 worktree と完全独立に動かせるよう、Tag モデル単体のみを提供する。
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from apps.tags.validators import validate_tag_name


class ApprovedTagManager(models.Manager):
    """デフォルトで is_approved=True のタグのみを返す manager.

    security-reviewer HIGH 指摘:
        ``Tag.objects`` を既定で承認済に絞り込むことで、View / Serializer 層で
        ``filter(is_approved=True)`` を付け忘れたときの情報漏洩を防ぐ。
        モデレータ画面など全件アクセスが必要な場合は ``Tag.all_objects`` を用いる。
    """

    def get_queryset(self) -> models.QuerySet[Tag]:
        return super().get_queryset().filter(is_approved=True)


class Tag(models.Model):
    """技術タグ.

    SPEC §4:
        - name: 小文字正規化された一意 slug (検索・URL 用)
        - display_name: 表示用文字列 (大小混在)
        - description: 管理画面から付与される説明
        - created_by: 初回提案ユーザー (システムシード投入時は NULL)
        - is_approved: モデレータ承認フラグ。承認済のみ全文検索 / 候補提示対象
        - usage_count: tweets 側から更新するキャッシュカウンタ (P1-07)
    """

    name = models.CharField(
        verbose_name=_("tag name (lowercase slug)"),
        max_length=50,
        unique=True,
        validators=[validate_tag_name],
        help_text=_("Lowercase unique slug. Normalized on save."),
    )
    display_name = models.CharField(
        verbose_name=_("display name"),
        max_length=50,
        help_text=_("Human-readable display form (mixed case allowed, e.g. 'TypeScript')."),
    )
    description = models.TextField(
        verbose_name=_("description"),
        blank=True,
        help_text=_("Optional description curated by moderators."),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("created by"),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="proposed_tags",
        help_text=_("User who first proposed the tag. NULL for system-seeded tags."),
    )
    is_approved = models.BooleanField(
        verbose_name=_("is approved"),
        default=False,
        help_text=_("Whether a moderator has approved this tag for public use."),
    )
    usage_count = models.PositiveIntegerField(
        verbose_name=_("usage count"),
        default=0,
        help_text=_("Number of tweets referencing this tag (cached, updated by P1-07)."),
    )

    # security-reviewer HIGH:
    #   - Tag.objects は承認済のみを返す ApprovedTagManager (情報漏洩防止)
    #   - Tag.all_objects は管理画面 / seed / モデレータ / マイグレーション用の全件 manager
    # Manager の宣言順は Django の default_manager 決定に影響するため、
    # Meta.base_manager_name で Django 内部処理 (serialization / loaddata / 関連記述子)
    # が参照する "base" manager を all_objects に寄せている。
    objects = ApprovedTagManager()
    all_objects = models.Manager()  # noqa: DJ012  (ruff が custom manager を field と誤認)

    class Meta:
        verbose_name = _("Tag")
        verbose_name_plural = _("Tags")
        # Django 内部 (dumpdata/loaddata, 関連先の自動取得等) は絞り込まない方が安全。
        # 逆に ORM の通常クエリ (Tag.objects) は ApprovedTagManager により自動的に
        # is_approved=True に絞り込まれる。
        base_manager_name = "all_objects"
        # 人気タグを先頭に、同率は name 昇順で安定化
        ordering = ["-usage_count", "name"]
        # database-reviewer HIGH:
        #   - name は unique=True で既に B-tree index が張られるため重複させない
        #   - 全ての index 名を明示し、自動生成 hash 由来の drift を避ける
        indexes = [
            models.Index(fields=["-usage_count"], name="tags_tag_usage_idx"),
            models.Index(fields=["created_by"], name="tags_tag_created_by_idx"),
        ]
        # database-reviewer HIGH:
        #   ORM の save() オーバーライドだけでは生 SQL / COPY / 他アプリ経由の挿入を
        #   ガードできない。CHECK (name = lower(name)) で DB レベルに二重の防壁を張る。
        #   CheckConstraint を使うことで SQLite / PostgreSQL 双方で移植可能な migration になる。
        constraints = [
            models.CheckConstraint(
                check=models.Q(name=Lower("name")),
                name="tags_tag_name_lowercase_check",
            ),
        ]

    def __str__(self) -> str:
        return self.display_name

    def save(self, *args, **kwargs) -> None:
        """name を小文字へ正規化してから保存する.

        python-reviewer HIGH:
            ``update_fields`` が指定され、かつ ``name`` がその中に含まれない場合は
            正規化処理をスキップする。さもないと ``save(update_fields=["usage_count"])``
            のような呼び出しで "name" 列が意図せず書き戻されてしまう。
        """
        update_fields = kwargs.get("update_fields")
        should_normalize = update_fields is None or "name" in update_fields
        if should_normalize and self.name:
            self.name = self.name.lower()
        super().save(*args, **kwargs)
