import uuid
from typing import Any

from django.contrib.auth.models import AbstractUser
from django.core import validators
from django.core.validators import URLValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.users.managers import UserManager
from apps.users.validators import validate_handle

# SNS / アバター / ヘッダー URL には https のみ許容する (security-reviewer HIGH)。
# ftp:// / http:// を拒否する URLValidator を使い回す。
_HTTPS_URL_VALIDATOR = URLValidator(schemes=["https"])


class UsernameValidator(validators.RegexValidator):
    """互換のため残している旧正規表現バリデーター。

    ※ 新規には ``validate_handle`` を使用する。既存 migration (0001) がこの
    クラスを参照しているため残している。
    """

    regex = r"^[\w.@+-]+\Z"
    message = _(
        "Your username is not valid. A username can only contain letters, numbers, a dot, "
        "@ symbol, + symbol and a hyphen "
    )
    flag = 0


class User(AbstractUser):
    """SNS 向けに拡張された User モデル。

    SPEC §2 参照:
    - username は @handle として振る舞い、作成後は変更不可 (signals.py 参照)。
    - プロフィール拡張: display_name, bio, avatar_url, header_url
    - 課金/オンボーディング: is_premium, needs_onboarding
    - SNS リンク 6 種 (github/x/zenn/qiita/note/linkedin)
    """

    pkid = models.BigAutoField(primary_key=True, editable=False)
    id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    first_name = models.CharField(verbose_name=_("First Name"), max_length=60)
    last_name = models.CharField(verbose_name=_("Last Name"), max_length=60)
    # ``unique=True`` は PostgreSQL で UNIQUE index を自動生成するため、
    # ``db_index=True`` の併用は冗長 (database-reviewer HIGH)。
    email = models.EmailField(verbose_name=_("Email Address"), unique=True)
    username = models.CharField(
        verbose_name=_("Username"),
        max_length=30,
        unique=True,
        validators=[validate_handle],
        help_text=_("Public @handle. 3-30 chars, alphanumeric and underscore only. Immutable."),
    )

    # ---- プロフィール (SPEC §2) ----
    display_name = models.CharField(
        verbose_name=_("Display Name"),
        max_length=50,
        blank=True,
        default="",
    )
    bio = models.CharField(
        verbose_name=_("Bio"),
        max_length=160,
        blank=True,
        default="",
        help_text=_("Plain text only. Markdown is NOT rendered."),
    )
    avatar_url = models.URLField(
        verbose_name=_("Avatar URL"),
        max_length=500,
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
        help_text=_("S3 URL to the user's avatar image. Must be https://."),
    )
    header_url = models.URLField(
        verbose_name=_("Header URL"),
        max_length=500,
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
        help_text=_("S3 URL to the user's header image. Must be https://."),
    )

    # ---- 課金 / オンボーディング ----
    is_premium = models.BooleanField(
        verbose_name=_("Is Premium"),
        default=False,
        help_text=_("Set by Stripe webhook in Phase 8."),
    )
    needs_onboarding = models.BooleanField(
        verbose_name=_("Needs Onboarding"),
        default=True,
        help_text=_("Flipped to False once the onboarding flow (P1-14) completes."),
    )

    # ---- SNS リンク ----
    # python-reviewer HIGH (DJ001): CharField/URLField の null=True は避け、
    # 空値は "" で統一する。security-reviewer HIGH: https のみ許容。
    github_url = models.URLField(
        verbose_name=_("GitHub URL"),
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
    )
    x_url = models.URLField(
        verbose_name=_("X (Twitter) URL"),
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
    )
    zenn_url = models.URLField(
        verbose_name=_("Zenn URL"),
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
    )
    qiita_url = models.URLField(
        verbose_name=_("Qiita URL"),
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
    )
    note_url = models.URLField(
        verbose_name=_("note URL"),
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
    )
    linkedin_url = models.URLField(
        verbose_name=_("LinkedIn URL"),
        blank=True,
        default="",
        validators=[_HTTPS_URL_VALIDATOR],
    )

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    objects = UserManager()

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")
        ordering = ["-date_joined"]
        # NOTE (database-reviewer HIGH): ``username`` は ``unique=True`` により
        # PostgreSQL が自動で UNIQUE index を張る。明示的な ``Index(fields=["username"])``
        # は完全に重複するため削除した。``-date_joined`` はソート/フィード用途で
        # 独立したインデックスが必要なため残す。``name=`` を明示して命名 drift を防ぐ。
        indexes = [
            models.Index(fields=["-date_joined"], name="users_joined_desc_idx"),
        ]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # username 変更拒否用の snapshot (signals.py で参照)。
        self._original_username: str | None = self.username

    @classmethod
    def from_db(cls, db: Any, field_names: Any, values: Any) -> "User":
        instance = super().from_db(db, field_names, values)
        instance._original_username = instance.username
        return instance

    @property
    def full_name(self) -> str:
        """表示用のフルネーム (read-only プロパティ)。

        ``AbstractUser.get_full_name()`` を上書き (shadow) しないよう、あえて
        別名 ``full_name`` として公開する (python-reviewer HIGH)。
        """
        return f"{self.first_name} {self.last_name}".strip()
