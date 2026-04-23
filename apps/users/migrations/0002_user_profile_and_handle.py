"""
P1-02 / P1-02a: User モデル拡張。

- @handle バリデーター (validate_handle) への差し替え + max_length 30。
- プロフィール列 (display_name, bio, avatar_url, header_url)。
  - avatar_url / header_url は URLField + URLValidator(https のみ)。
- 課金/オンボーディング列 (is_premium, needs_onboarding)。
- SNS リンク 6 列 (https のみ、default="" で null 不可)。
- -date_joined の index 追加。
  - username は unique=True で UNIQUE index が張られるため別途 AddIndex しない。
- email の db_index=True を撤去 (unique=True で UNIQUE index が張られるため重複)。

NOTE: サンドボックス環境で ``manage.py makemigrations`` が実行できないため
手書きで作成している。将来 ``makemigrations`` を走らせたときに差分が出た
場合は自動生成版と本ファイルをマージして更新すること。
"""

from django.core.validators import URLValidator
from django.db import migrations, models

import apps.users.validators


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        # ---- email: db_index=True (冗長) を撤去 ----
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                max_length=254,
                unique=True,
                verbose_name="Email Address",
            ),
        ),
        # ---- username: max_length=60 -> 30, validator 差し替え ----
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                max_length=30,
                unique=True,
                validators=[apps.users.validators.validate_handle],
                verbose_name="Username",
                help_text=(
                    "Public @handle. 3-30 chars, alphanumeric and underscore "
                    "only. Immutable."
                ),
            ),
        ),
        # ---- プロフィール ----
        migrations.AddField(
            model_name="user",
            name="display_name",
            field=models.CharField(
                blank=True, default="", max_length=50, verbose_name="Display Name"
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="bio",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Plain text only. Markdown is NOT rendered.",
                max_length=160,
                verbose_name="Bio",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="avatar_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="S3 URL to the user's avatar image. Must be https://.",
                max_length=500,
                validators=[URLValidator(schemes=["https"])],
                verbose_name="Avatar URL",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="header_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="S3 URL to the user's header image. Must be https://.",
                max_length=500,
                validators=[URLValidator(schemes=["https"])],
                verbose_name="Header URL",
            ),
        ),
        # ---- フラグ ----
        migrations.AddField(
            model_name="user",
            name="is_premium",
            field=models.BooleanField(
                default=False,
                help_text="Set by Stripe webhook in Phase 8.",
                verbose_name="Is Premium",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="needs_onboarding",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Flipped to False once the onboarding flow (P1-14) completes."
                ),
                verbose_name="Needs Onboarding",
            ),
        ),
        # ---- SNS リンク (https のみ / default="") ----
        migrations.AddField(
            model_name="user",
            name="github_url",
            field=models.URLField(
                blank=True,
                default="",
                validators=[URLValidator(schemes=["https"])],
                verbose_name="GitHub URL",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="x_url",
            field=models.URLField(
                blank=True,
                default="",
                validators=[URLValidator(schemes=["https"])],
                verbose_name="X (Twitter) URL",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="zenn_url",
            field=models.URLField(
                blank=True,
                default="",
                validators=[URLValidator(schemes=["https"])],
                verbose_name="Zenn URL",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="qiita_url",
            field=models.URLField(
                blank=True,
                default="",
                validators=[URLValidator(schemes=["https"])],
                verbose_name="Qiita URL",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="note_url",
            field=models.URLField(
                blank=True,
                default="",
                validators=[URLValidator(schemes=["https"])],
                verbose_name="note URL",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="linkedin_url",
            field=models.URLField(
                blank=True,
                default="",
                validators=[URLValidator(schemes=["https"])],
                verbose_name="LinkedIn URL",
            ),
        ),
        # ---- indexes ----
        # ``username`` の AddIndex は unique=True により UNIQUE index が自動生成
        # されるため冗長 (database-reviewer HIGH)。削除済み。
        migrations.AddIndex(
            model_name="user",
            index=models.Index(
                fields=["-date_joined"], name="users_joined_desc_idx"
            ),
        ),
    ]
