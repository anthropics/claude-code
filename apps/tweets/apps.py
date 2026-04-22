from django.apps import AppConfig


class TweetsConfig(AppConfig):
    """AppConfig for the tweets app.

    Models and URLs are intentionally empty at Phase 0;
    they are added in the phase that implements each feature
    (see docs/ROADMAP.md).
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tweets"
