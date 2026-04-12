import os

from celery import Celery
from django.conf import settings

# os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("alpha_apartments")

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)