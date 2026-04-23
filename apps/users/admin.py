from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .forms import UserChangeForm, UserCreationForm

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    list_display = [
        "pkid",
        "id",
        "email",
        "first_name",
        "last_name",
        "username",
        "is_premium",
        "is_superuser",
    ]
    list_display_links = ["pkid", "id", "email", "username"]
    list_filter = ("is_staff", "is_superuser", "is_active", "is_premium", "needs_onboarding")
    search_fields = ["email", "first_name", "last_name", "username"]
    ordering = ["pkid"]
    # username は @handle として変更不可なので admin UI でも編集不可。
    readonly_fields = ("username", "date_joined", "last_login")
    fieldsets = (
        (_("Login Credentials"), {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("first_name", "last_name", "username")}),
        (
            _("Profile"),
            {
                "fields": (
                    "display_name",
                    "bio",
                    "avatar_url",
                    "header_url",
                )
            },
        ),
        (
            _("SNS Links"),
            {
                "fields": (
                    "github_url",
                    "x_url",
                    "zenn_url",
                    "qiita_url",
                    "note_url",
                    "linkedin_url",
                )
            },
        ),
        (
            _("Flags"),
            {"fields": ("is_premium", "needs_onboarding")},
        ),
        (
            _("Permissions and Groups"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (_("Important Dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "first_name",
                    "last_name",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
