import os

from celery import Celery
from django.conf import settings

# os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("alpha_apartments")

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

# P0-10: wire Celery task_prerun / task_postrun / task_failure into structlog
# so every scheduled job lands in the same JSON log stream as request logs.
from apps.common.logging import register_celery_signals  # noqa: E402

register_celery_signals()