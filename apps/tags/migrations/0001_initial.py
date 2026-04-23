"""Initial migration for the tags app (P1-05).

手書き migration: サンドボックス環境で DB が動かないため、
`makemigrations` による自動生成ではなく手で作成している.
スキーマは apps/tags/models.py::Tag と 1:1 で対応する.

database-reviewer HIGH:
    - name は unique=True で B-tree index が既に張られるため、別 Index を重複追加しない
    - CHECK (name = lower(name)) を追加して ORM bypass (生 SQL / COPY) 経由の
      大文字混入を DB レベルで阻止する
    - created_by FK にも index を追加 (「ユーザー X が提案したタグ一覧」系の逆引き用)
    - 全 index を明示的に命名 (Django 自動生成 hash 由来の drift 防止)
"""

from __future__ import annotations

import django.db.models.deletion
import django.db.models.functions.text
import django.db.models.manager
from django.conf import settings
from django.db import migrations, models

import apps.tags.models
import apps.tags.validators


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Tag",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="Lowercase unique slug. Normalized on save.",
                        max_length=50,
                        unique=True,
                        validators=[apps.tags.validators.validate_tag_name],
                        verbose_name="tag name (lowercase slug)",
                    ),
                ),
                (
                    "display_name",
                    models.CharField(
                        help_text=(
                            "Human-readable display form "
                            "(mixed case allowed, e.g. 'TypeScript')."
                        ),
                        max_length=50,
                        verbose_name="display name",
                    ),
                ),
                (
                    "description",
                    models.TextField(
                        blank=True,
                        help_text="Optional description curated by moderators.",
                        verbose_name="description",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "is_approved",
                    models.BooleanField(
                        default=False,
                        help_text="Whether a moderator has approved this tag for public use.",
                        verbose_name="is approved",
                    ),
                ),
                (
                    "usage_count",
                    models.PositiveIntegerField(
                        default=0,
                        help_text=(
                            "Number of tweets referencing this tag " "(cached, updated by P1-07)."
                        ),
                        verbose_name="usage count",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        help_text=(
                            "User who first proposed the tag. " "NULL for system-seeded tags."
                        ),
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="proposed_tags",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="created by",
                    ),
                ),
            ],
            options={
                "verbose_name": "Tag",
                "verbose_name_plural": "Tags",
                "ordering": ["-usage_count", "name"],
                "base_manager_name": "all_objects",
            },
            managers=[
                ("objects", apps.tags.models.ApprovedTagManager()),
                ("all_objects", django.db.models.manager.Manager()),
            ],
        ),
        migrations.AddIndex(
            model_name="tag",
            index=models.Index(fields=["-usage_count"], name="tags_tag_usage_idx"),
        ),
        migrations.AddIndex(
            model_name="tag",
            index=models.Index(fields=["created_by"], name="tags_tag_created_by_idx"),
        ),
        # database-reviewer HIGH:
        #   ORM の save() オーバーライドだけでは生 SQL / COPY / 他アプリ経由の挿入を
        #   ガードできない。CHECK (name = lower(name)) で DB レベルに二重の防壁を張る。
        #   ``models.CheckConstraint`` を使うことで PostgreSQL / SQLite の双方で
        #   Django が適切な DDL を生成する。
        migrations.AddConstraint(
            model_name="tag",
            constraint=models.CheckConstraint(
                check=models.Q(("name", django.db.models.functions.text.Lower("name"))),
                name="tags_tag_name_lowercase_check",
            ),
        ),
    ]
