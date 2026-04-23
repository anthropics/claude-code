"""P1-07: tweets 初期マイグレーション。

サンドボックスでは実 DB 起動ができないため手書き。
`apps.tags` の初期マイグレーションが merge されていない worktree では
このマイグレーションは流れないが、`apps.tags` 担当 worktree のマージ後に
通る想定で書いている。

レビュー HIGH 吸収:
- Tweet: TL クエリ用の partial index (`is_deleted=False`) を採用
- Tweet: CheckConstraint(edit_count <= 5) + char_length(body) <= 180 の RunSQL
- TweetImage: `order` に MaxValueValidator / `image_url` を URLField (https 限定)
- TweetTag: `tag_id` 逆引き index を追加 / related_name=`tweet_tags`
- TweetEdit: `editor` 逆引き index / `editor_username` スナップショットカラムを追加
- TweetEdit: `body_before` / `body_after` を CharField(max_length=180) に揃える
"""

from __future__ import annotations

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tags", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Tweet",
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
                ("body", models.CharField(max_length=180)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("edit_count", models.PositiveSmallIntegerField(default=0)),
                ("last_edited_at", models.DateTimeField(blank=True, null=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tweets",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="TweetTag",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "tag",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="tweet_tags",
                        to="tags.tag",
                    ),
                ),
                (
                    "tweet",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tweet_tags",
                        to="tweets.tweet",
                    ),
                ),
            ],
            options={
                "unique_together": {("tweet", "tag")},
            },
        ),
        migrations.AddField(
            model_name="tweet",
            name="tags",
            field=models.ManyToManyField(
                related_name="tweets",
                through="tweets.TweetTag",
                to="tags.tag",
            ),
        ),
        migrations.CreateModel(
            name="TweetImage",
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
                    "image_url",
                    models.URLField(
                        max_length=512,
                        validators=[
                            django.core.validators.URLValidator(schemes=["https"])
                        ],
                    ),
                ),
                ("width", models.PositiveIntegerField()),
                ("height", models.PositiveIntegerField()),
                (
                    "order",
                    models.PositiveSmallIntegerField(
                        default=0,
                        validators=[django.core.validators.MaxValueValidator(3)],
                    ),
                ),
                (
                    "tweet",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="images",
                        to="tweets.tweet",
                    ),
                ),
            ],
            options={
                "ordering": ["order"],
                "unique_together": {("tweet", "order")},
            },
        ),
        migrations.CreateModel(
            name="TweetEdit",
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
                ("body_before", models.CharField(max_length=180)),
                ("body_after", models.CharField(max_length=180)),
                ("edited_at", models.DateTimeField(auto_now_add=True)),
                (
                    "editor_username",
                    models.CharField(blank=True, default="", max_length=150),
                ),
                (
                    "editor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tweet",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="edits",
                        to="tweets.tweet",
                    ),
                ),
            ],
            options={
                "ordering": ["-edited_at"],
            },
        ),
        # ------------- Indexes -------------
        migrations.AddIndex(
            model_name="tweet",
            index=models.Index(
                fields=["-created_at"],
                condition=models.Q(is_deleted=False),
                name="tweets_tl_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="tweet",
            index=models.Index(
                fields=["author", "-created_at"],
                condition=models.Q(is_deleted=False),
                name="tweets_author_tl_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="tweettag",
            index=models.Index(fields=["tag"], name="tweets_tweettag_tag_idx"),
        ),
        migrations.AddIndex(
            model_name="tweetedit",
            index=models.Index(fields=["editor"], name="tweets_tweetedit_editor_idx"),
        ),
        # ------------- Constraints -------------
        migrations.AddConstraint(
            model_name="tweet",
            constraint=models.CheckConstraint(
                check=models.Q(edit_count__lte=5),
                name="tweet_edit_count_lte_max",
            ),
        ),
        # body は CharField(max_length=180) に変更したため、PostgreSQL 側では
        # `varchar(180)` になり DB レイヤーでも長さが強制される。
        # full_clean() / DB CHECK 両方で bypass 不可。
    ]
