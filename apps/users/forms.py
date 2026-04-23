from django import forms
from django.contrib.auth import forms as admin_forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _

from apps.users.validators import validate_handle

User = get_user_model()


class UserChangeForm(BaseUserChangeForm):
    class Meta(BaseUserChangeForm.Meta):
        model = User
        # username は @handle として変更不可なので admin の編集フォームにも含めない。
        # (database-reviewer LOW / python-reviewer HIGH 対応)
        fields = ["first_name", "last_name", "email"]


class UserCreationForm(admin_forms.UserCreationForm):
    class Meta(admin_forms.UserCreationForm.Meta):
        model = User
        fields = ["first_name", "last_name", "username", "email"]

    # python-reviewer HIGH: ユーザー向けメッセージは gettext_lazy で wrap する。
    error_messages = {
        "duplicate_username": _("A user with that username already exists."),
        "duplicate_email": _("A user with that email already exists."),
    }

    def clean_email(self) -> str:
        email = self.cleaned_data["email"]
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError(self.error_messages["duplicate_email"])
        return email

    def clean_username(self) -> str:
        username = self.cleaned_data["username"]
        # @handle 形式 / 予約語チェック。
        try:
            validate_handle(username)
        except DjangoValidationError as err:
            # Django core ValidationError -> forms.ValidationError に変換。
            raise forms.ValidationError(err.messages[0]) from err
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError(self.error_messages["duplicate_username"])
        return username
