from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"

    def ready(self) -> None:
        # Django signal の接続。import 副作用で @receiver が登録される。
        from apps.users import signals  # noqa: F401
