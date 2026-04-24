"""
P1-04 review HIGH #2: avatar_url / header_url に validate_media_url を追加する.

code-reviewer (PR #139 HIGH #2) 指摘:
  ``PATCH /api/v1/users/me/`` の avatar_url / header_url に任意の外部ドメインが
  設定できてしまうと tracking pixel / phishing の踏み台になる。許可ドメイン
  (CloudFront / S3 virtual host) に制限する ``validate_media_url`` を model
  field validators に追加する。

NOTE: サンドボックス環境で ``manage.py makemigrations`` が実行できないため
手書きで作成している。将来 ``makemigrations`` を走らせたときに差分が出た
場合は自動生成版と本ファイルをマージして更新すること。
"""

from django.core.validators import URLValidator
from django.db import migrations, models

import apps.users.validators


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_user_profile_and_handle"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="avatar_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="S3 URL to the user's avatar image. Must be https://.",
                max_length=500,
                validators=[
                    URLValidator(schemes=["https"]),
                    apps.users.validators.validate_media_url,
                ],
                verbose_name="Avatar URL",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="header_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="S3 URL to the user's header image. Must be https://.",
                max_length=500,
                validators=[
                    URLValidator(schemes=["https"]),
                    apps.users.validators.validate_media_url,
                ],
                verbose_name="Header URL",
            ),
        ),
    ]
